/**
 * Live Object Detection Engine — Story 6.1 (FR-28)
 *
 * Uses canvas ImageData heuristics for card and plate detection, and Chrome's
 * built-in FaceDetector API (Shape Detection API) for face detection where
 * available, with a skin-tone blob fallback.
 *
 * Production replacement: swap the heuristic functions for a WASM-compiled
 * YOLO-family model loaded via TF.js — the interface stays identical.
 */

export type DetectionObjectType = 'face' | 'card' | 'plate' | 'document';

export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectedObject {
  type: DetectionObjectType;
  bbox: BBox;
  confidence: number;
  label: string;
  notification: string;
}

// ─── Frame confirmation buffer ────────────────────────────────────────────────
// Require an object to appear in this many consecutive detection passes
// before it is considered "confirmed" and triggers a notification.
const CONFIRM_FRAMES = 2;

interface ConfirmState {
  count: number;
  notified: boolean;
  lastNotifiedAt: number;
}

const NOTIFICATION_COOLDOWN_MS = 5_000;

// ─── LiveDetector class ───────────────────────────────────────────────────────

export class LiveDetector {
  private nativeFaceDetector: FaceDetector | null = null;
  private nativeFaceSupported = false;
  private detectionCanvas: HTMLCanvasElement;
  private detectionCtx: CanvasRenderingContext2D;

  // Frame-confirmation state per detection type
  private confirmState = new Map<string, ConfirmState>();
  private frameCounter = 0;

  constructor() {
    // Small internal canvas for detection (faster ImageData reads)
    this.detectionCanvas = document.createElement('canvas');
    this.detectionCanvas.width = 320;
    this.detectionCanvas.height = 180;
    this.detectionCtx = this.detectionCanvas.getContext('2d', { willReadFrequently: true })!;
  }

  async init(): Promise<void> {
    // Chrome's built-in FaceDetector (Shape Detection API)
    // Available on Android Chrome by default; desktop requires experimental flag.
    // Falls back silently if unavailable.
    if (typeof FaceDetector !== 'undefined') {
      try {
        this.nativeFaceDetector = new FaceDetector({ maxDetectedFaces: 8, fastMode: true });
        // Warm-up call to verify it actually works on this platform
        const testCanvas = document.createElement('canvas');
        testCanvas.width = 2; testCanvas.height = 2;
        await this.nativeFaceDetector.detect(testCanvas);
        this.nativeFaceSupported = true;
      } catch {
        this.nativeFaceSupported = false;
        this.nativeFaceDetector = null;
      }
    }
  }

  /**
   * Detect objects in the current frame of a video element.
   * Returns only newly-confirmed detections that should trigger notifications.
   */
  async detectFrame(video: HTMLVideoElement): Promise<DetectedObject[]> {
    if (video.readyState < 2 || video.videoWidth === 0) return [];

    // Only run detection every 3rd frame to stay within CPU budget (FR-28: <10% CPU)
    this.frameCounter = (this.frameCounter + 1) % 3;
    if (this.frameCounter !== 0) return [];

    // Downscale to detection canvas for fast ImageData analysis
    this.detectionCtx.drawImage(video, 0, 0, 320, 180);
    const imageData = this.detectionCtx.getImageData(0, 0, 320, 180);

    const raw: DetectedObject[] = [];

    // Story 6.1: face detection (FR-28)
    const faces = await this.detectFaces(imageData);
    raw.push(...faces);

    // Story 6.2: card detection (FR-29)
    const cards = detectCards(imageData);
    raw.push(...cards);

    // Story 6.3: plate detection (FR-30)
    const plates = detectPlates(imageData);
    raw.push(...plates);

    // Story 6.5: document/whiteboard detection (FR-32)
    const docs = detectDocuments(imageData);
    raw.push(...docs);

    // Non-maximum suppression within each type
    const suppressed = nms(raw, 0.35);

    // Scale bboxes back to video dimensions
    const scaleX = video.videoWidth / 320;
    const scaleY = video.videoHeight / 180;
    for (const det of suppressed) {
      det.bbox.x *= scaleX;
      det.bbox.y *= scaleY;
      det.bbox.width *= scaleX;
      det.bbox.height *= scaleY;
    }

    return this.confirmAndFilter(suppressed);
  }

