import type { WorkerMessage, WorkerResponse } from '../hooks/useWorker';

export interface ImageProcessConfig {
  buffer: ArrayBuffer;
  action: 'extract-text' | 'detect-faces';
}

export interface OcrWord {
  text: string;
  bbox: { x: number; y: number; width: number; height: number };
}

export interface FaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageProcessResult {
  text?: string;
  words?: OcrWord[];
  faces?: FaceBox[];
}

type InMessage = WorkerMessage<ImageProcessConfig>;
type OutMessage = WorkerResponse<ImageProcessResult>;

const post = (msg: OutMessage) => self.postMessage(msg);

async function extractTextFromImage(buffer: ArrayBuffer): Promise<ImageProcessResult> {
  const Tesseract = await import('tesseract.js');
  const result = await Tesseract.recognize(buffer, 'eng', {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        post({ type: 'PROGRESS', payload: { pct: Math.round(m.progress * 100), stage: 'Extracting text...' } });
      }
    },
  });

  const words = result.data.words.map((w) => ({
    text: w.text,
    bbox: {
      x: w.bbox.x0,
      y: w.bbox.y0,
      width: w.bbox.x1 - w.bbox.x0,
      height: w.bbox.y1 - w.bbox.y0,
    },
  }));

  return { text: result.data.text, words };
}

async function detectFacesInImage(buffer: ArrayBuffer): Promise<FaceBox[]> {
  // Uses the Chrome Shape Detection API (FaceDetector).
  // Available in Chrome 57+ workers and secure contexts; silently returns [] elsewhere.
  if (!('FaceDetector' in self)) return [];
  try {
    const blob = new Blob([buffer]);
    const bitmap = await createImageBitmap(blob);
    const detector = new (self as unknown as { FaceDetector: new (o?: object) => { detect(img: ImageBitmap): Promise<Array<{ boundingBox: DOMRectReadOnly }>> } }).FaceDetector({
      maxDetectedFaces: 30,
      fastMode: false,
    });
    const faces = await detector.detect(bitmap);
    bitmap.close();
    return faces.map((f) => ({
      x: f.boundingBox.x,
      y: f.boundingBox.y,
      width: f.boundingBox.width,
      height: f.boundingBox.height,
    }));
  } catch {
    return [];
  }
}

self.onmessage = async ({ data }: MessageEvent<InMessage>) => {
  if (data.type === 'CANCEL') return;

  const { buffer, action } = data.payload;

  try {
    if (action === 'extract-text') {
      post({ type: 'PROGRESS', payload: { pct: 5, stage: 'Initializing OCR...' } });
      const result = await extractTextFromImage(buffer);
      post({ type: 'COMPLETE', payload: result });
    } else if (action === 'detect-faces') {
      post({ type: 'PROGRESS', payload: { pct: 10, stage: 'Scanning for faces...' } });
      const faces = await detectFacesInImage(buffer);
      post({ type: 'COMPLETE', payload: { faces } });
    }
  } catch (err) {
    post({
      type: 'ERROR',
      payload: {
        code: 'IMAGE_PROCESSING_FAILED',
        message: err instanceof Error ? err.message : 'Image processing failed',
      },
    });
  }
};
