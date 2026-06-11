import { useCallback, useEffect } from 'react';
import { useWorker } from './useWorker';
import type { PdfProcessConfig, PdfProcessResult } from '../workers/pdf-processor.worker';
import { useRedactionStore } from '../stores/redaction.store';
import type { RedactionConfig } from '@redact/shared';
import PdfWorker from '../workers/pdf-processor.worker.ts?worker';

function createPdfWorker() {
  return new PdfWorker();
}

export function usePdfProcessor() {
  const { run, cancel, progress, stage, status, error, result } =
    useWorker<PdfProcessConfig, PdfProcessResult>(createPdfWorker);
  const setRedactedBuffer = useRedactionStore((s) => s.setRedactedBuffer);

  useEffect(() => {
    if (result?.redactedBuffer) {
      setRedactedBuffer(result.redactedBuffer);
    }
  }, [result, setRedactedBuffer]);

  const extractText = useCallback(
    (buffer: ArrayBuffer) => {
      run({ buffer, config: {} as RedactionConfig, action: 'extract-text' });
    },
    [run]
  );

  const redact = useCallback(
    (buffer: ArrayBuffer, config: RedactionConfig) => {
      run({ buffer, config, action: 'redact' });
    },
    [run]
  );

  return { extractText, redact, cancel, progress, stage, status, error, result };
}
