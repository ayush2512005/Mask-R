import { useCallback } from 'react';
import { useWorker } from './useWorker';
import type { ImageProcessConfig, ImageProcessResult } from '../workers/image-processor.worker';
import ImageWorker from '../workers/image-processor.worker.ts?worker';

function createImageWorker() {
  return new ImageWorker();
}

export function useImageProcessor() {
  const worker = useWorker<ImageProcessConfig, ImageProcessResult>(createImageWorker);

  const extractText = useCallback(
    (buffer: ArrayBuffer) => {
      worker.run({ buffer, action: 'extract-text' });
    },
    [worker]
  );

  return { ...worker, extractText };
}

// Separate hook so face detection and OCR can run concurrently
export function useImageFaceDetector() {
  const worker = useWorker<ImageProcessConfig, ImageProcessResult>(createImageWorker);

  const detectFaces = useCallback(
    (buffer: ArrayBuffer) => {
      worker.run({ buffer, action: 'detect-faces' });
    },
    [worker]
  );

  return { ...worker, detectFaces };
}