  // ── Face detection ──────────────────────────────────────────────────────────

  private async detectFaces(imageData: ImageData): Promise<DetectedObject[]> {
    // Prefer native FaceDetector (Shape Detection API)
    if (this.nativeFaceDetector && this.nativeFaceSupported) {
      try {
        const bitmap = await createImageBitmap(this.detectionCanvas);
        const faces = await this.nativeFaceDetector.detect(bitmap);
        bitmap.close();
        return faces.map((f) => ({
          type: 'face' as DetectionObjectType,
          bbox: {
            x: f.boundingBox.x,
            y: f.boundingBox.y,
            width: f.boundingBox.width,
            height: f.boundingBox.height,
          },
          confidence: 0.88,
          label: 'Face',
          notification: 'Face detected in camera feed.',
        }));
      } catch {
        this.nativeFaceSupported = false;
      }
    }

    // Fallback: skin-tone blob detection (Kovac et al., 2003 RGB model)
    return detectFacesSkinTone(imageData);
  }

  // ── Frame confirmation / notification debounce ──────────────────────────────

  private confirmAndFilter(detections: DetectedObject[]): DetectedObject[] {
    const now = Date.now();
    const confirmed: DetectedObject[] = [];
    const seenKeys = new Set<string>();

    for (const det of detections) {
      // Key per type (not per bbox — we want stable per-type confirmation)
      const key = det.type;
      seenKeys.add(key);

      let state = this.confirmState.get(key);
      if (!state) {
        state = { count: 0, notified: false, lastNotifiedAt: 0 };
        this.confirmState.set(key, state);
      }

      state.count++;

      if (state.count >= CONFIRM_FRAMES) {
        const cooldownExpired = now - state.lastNotifiedAt > NOTIFICATION_COOLDOWN_MS;
        if (cooldownExpired) {
          state.lastNotifiedAt = now;
          confirmed.push(det);
        }
      }
    }

    // Reset counters for types not seen this frame
    for (const [key, state] of this.confirmState.entries()) {
      if (!seenKeys.has(key)) state.count = 0;
    }

    return confirmed;
  }

  /** All detections in this frame (for overlay display, regardless of confirmation). */
  async detectFrameForOverlay(video: HTMLVideoElement): Promise<DetectedObject[]> {
    if (video.readyState < 2 || video.videoWidth === 0) return [];
    this.detectionCtx.drawImage(video, 0, 0, 320, 180);
    const imageData = this.detectionCtx.getImageData(0, 0, 320, 180);

    const raw: DetectedObject[] = [];
    const faces = await this.detectFaces(imageData);
    raw.push(...faces, ...detectCards(imageData), ...detectPlates(imageData), ...detectDocuments(imageData));

    const suppressed = nms(raw, 0.35);
    const scaleX = video.videoWidth / 320;
    const scaleY = video.videoHeight / 180;
    for (const det of suppressed) {
      det.bbox.x *= scaleX;
      det.bbox.y *= scaleY;
      det.bbox.width *= scaleX;
      det.bbox.height *= scaleY;
    }
    return suppressed;
  }
}

// ─── Document/whiteboard detection (Story 6.5, FR-32) ────────────────────────
// Detects large, predominantly light rectangular regions with moderate edge
// density — the visual signature of a document page or whiteboard.
// Visual pattern only; no OCR is performed.

const DOC_MIN_WIDTH_FRAC = 0.20;
const DOC_BRIGHTNESS_THRESHOLD = 140;
const DOC_EDGE_DENSITY_MIN = 0.06;
const DOC_EDGE_DENSITY_MAX = 0.52;

interface DocAR { ar: number; tol: number; name: string }

const DOC_AR_CONFIGS: DocAR[] = [
  { ar: 0.707, tol: 0.15, name: 'Document (portrait)' },  // A4 / Letter portrait
  { ar: 1.414, tol: 0.20, name: 'Document (landscape)' }, // A4 / Letter landscape
  { ar: 2.00,  tol: 0.55, name: 'Whiteboard' },           // wide whiteboard/monitor
];

