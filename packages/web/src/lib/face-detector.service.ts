// MediaPipe tasks-vision is loaded at runtime from CDN via a dynamic import
// tagged with @vite-ignore. This completely bypasses Vite's module bundler,
// which would otherwise rewrite the package's internal relative paths and
// break its WASM loading mechanism.
//
// Using a single CDN_BASE also guarantees that the JS runtime and the WASM
// binary come from the exact same package version, preventing the silent
// "unknown error" that occurs when a semver-range install resolves a newer
// minor version while the WASM URL still points at 0.10.22.

const CDN_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35';
const WASM_PATH = `${CDN_BASE}/wasm`;
const MODEL_PATH =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

// Minimal structural type — avoids a compile-time dependency on the npm package
// while still providing type-safe access to the APIs we actually call.
export interface MediaPipeFaceDetector {
  detect(source: HTMLCanvasElement | HTMLImageElement | HTMLVideoElement): {
    detections: Array<{
      boundingBox: { originX: number; originY: number; width: number; height: number } | null;
    }>;
  };
}

let singleton: MediaPipeFaceDetector | null = null;
let initPromise: Promise<MediaPipeFaceDetector> | null = null;

const DETECTOR_OPTIONS = {
  runningMode: 'IMAGE' as const,
  minDetectionConfidence: 0.5,
  minSuppressionThreshold: 0.3,
};

export async function getFaceDetector(): Promise<MediaPipeFaceDetector> {
  if (singleton) return singleton;
  if (!initPromise) {
    initPromise = (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod = await import(/* @vite-ignore */ `${CDN_BASE}/vision_bundle.mjs`) as any;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { FaceDetector: FD, FilesetResolver } = mod;

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const vision = await FilesetResolver.forVisionTasks(WASM_PATH);

      let detector: MediaPipeFaceDetector;
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        detector = await FD.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_PATH, delegate: 'GPU' },
          ...DETECTOR_OPTIONS,
        }) as MediaPipeFaceDetector;
      } catch {
        // GPU unavailable (no WebGPU/WebGL) — fall back to CPU
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        detector = await FD.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_PATH, delegate: 'CPU' },
          ...DETECTOR_OPTIONS,
        }) as MediaPipeFaceDetector;
      }

      singleton = detector;
      return detector;
    })().catch((err: unknown) => {
      initPromise = null; // allow retry on next call
      throw err;
    });
  }
  return initPromise;
}

export type FaceBBox = { x: number; y: number; width: number; height: number };

export function runFaceDetection(
  detector: MediaPipeFaceDetector,
  canvas: HTMLCanvasElement,
): FaceBBox[] {
  try {
    const { detections } = detector.detect(canvas);
    return detections
      .filter((d) => d.boundingBox != null)
      .map((d) => ({
        x: d.boundingBox!.originX,
        y: d.boundingBox!.originY,
        width: d.boundingBox!.width,
        height: d.boundingBox!.height,
      }));
  } catch {
    return [];
  }
}
