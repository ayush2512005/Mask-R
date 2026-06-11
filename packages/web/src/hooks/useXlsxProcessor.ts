import { useCallback, useEffect } from 'react';
import { useWorker } from './useWorker';
import type { XlsxProcessConfig, XlsxProcessResult } from '../workers/xlsx-processor.worker';
import { useRedactionStore } from '../stores/redaction.store';
import type { RedactionConfig } from '@redact/shared';
import XlsxWorker from '../workers/xlsx-processor.worker.ts?worker';

function createXlsxWorker() {
  return new XlsxWorker();
}

export function useXlsxProcessor() {
  const { run, cancel, progress, stage, status, error, result } =
    useWorker<XlsxProcessConfig, XlsxProcessResult>(createXlsxWorker);
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
