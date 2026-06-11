import type { WorkerMessage, WorkerResponse } from '../hooks/useWorker';
import type { PiiItem } from '@redact/shared';
import { PiiType } from '@redact/shared';
import { runDetection, ALL_PII_TYPES } from '../lib/pii-detector';

export interface PiiDetectionConfig {
  text: string;
  customTerms?: string[];
  enabledTypes?: PiiType[];
}

export type PiiDetectionResult = PiiItem[];

type InMessage = WorkerMessage<PiiDetectionConfig>;
type OutMessage = WorkerResponse<PiiDetectionResult>;

const post = (msg: OutMessage) => self.postMessage(msg);

self.onmessage = ({ data }: MessageEvent<InMessage>) => {
  if (data.type === 'CANCEL') return;

  const { text, customTerms = [], enabledTypes = ALL_PII_TYPES } = data.payload;

  try {
    post({ type: 'PROGRESS', payload: { pct: 10, stage: 'Scanning for emails and phones...' } });

    const items = runDetection(text, customTerms, enabledTypes);

    post({ type: 'PROGRESS', payload: { pct: 90, stage: 'Finalizing results...' } });
    post({ type: 'COMPLETE', payload: items });
  } catch (err) {
    post({
      type: 'ERROR',
      payload: {
        code: 'PII_DETECTION_FAILED',
        message: err instanceof Error ? err.message : 'PII detection failed',
      },
    });
  }
};
