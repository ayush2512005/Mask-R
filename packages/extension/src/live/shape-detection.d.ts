/**
 * Type declarations for the Chrome Shape Detection API (W3C draft).
 * Available in Chrome 70+; desktop requires experimental flag.
 * https://wicg.github.io/shape-detection-api/
 */

interface FaceDetectorOptions {
  maxDetectedFaces?: number;
  fastMode?: boolean;
}

interface DetectedFace {
  boundingBox: DOMRectReadOnly;
  landmarks?: { type: string; locations: DOMPointReadOnly[] }[];
}

declare class FaceDetector {
  constructor(options?: FaceDetectorOptions);
  detect(image: CanvasImageSource | ImageData | ImageBitmap): Promise<DetectedFace[]>;
}
