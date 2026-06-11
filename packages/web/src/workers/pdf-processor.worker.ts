import type { WorkerMessage, WorkerResponse } from '../hooks/useWorker';
import type { RedactionConfig } from '@redact/shared';
import { MaskingStyle } from '@redact/shared';
import { buildFakeDataMap } from '../lib/fake-data-generator';

export interface PdfProcessConfig {
  buffer: ArrayBuffer;
  config: RedactionConfig;
  action: 'extract-text' | 'redact';
}

export interface PdfProcessResult {
  text?: string;
  redactedBuffer?: ArrayBuffer;
  pageCount?: number;
}

type InMessage = WorkerMessage<PdfProcessConfig>;
type OutMessage = WorkerResponse<PdfProcessResult>;

const post = (msg: OutMessage) => self.postMessage(msg);

async function extractTextFromPdf(buffer: ArrayBuffer): Promise<{ text: string; pageCount: number }> {
  const pdfjsLib = await import('pdfjs-dist');
  const { default: pdfWorkerUrl } = await import('pdfjs-dist/build/pdf.worker.mjs?url');
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;
  const pageCount = pdf.numPages;
  const textParts: string[] = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? (item as { str: string }).str : ''))
      .join(' ');
    textParts.push(pageText);

    post({ type: 'PROGRESS', payload: { pct: Math.round((i / pageCount) * 60), stage: `Reading page ${i} of ${pageCount}` } });
  }

  return { text: textParts.join('\n'), pageCount };
}

async function redactPdf(buffer: ArrayBuffer, config: RedactionConfig): Promise<ArrayBuffer> {
  const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
  const pdfjsLib = await import('pdfjs-dist');
  const { default: pdfWorkerUrl } = await import('pdfjs-dist/build/pdf.worker.mjs?url');
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  const pdfDoc = await PDFDocument.load(buffer);
  const pages = pdfDoc.getPages();

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer.slice(0)) });
  const pdf = await loadingTask.promise;

  const approvedItems = config.piiItems.filter((i) => i.approved);
  const fakeDataMap = config.maskingStyle === MaskingStyle.FAKE_DATA
    ? buildFakeDataMap(approvedItems)
    : {};

  const termsToRedact = [
    ...approvedItems.map((i) => i.text),
    ...config.customTerms,
  ].filter(Boolean);

  for (let i = 1; i <= pdf.numPages; i++) {
    if (i - 1 >= pages.length) continue;
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pdfLibPage = pages[i - 1]!;

    for (const item of content.items) {
      if (!('str' in item)) continue;
      const str = (item as any).str;

      let shouldRedact = false;
      for (const term of termsToRedact) {
        if (str.includes(term)) {
          shouldRedact = true;
          break;
        }
      }

      if (shouldRedact) {
        const tx = (item as any).transform[4];
        const ty = (item as any).transform[5];
        const width = (item as any).width;
        const height = (item as any).height || (item as any).transform[3] || 12;
        const matchedTerm = termsToRedact.find((t) => str.includes(t)) ?? str;

        if (config.maskingStyle === MaskingStyle.FAKE_DATA && fakeDataMap[matchedTerm]) {
          const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
          pdfLibPage.drawRectangle({ x: tx, y: ty, width, height, color: rgb(1, 1, 1) });
          pdfLibPage.drawText(fakeDataMap[matchedTerm]!, {
            x: tx,
            y: ty + height / 2 - 4,
            size: Math.max(4, Math.min(10, height - 2)),
            font,
            color: rgb(0, 0, 0),
          });
        } else if (config.maskingStyle === MaskingStyle.REDACTED_LABEL) {
          const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
          pdfLibPage.drawRectangle({ x: tx, y: ty, width, height, color: rgb(0, 0, 0) });
          pdfLibPage.drawText('[REDACTED]', {
            x: tx + 2,
            y: ty + height / 2 - 4,
            size: Math.max(4, Math.min(10, height - 2)),
            font,
            color: rgb(1, 1, 1),
          });
        } else {
          pdfLibPage.drawRectangle({ x: tx, y: ty, width, height, color: rgb(0, 0, 0) });
        }
      }
    }
  }

  for (const region of config.regions) {
    if (region.pageIndex >= 0 && region.pageIndex < pages.length) {
      const page = pages[region.pageIndex]!;
      const { x, y, width, height } = region.boundingBox;

      switch (config.maskingStyle) {
        case MaskingStyle.REDACTED_LABEL: {
          const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
          page.drawRectangle({ x, y, width, height, color: rgb(0, 0, 0) });
          page.drawText('[REDACTED]', {
            x: x + 2,
            y: y + height / 2 - 4,
            size: Math.max(4, Math.min(10, height - 2)),
            font,
            color: rgb(1, 1, 1),
          });
          break;
        }
        default:
          page.drawRectangle({ x, y, width, height, color: rgb(0, 0, 0) });
      }
    }
  }

  const result = await pdfDoc.save();
  return result.slice().buffer;
}

self.onmessage = async ({ data }: MessageEvent<InMessage>) => {
  if (data.type === 'CANCEL') return;

  const { buffer, config, action } = data.payload;

  try {
    if (action === 'extract-text') {
      post({ type: 'PROGRESS', payload: { pct: 5, stage: 'Loading PDF...' } });
      const { text, pageCount } = await extractTextFromPdf(buffer);
      post({ type: 'COMPLETE', payload: { text, pageCount } });
    } else if (action === 'redact') {
      post({ type: 'PROGRESS', payload: { pct: 10, stage: 'Applying redactions...' } });
      const redactedBuffer = await redactPdf(buffer, config);
      post({ type: 'PROGRESS', payload: { pct: 90, stage: 'Finalizing PDF...' } });
      self.postMessage({ type: 'COMPLETE', payload: { redactedBuffer } } satisfies OutMessage, { transfer: [redactedBuffer] });
    }
  } catch (err) {
    post({
      type: 'ERROR',
      payload: {
        code: 'PDF_PROCESSING_FAILED',
        message: err instanceof Error ? err.message : 'PDF processing failed',
      },
    });
  }
};
