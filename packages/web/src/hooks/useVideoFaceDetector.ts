import { type Dispatch, type SetStateAction, useCallback, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { FaceTracker } from '@/lib/face-tracker';
import type { BBox } from '@/lib/face-tracker';
import { getFaceDetector, runFaceDetection, type MediaPipeFaceDetector } from '@/lib/face-detector.service';

// ─── Public types ─────────────────────────────────────────────────────────────

export type VideoFaceStyle = 'blur' | 'pixelate' | 'black_box' | 'emoji' | 'sticker' | 'face_swap';
export type FacePartialMode = 'full' | 'eyes' | 'mouth';

export interface FaceTrajectoryPoint {
  time: number;
  bbox: BBox;
}

/** One tracked individual's complete masking spec for the video. */
export interface FaceTimedRegion {
  id: string;
  faceId: string;       // stable track ID from FaceTracker
  label: string;        // "Person A", "Person B", …
  startTime: number;
  endTime: number;
  style: VideoFaceStyle;
  partialMode: FacePartialMode;
  selected: boolean;    // false = opted out (Selective Face Unblur)
  trajectory: FaceTrajectoryPoint[];
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Story 5.3 — Auto Face Blur: one-click detection scanning every `sampleInterval`
 *   seconds across the full video duration, with a progress counter.
 * Story 5.4 — Persistent Face Tracking: IoU-based DeepSORT-lite tracker
 *   (face-tracker.ts) assigns stable IDs and survives up to 30 occluded frames.
 * Story 5.5 — Style Wardrobe: each FaceTimedRegion carries an independent style
 *   field consumed by VideoEditor's applyFaceStyle().
 *
 * Detection engine priority:
 *   1. Chrome Shape Detection API (FaceDetector) — native, zero latency, no CDN
 *   2. MediaPipe BlazeFace (tasks-vision) — reliable cross-browser fallback
 */
export function useVideoFaceDetector(
  videoRef: { readonly current: HTMLVideoElement | null },
  duration: number,
): {
  detecting: boolean;
  detectProgress: number;
  faceRegions: FaceTimedRegion[];
  setFaceRegions: Dispatch<SetStateAction<FaceTimedRegion[]>>;
  detectFaces: (sampleInterval?: number) => Promise<void>;
  hasFaceDetector: boolean;
  faceDetectError: string | null;
} {
  const [detecting, setDetecting] = useState(false);
  const [detectProgress, setDetectProgress] = useState(0);
  const [faceRegions, setFaceRegions] = useState<FaceTimedRegion[]>([]);
  const [faceDetectError, setFaceDetectError] = useState<string | null>(null);
  const abortRef = useRef(false);

  // MediaPipe is always available once loaded; always advertise as supported.
  const hasFaceDetector = true;

  const detectFaces = useCallback(
    async (sampleInterval = 0.5) => {
      const v = videoRef.current;
      if (!v || duration <= 0) return;

      setDetecting(true);
      setDetectProgress(0);
      setFaceRegions([]);
      setFaceDetectError(null);
      abortRef.current = false;

      const vw = v.videoWidth || 1280;
      const vh = v.videoHeight || 720;

      // Off-screen canvas to capture frames for detection
      const canvas = document.createElement('canvas');
      canvas.width = vw;
      canvas.height = vh;
      const ctx = canvas.getContext('2d')!;

      // ── Detector selection ────────────────────────────────────────────────
      // Prefer Chrome's native Shape Detection API (synchronous, no CDN needed).
      // Fall back to MediaPipe BlazeFace when the native API is unavailable
      // (Windows/Linux desktop Chrome without the experimental-web-platform flag).

      type ChromeDetector = { detect(src: HTMLCanvasElement): Promise<Array<{ boundingBox: DOMRectReadOnly }>> };
      let chromeDetector: ChromeDetector | null = null;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const NativeFaceDetector = (window as any).FaceDetector as (new (opts: object) => ChromeDetector) | undefined;
      if (NativeFaceDetector) {
        try {
          chromeDetector = new NativeFaceDetector({ maxDetectedFaces: 20, fastMode: true });
        } catch {
          chromeDetector = null;
        }
      }

      // Load MediaPipe only when Chrome API is not available
      let mpDetector: MediaPipeFaceDetector | null = null;
      if (!chromeDetector) {
        try {
          setDetectProgress(0);
          mpDetector = await getFaceDetector();
        } catch (err) {
          const detail =
            err instanceof Error
              ? err.message
              : typeof err === 'string'
              ? err
              : err != null
              ? JSON.stringify(err)
              : 'unknown error';
          setFaceDetectError(`Face detector failed to load: ${detail}`);
          setDetecting(false);
          return;
        }
      }

      if (abortRef.current) { setDetecting(false); return; }

      // ── Frame sampling ────────────────────────────────────────────────────
      const tracker = new FaceTracker();
      const sampleTimes: number[] = [];
      for (let t = 0; t <= duration; t += sampleInterval) {
        sampleTimes.push(Math.min(t, duration));
      }

      const trajectories = new Map<string, { label: string; points: FaceTrajectoryPoint[] }>();
      const wasPlaying = !v.paused;
      if (wasPlaying) v.pause();

      for (let i = 0; i < sampleTimes.length; i++) {
        if (abortRef.current) break;
        const t = sampleTimes[i]!;

        // Seek to sample time
        v.currentTime = t;
        await new Promise<void>((resolve) => {
          const h = () => { v.removeEventListener('seeked', h); resolve(); };
          v.addEventListener('seeked', h);
        });

        ctx.drawImage(v, 0, 0, vw, vh);

        // Detect faces in this frame
        let bboxes: BBox[] = [];
        try {
          if (chromeDetector) {
            const faces = await chromeDetector.detect(canvas);
            bboxes = faces.map((f) => ({
              x: f.boundingBox.x,
              y: f.boundingBox.y,
              width: f.boundingBox.width,
              height: f.boundingBox.height,
            }));
          } else if (mpDetector) {
            bboxes = runFaceDetection(mpDetector, canvas);
          }
        } catch {
          // Unreadable frame — skip without aborting the whole scan
        }

        // Story 5.4: feed detections into the IoU tracker
        const detections = bboxes.map((bb) => ({ boundingBox: bb }));
        const activeTracks = tracker.update(detections);
        for (const track of activeTracks) {
          if (!trajectories.has(track.id)) {
            trajectories.set(track.id, { label: track.label, points: [] });
          }
          trajectories.get(track.id)!.points.push({ time: t, bbox: { ...track.bbox } });
        }

        setDetectProgress(Math.round(((i + 1) / sampleTimes.length) * 100));
      }

      if (wasPlaying) void v.play();

      // Build FaceTimedRegion list — one entry per tracked individual
      const regions: FaceTimedRegion[] = [];
      for (const [trackId, { label, points }] of trajectories) {
        if (points.length === 0) continue;
        regions.push({
          id: uuidv4(),
          faceId: trackId,
          label,
          startTime: points[0]!.time,
          endTime: points[points.length - 1]!.time,
          style: 'blur',       // Story 5.5 default; user can change per face
          partialMode: 'full', // Story 5.6 default
          selected: true,      // Story 5.3: pre-selected (opt-out model)
          trajectory: points,
        });
      }

      setFaceRegions(regions);
      setDetecting(false);
    },
    [videoRef, duration],
  );

  return { detecting, detectProgress, faceRegions, setFaceRegions, detectFaces, hasFaceDetector, faceDetectError };
}
