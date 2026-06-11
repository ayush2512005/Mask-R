import { useCallback } from 'react';
import { useWorker } from './useWorker';
import type { VideoProcessConfig, VideoProcessResult } from '../workers/video-processor.worker';
import VideoWorker from '../workers/video-processor.worker.ts?worker';

function createVideoWorker() {
  return new VideoWorker();
}

export function useVideoProcessor() {
  const worker = useWorker<VideoProcessConfig, VideoProcessResult>(createVideoWorker);

  const extractMetadata = useCallback(
    (buffer: ArrayBuffer, mimeType: string) => {
      worker.run({ buffer, mimeType, action: 'extract-metadata' });
    },
    [worker],
  );

  return { ...worker, extractMetadata };
}
