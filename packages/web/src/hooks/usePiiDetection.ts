import { useCallback, useEffect } from 'react';
import { useWorker } from './useWorker';
import type { PiiDetectionConfig, PiiDetectionResult } from '../workers/pii-detection.worker';
import type { PiiType } from '@redact/shared';
import { useRedactionStore } from '../stores/redaction.store';
import PiiWorker from '../workers/pii-detection.worker.ts?worker';

function createPiiWorker() {
  return new PiiWorker();
}

export function usePiiDetection() {
  const { run, cancel, progress, stage, status, error, result } =
    useWorker<PiiDetectionConfig, PiiDetectionResult>(createPiiWorker);
  const setDetectedItems = useRedactionStore((s) => s.setDetectedItems);

  useEffect(() => {
    if (result) {
      setDetectedItems(result);
    }
  }, [result, setDetectedItems]);

  const detect = useCallback(
    (text: string, customTerms: string[] = [], enabledTypes?: PiiType[]) => {
      run({ text, customTerms, enabledTypes });
    },
    [run]
  );

  return { detect, cancel, progress, stage, status, error };
}