function detectDocuments(imageData: ImageData): DetectedObject[] {
  const { data, width, height } = imageData;
  const results: DetectedObject[] = [];
  const minW = Math.round(width * DOC_MIN_WIDTH_FRAC);
  const stride = Math.round(width * 0.10);

  for (const { ar, name } of DOC_AR_CONFIGS) {
    for (const scale of [0.25, 0.38, 0.52, 0.68]) {
      const docW = Math.round(width * scale);
      const docH = Math.round(docW / ar);
      if (docW < minW || docH < minW || docH > height) continue;

      for (let y = 0; y + docH <= height; y += stride) {
        for (let x = 0; x + docW <= width; x += stride) {
          const score = scoreDocRegion(data, width, x, y, docW, docH);
          if (score > 0) {
            results.push({
              type: 'document',
              bbox: { x, y, width: docW, height: docH },
              confidence: score,
              label: name,
              notification: 'Document visible in camera feed.',
            });
          }
        }
      }
    }
  }

  return nms(results, 0.40);
}

function scoreDocRegion(
  data: Uint8ClampedArray,
  frameWidth: number,
  x: number, y: number, w: number, h: number,
): number {
  let brightPx = 0, edgePx = 0, totalPx = 0;
  let prevLuma = -1;

  for (let dy = 0; dy < h; dy += 2) {
    for (let dx = 0; dx < w; dx += 2) {
      const idx = ((y + dy) * frameWidth + (x + dx)) * 4;
      const luma = (data[idx]! * 77 + data[idx + 1]! * 150 + data[idx + 2]! * 29) >> 8;
      if (luma > DOC_BRIGHTNESS_THRESHOLD) brightPx++;
      if (prevLuma >= 0 && Math.abs(luma - prevLuma) > 30) edgePx++;
      prevLuma = luma;
      totalPx++;
    }
    prevLuma = -1;
  }

  if (totalPx === 0) return 0;
  const brightRatio = brightPx / totalPx;
  const edgeDensity = edgePx / totalPx;

  if (brightRatio < 0.50) return 0;
  if (edgeDensity < DOC_EDGE_DENSITY_MIN || edgeDensity > DOC_EDGE_DENSITY_MAX) return 0;

  return Math.min(1.0, brightRatio * 0.35 + edgeDensity * 0.65);
}

// ─── Skin-tone face detection fallback ───────────────────────────────────────
// Based on the RGB model from Kovac, Peer & Solina (2003).
// Finds clusters of skin-tone pixels and groups them into bounding boxes.

function isSkinTone(r: number, g: number, b: number): boolean {
  return (
    r > 95 && g > 40 && b > 20 &&
    r - Math.min(g, b) > 15 &&
    Math.abs(r - g) > 15 &&
    r > g && r > b &&
    r < 250  // avoid blown-out highlights
  );
}

function detectFacesSkinTone(imageData: ImageData): DetectedObject[] {
  const { data, width, height } = imageData;
  // Grid-based approach: divide into 8×8 blocks, check skin-tone ratio
  const blockSize = 8;
  const cols = Math.floor(width / blockSize);
  const rows = Math.floor(height / blockSize);
  const skinGrid: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let skinPx = 0;
      const total = blockSize * blockSize;
      for (let dy = 0; dy < blockSize; dy++) {
        for (let dx = 0; dx < blockSize; dx++) {
          const px = ((row * blockSize + dy) * width + (col * blockSize + dx)) * 4;
          if (isSkinTone(data[px]!, data[px + 1]!, data[px + 2]!)) skinPx++;
        }
      }
      skinGrid[row]![col] = skinPx / total > 0.45;
    }
  }

  // Find connected skin regions using flood fill
  const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
  const regions: { minR: number; maxR: number; minC: number; maxC: number }[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!skinGrid[r]![c] || visited[r]![c]) continue;
      // BFS
      const queue: [number, number][] = [[r, c]];
      let minR = r, maxR = r, minC = c, maxC = c;
      while (queue.length) {
        const [cr, cc] = queue.shift()!;
        if (cr < 0 || cr >= rows || cc < 0 || cc >= cols) continue;
        if (visited[cr]![cc] || !skinGrid[cr]![cc]) continue;
        visited[cr]![cc] = true;
        minR = Math.min(minR, cr); maxR = Math.max(maxR, cr);
        minC = Math.min(minC, cc); maxC = Math.max(maxC, cc);
        queue.push([cr - 1, cc], [cr + 1, cc], [cr, cc - 1], [cr, cc + 1]);
      }
      const bW = (maxC - minC + 1) * blockSize;
      const bH = (maxR - minR + 1) * blockSize;
      // Filter: face regions should be roughly portrait-ish AR and not too small
      if (bW >= 24 && bH >= 24 && bH / bW >= 0.6 && bH / bW <= 2.0) {
        regions.push({ minR, maxR, minC, maxC });
      }
    }
  }

  return regions.map((reg) => ({
    type: 'face' as DetectionObjectType,
    bbox: {
      x: reg.minC * blockSize,
      y: reg.minR * blockSize,
      width: (reg.maxC - reg.minC + 1) * blockSize,
      height: (reg.maxR - reg.minR + 1) * blockSize,
    },
    confidence: 0.6,
    label: 'Face',
    notification: 'Face detected in camera feed.',
  }));
}

