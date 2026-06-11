import type { WorkerMessage, WorkerResponse } from '../hooks/useWorker';
import type { RedactionConfig } from '@redact/shared';
import { MaskingStyle } from '@redact/shared';
import { buildFakeDataMap } from '../lib/fake-data-generator';

export interface DocxProcessConfig {
  buffer: ArrayBuffer;
  config: RedactionConfig;
  action: 'extract-text' | 'redact';
}

export interface DocxProcessResult {
  text?: string;
  redactedBuffer?: ArrayBuffer;
}

type InMessage = WorkerMessage<DocxProcessConfig>;
type OutMessage = WorkerResponse<DocxProcessResult>;

const post = (msg: OutMessage) => self.postMessage(msg);

// Only content XML files contain user-typed text; styles/settings/rels do not.
const CONTENT_XML_RE = /^word\/(document|header\d+|footer\d+|footnotes|endnotes|comments)\.xml$/;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function encodeXmlText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

interface TextNode {
  index: number;
  length: number;
  attrs: string;
  rawText: string;
  plainText: string;
}

/**
 * Redacts terms within a single <w:p> paragraph block.
 *
 * Builds a combined plain-text view of all <w:t> runs in the paragraph, finds
 * every term match in that combined view, then maps each matched character back
 * to its originating <w:t> node and rewrites just that node's content.
 *
 * This correctly handles terms that are split across multiple <w:r> runs
 * (e.g. due to mixed formatting or spell-check run boundaries in Word).
 */
function redactParagraph(paraXml: string, termRegex: RegExp, fakeDataMap?: Record<string, string>): string {
  const nodes: TextNode[] = [];
  const nodeRe = /<w:t([^>]*)>([^<]*)<\/w:t>/g;
  let m: RegExpExecArray | null;

  while ((m = nodeRe.exec(paraXml)) !== null) {
    nodes.push({
      index: m.index,
      length: m[0].length,
      attrs: m[1] ?? '',
      rawText: m[2] ?? '',
      plainText: decodeXmlEntities(m[2] ?? ''),
    });
  }

  if (nodes.length === 0) return paraXml;

  const combined = nodes.map((n) => n.plainText).join('');

  // Quick check — reset lastIndex before every test/exec
  termRegex.lastIndex = 0;
  if (!termRegex.test(combined)) return paraXml;

  // Collect every character position inside a match
  const toRedact = new Set<number>();
  termRegex.lastIndex = 0;
  let hit: RegExpExecArray | null;
  while ((hit = termRegex.exec(combined)) !== null) {
    for (let i = hit.index; i < hit.index + hit[0].length; i++) toRedact.add(i);
    if (hit[0].length === 0) termRegex.lastIndex++; // guard against zero-length match loop
  }

  if (toRedact.size === 0) return paraXml;

  // Rewrite each node's plain text, inserting replacement for runs of matched chars
  let offset = 0;
  const newTexts: (string | null)[] = nodes.map((node) => {
    const len = node.plainText.length;
    let out = '';
    let inBlock = false;
    let blockStart = -1;
    for (let j = 0; j < len; j++) {
      if (toRedact.has(offset + j)) {
        if (!inBlock) {
          inBlock = true;
          blockStart = offset + j;
          // Find which original term starts at blockStart in the combined string
          let replacement = '[REDACTED]';
          if (fakeDataMap) {
            for (const [orig, fake] of Object.entries(fakeDataMap)) {
              if (combined.slice(blockStart, blockStart + orig.length).toLowerCase() === orig.toLowerCase()) {
                replacement = fake;
                break;
              }
            }
          }
          out += replacement;
        }
        // else: skip char — part of the same redacted run
      } else {
        out += node.plainText[j];
        inBlock = false;
        blockStart = -1;
      }
    }
    offset += len;
    return out !== node.plainText ? out : null; // null = no change needed
  });

  // Rebuild paragraph XML — iterate in reverse so index offsets stay valid
  let result = paraXml;
  for (let i = nodes.length - 1; i >= 0; i--) {
    const newText = newTexts[i];
    const node = nodes[i];
    if (newText === null || newText === undefined || !node) continue;
    const replacement = `<w:t${node.attrs}>${encodeXmlText(newText)}</w:t>`;
    result = result.slice(0, node.index) + replacement + result.slice(node.index + node.length);
  }

  return result;
}

