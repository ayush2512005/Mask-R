import type { WorkerMessage, WorkerResponse } from '../hooks/useWorker';
import type { RedactionConfig } from '@redact/shared';
import { MaskingStyle } from '@redact/shared';
import { buildFakeDataMap } from '../lib/fake-data-generator';

export interface XlsxProcessConfig {
  buffer: ArrayBuffer;
  config: RedactionConfig;
  action: 'extract-text' | 'redact';
}

export interface XlsxProcessResult {
  text?: string;
  redactedBuffer?: ArrayBuffer;
}

type InMessage = WorkerMessage<XlsxProcessConfig>;
type OutMessage = WorkerResponse<XlsxProcessResult>;

const post = (msg: OutMessage) => self.postMessage(msg);

self.onmessage = async ({ data }: MessageEvent<InMessage>) => {
  if (data.type === 'CANCEL') return;

  const { buffer, config, action } = data.payload;

  try {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'array' });

    if (action === 'extract-text') {
      post({ type: 'PROGRESS', payload: { pct: 20, stage: 'Parsing spreadsheet...' } });
      const textParts: string[] = [];
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (sheet) {
          const csv = XLSX.utils.sheet_to_csv(sheet);
          textParts.push(csv);
        }
      }
      post({ type: 'COMPLETE', payload: { text: textParts.join('\n') } });
    } else if (action === 'redact') {
      post({ type: 'PROGRESS', payload: { pct: 20, stage: 'Applying redactions...' } });
      const approvedItems = config.piiItems.filter((i) => i.approved);
      const fakeDataMap = config.maskingStyle === MaskingStyle.FAKE_DATA
        ? buildFakeDataMap(approvedItems)
        : null;
      const allTerms = [
        ...approvedItems.map((i) => i.text),
        ...config.customTerms,
      ];

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;
        for (const cellAddr of Object.keys(sheet)) {
          if (cellAddr.startsWith('!')) continue;
          const cell = sheet[cellAddr];
          if (cell && cell.v !== undefined) {
            const cellStr = String(cell.v);
            for (const term of allTerms) {
              if (cellStr.toLowerCase().includes(term.toLowerCase())) {
                const replacement = fakeDataMap?.[term] ?? '[REDACTED]';
                cell.v = replacement;
                cell.w = replacement;
                if (cell.f) delete cell.f;
                break;
              }
            }
          }
        }
      }

      post({ type: 'PROGRESS', payload: { pct: 80, stage: 'Writing output...' } });
      const out = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as Uint8Array;
      const redactedBuffer = out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
      post({ type: 'COMPLETE', payload: { redactedBuffer } });
    }
  } catch (err) {
    post({
      type: 'ERROR',
      payload: {
        code: 'XLSX_PROCESSING_FAILED',
        message: err instanceof Error ? err.message : 'XLSX processing failed',
      },
    });
  }
};