// ─── Card detection (Story 6.2, FR-29) ───────────────────────────────────────
// Credit/debit cards: AR ≈ 85.6×54mm = 1.586:1, very bright (white/metallic),
// uniformly lit rectangular region.
//
// Production replacement: custom YOLO-family ONNX model (NFR-2: <200ms detection).

const CARD_AR_MIN = 1.30;
const CARD_AR_MAX = 1.85;
const CARD_MIN_WIDTH_FRAC = 0.14;  // card must be ≥14% of frame width
const CARD_BRIGHTNESS_THRESHOLD = 165;
const CARD_UNIFORMITY_THRESHOLD = 0.72; // fraction of bright pixels

function detectCards(imageData: ImageData): DetectedObject[] {
  const { data, width, height } = imageData;
  const results: DetectedObject[] = [];
  const minW = Math.round(width * CARD_MIN_WIDTH_FRAC);

  const scales = [0.18, 0.24, 0.30, 0.38];
  const stride = Math.round(width * 0.07);

  for (const scale of scales) {
    const cardW = Math.round(width * scale);
    const cardH = Math.round(cardW / 1.586);
    if (cardW < minW || cardH < 10) continue;

    for (let y = 0; y + cardH <= height; y += stride) {
      for (let x = 0; x + cardW <= width; x += stride) {
        const score = scoreCardRegion(data, width, x, y, cardW, cardH);
        if (score >= CARD_UNIFORMITY_THRESHOLD) {
          results.push({
            type: 'card',
            bbox: { x, y, width: cardW, height: cardH },
            confidence: score,
            label: 'Payment Card',
            notification: 'Payment card detected and hidden.',
          });
        }
      }
    }
  }

  return nms(results, 0.4);
}

function scoreCardRegion(
  data: Uint8ClampedArray,
  frameWidth: number,
  x: number, y: number, w: number, h: number,
): number {
  let brightPx = 0;
  let totalPx = 0;

  // Sample every other pixel for speed
  for (let dy = 0; dy < h; dy += 2) {
    for (let dx = 0; dx < w; dx += 2) {
      const idx = ((y + dy) * frameWidth + (x + dx)) * 4;
      const r = data[idx]!;
      const g = data[idx + 1]!;
      const b = data[idx + 2]!;
      const brightness = (r * 77 + g * 150 + b * 29) >> 8; // fast luminance
      if (brightness > CARD_BRIGHTNESS_THRESHOLD) brightPx++;
      totalPx++;
    }
  }

  return totalPx > 0 ? brightPx / totalPx : 0;
}

// ─── License plate detection (Story 6.3, FR-30) ──────────────────────────────
// Plate formats:
//   US:    30×15cm = 2.0:1
//   EU/UK: 52×11cm = 4.73:1
//   IN:    34.5×15cm = 2.3:1
// All plates: high contrast (dark text on light bg or light text on dark bg),
// moderate edge density from text characters.
//
// Production replacement: region-specific YOLO model per locale.

interface PlateFormat {
  ar: number;
  tolerance: number;
  name: string;
}

const PLATE_FORMATS: PlateFormat[] = [
  { ar: 2.0, tolerance: 0.4, name: 'US' },
  { ar: 4.73, tolerance: 0.8, name: 'EU/UK' },
  { ar: 2.3, tolerance: 0.4, name: 'IN' },
];
const PLATE_MIN_WIDTH_FRAC = 0.06;
const PLATE_CONTRAST_THRESHOLD = 0.55;
const PLATE_EDGE_DENSITY_MIN = 0.10;
const PLATE_EDGE_DENSITY_MAX = 0.55;

