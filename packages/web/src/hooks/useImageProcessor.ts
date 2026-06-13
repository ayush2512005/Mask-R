import { useCallback, useState } from 'react';
import { useWorker } from './useWorker';
import type { ImageProcessConfig, ImageProcessResult } from '../workers/image-processor.worker';
import ImageWorker from '../workers/image-processor.worker.ts?worker';
import { getFaceDetector, runFaceDetection } from '@/lib/face-detector.service';

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

// Separate hook — runs on main thread via MediaPipe BlazeFace so it works
// cross-browser. The worker path used Chrome's experimental FaceDetector API
// which is disabled on most desktop Chrome builds.
export function useImageFaceDetector() {
  const [status, setStatus] = useState<'idle' | 'running' | 'complete' | 'error'>('idle');
  const [result, setResult] = useState<ImageProcessResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const detectFaces = useCallback((buffer: ArrayBuffer) => {
    setStatus('running');
    setProgress(10);
    setStage('Loading face detector…');
    setError(null);
    setResult(null);

    void (async () => {
      try {
        const detector = await getFaceDetector();

        setProgress(50);
        setStage('Detecting faces…');

        const blob = new Blob([buffer]);
        const bitmap = await createImageBitmap(blob);
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close();

        const faces = runFaceDetection(detector, canvas);
        setResult({ faces });
        setStatus('complete');
        setProgress(100);
        setStage('');
      } catch (err) {
        const detail =
          err instanceof Error ? err.message : typeof err === 'string' ? err : 'Face detection failed';
        setError(detail);
        setStatus('error');
      }
    })();
  }, []);

  return { status, result, progress, stage, error, detectFaces };
}