async function extractTextFromDocx(buffer: ArrayBuffer): Promise<string> {
  const { extractRawText } = await import('mammoth');
  const result = await extractRawText({ arrayBuffer: buffer });
  return result.value;
}

async function redactDocx(buffer: ArrayBuffer, config: RedactionConfig): Promise<ArrayBuffer> {
  const { default: JSZip } = await import('jszip');

  const approvedItems = config.piiItems.filter((i) => i.approved);
  const fakeDataMap = config.maskingStyle === MaskingStyle.FAKE_DATA
    ? buildFakeDataMap(approvedItems)
    : undefined;

  const terms = [
    ...approvedItems.map((i) => i.text),
    ...config.customTerms,
  ].filter(Boolean);

  const uniqueTerms = [...new Set(terms)].sort((a, b) => b.length - a.length); // longest first

  post({ type: 'PROGRESS', payload: { pct: 10, stage: 'Opening document...' } });

  const zip = new JSZip();
  await zip.loadAsync(buffer.slice(0));

  if (uniqueTerms.length === 0) {
    // Nothing to redact — return a fresh copy so the caller gets a valid DOCX
    const out = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
    return out;
  }

  // Build one combined regex with longest-term-first alternation.
  // Sorting ensures "john smith" is matched before "smith" when both are terms.
  const termRegex = new RegExp(uniqueTerms.map(escapeRegex).join('|'), 'gi');

  const contentFiles = Object.entries(zip.files).filter(
    ([path, f]) => !f.dir && CONTENT_XML_RE.test(path)
  );

  post({ type: 'PROGRESS', payload: { pct: 20, stage: 'Scanning document parts...' } });

  for (let fi = 0; fi < contentFiles.length; fi++) {
    const [path, file] = contentFiles[fi]!;
    const pct = 20 + Math.round(((fi + 1) / contentFiles.length) * 60);
    post({ type: 'PROGRESS', payload: { pct, stage: `Redacting ${path.split('/').pop()}...` } });

    const xml = await file.async('string');

    // Process paragraph by paragraph so cross-run spans are handled correctly
    const redacted = xml.replace(
      /(<w:p(?:>|\s[^>]*>)[\s\S]*?<\/w:p>)/g,
      (para) => redactParagraph(para, termRegex, fakeDataMap)
    );

    if (redacted !== xml) {
      zip.file(path, redacted);
    }
  }

  post({ type: 'PROGRESS', payload: { pct: 85, stage: 'Writing output file...' } });

  const outBuffer = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
  return outBuffer;
}

self.onmessage = async ({ data }: MessageEvent<InMessage>) => {
  if (data.type === 'CANCEL') return;

  const { buffer, config, action } = data.payload;

  try {
    if (action === 'extract-text') {
      post({ type: 'PROGRESS', payload: { pct: 20, stage: 'Parsing document...' } });
      const text = await extractTextFromDocx(buffer);
      post({ type: 'COMPLETE', payload: { text } });
    } else if (action === 'redact') {
      const redactedBuffer = await redactDocx(buffer, config);
      // Transfer the buffer (zero-copy) so the main thread owns it immediately
      self.postMessage(
        { type: 'COMPLETE', payload: { redactedBuffer } } satisfies OutMessage,
        { transfer: [redactedBuffer] }
      );
    }
  } catch (err) {
    post({
      type: 'ERROR',
      payload: {
        code: 'DOCX_PROCESSING_FAILED',
        message: err instanceof Error ? err.message : 'DOCX processing failed',
      },
    });
  }
};