function detectPlates(imageData: ImageData): DetectedObject[] {
  const { data, width, height } = imageData;
  const results: DetectedObject[] = [];
  const minW = Math.round(width * PLATE_MIN_WIDTH_FRAC);
  const stride = Math.round(width * 0.06);

  for (const fmt of PLATE_FORMATS) {
    const scales = [0.08, 0.12, 0.17, 0.22];
    for (const scale of scales) {
      const plateW = Math.round(width * scale);
      const plateH = Math.round(plateW / fmt.ar);
      if (plateW < minW || plateH < 6) continue;

      for (let y = 0; y + plateH <= height; y += stride) {
        for (let x = 0; x + plateW <= width; x += stride) {
          const score = scorePlateRegion(data, width, x, y, plateW, plateH);
          if (score >= PLATE_CONTRAST_THRESHOLD) {
            results.push({
              type: 'plate',
              bbox: { x, y, width: plateW, height: plateH },
              confidence: score,
              label: `License Plate (${fmt.name})`,
              notification: 'Vehicle plate detected and hidden.',
            });
          }
        }
      }
    }
  }

  return nms(results, 0.35);
}

function scorePlateRegion(
  data: Uint8ClampedArray,
  frameWidth: number,
  x: number, y: number, w: number, h: number,
): number {
  let brightPx = 0, darkPx = 0, edgePx = 0;
  let totalPx = 0;
  let prevLuma = -1;

  for (let dy = 0; dy < h; dy += 2) {
    for (let dx = 0; dx < w; dx += 2) {
      const idx = ((y + dy) * frameWidth + (x + dx)) * 4;
      const r = data[idx]!;
      const g = data[idx + 1]!;
      const b = data[idx + 2]!;
      const luma = (r * 77 + g * 150 + b * 29) >> 8;

      if (luma > 180) brightPx++;
      if (luma < 75) darkPx++;
      if (prevLuma >= 0 && Math.abs(luma - prevLuma) > 45) edgePx++;
      prevLuma = luma;
      totalPx++;
    }
    prevLuma = -1; // reset at row boundary
  }

  if (totalPx === 0) return 0;
  const brightRatio = brightPx / totalPx;
  const darkRatio = darkPx / totalPx;
  const edgeDensity = edgePx / totalPx;

  // Must have contrast: significant light + dark pixels
  const hasContrast = (brightRatio > 0.30 && darkRatio > 0.08) ||
                       (brightRatio > 0.08 && darkRatio > 0.30);
  if (!hasContrast) return 0;

  // Must have text-like edge density
  if (edgeDensity < PLATE_EDGE_DENSITY_MIN || edgeDensity > PLATE_EDGE_DENSITY_MAX) return 0;

  return Math.min(1.0, (brightRatio + darkRatio) * 0.45 + edgeDensity * 0.55);
}

// ─── Non-maximum suppression ──────────────────────────────────────────────────

function iou(a: DetectedObject, b: DetectedObject): number {
  const ax2 = a.bbox.x + a.bbox.width;
  const ay2 = a.bbox.y + a.bbox.height;
  const bx2 = b.bbox.x + b.bbox.width;
  const by2 = b.bbox.y + b.bbox.height;
  const ix = Math.max(0, Math.min(ax2, bx2) - Math.max(a.bbox.x, b.bbox.x));
  const iy = Math.max(0, Math.min(ay2, by2) - Math.max(a.bbox.y, b.bbox.y));
  const intersection = ix * iy;
  const union = a.bbox.width * a.bbox.height + b.bbox.width * b.bbox.height - intersection;
  return union > 0 ? intersection / union : 0;
}

function nms(detections: DetectedObject[], iouThreshold: number): DetectedObject[] {
  const sorted = [...detections].sort((a, b) => b.confidence - a.confidence);
  const kept: DetectedObject[] = [];
  for (const det of sorted) {
    if (!kept.some((k) => k.type === det.type && iou(k, det) > iouThreshold)) {
      kept.push(det);
    }
  }
  return kept;
}
