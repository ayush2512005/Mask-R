import { type Dispatch, type SetStateAction, useCallback, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { FaceTracker } from '@/lib/face-tracker';
import type { BBox } from '@/lib/face-tracker';

export type VideoFaceStyle = 'blur' | 'pixelate' | 'black_box' | 'emoji' | 'sticker';
export type FacePartialMode = 'full' | 'eyes' | 'mouth';

export interface FaceTrajectoryPoint {
  time: number;
  bbox: BBox;
}

export interface FaceTimedRegion {
  id: string;
  faceId: string;
  label: string;
  startTime: number;
  endTime: number;
  style: VideoFaceStyle;
  partialMode: FacePartialMode;
  selected: boolean;
  trajectory: FaceTrajectoryPoint[];
}

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
} {
  const [detecting, setDetecting] = useState(false);
  const [detectProgress, setDetectProgress] = useState(0);
  const [faceRegions, setFaceRegions] = useState<FaceTimedRegion[]>([]);
  const abortRef = useRef(false);

  const hasFaceDetector = typeof window !== 'undefined' && 'FaceDetector' in window;

  const detectFaces = useCallback(
    async (sampleInterval = 0.5) => {
      const v = videoRef.current;
      if (!v || !hasFaceDetector || duration <= 0) return;

      setDetecting(true);
      setDetectProgress(0);
      setFaceRegions([]);
      abortRef.current = false;

      const vw = v.videoWidth || 1280;
      const vh = v.videoHeight || 720;
      const canvas = document.createElement('canvas');
      canvas.width = vw;
      canvas.height = vh;
      const ctx = canvas.getContext('2d')!;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detector = new (window as any).FaceDetector({ maxDetectedFaces: 20, fastMode: true });
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

        v.currentTime = t;
        await new Promise<void>((resolve) => {
          const h = () => { v.removeEventListener('seeked', h); resolve(); };
          v.addEventListener('seeked', h);
        });

        ctx.drawImage(v, 0, 0, vw, vh);

        let faces: Array<{ boundingBox: DOMRectReadOnly }> = [];
        try {
          faces = (await (detector.detect(canvas) as Promise<Array<{ boundingBox: DOMRectReadOnly }>>));
        } catch {
          // Low-quality frame or unsupported — skip
        }

        const detections = faces.map((f) => ({
          boundingBox: {
            x: f.boundingBox.x,
            y: f.boundingBox.y,
            width: f.boundingBox.width,
            height: f.boundingBox.height,
          },
        }));

        const activeTracks = tracker.update(detections);
        for (const track of activeTracks) {
          if (!trajectories.has(track.id)) {
            trajectories.set(track.id, { label: track.label, points: [] });
          }
          trajectories.get(track.id)?.points.push({ time: t, bbox: { ...track.bbox } });
        }

        setDetectProgress(Math.round(((i + 1) / sampleTimes.length) * 100));
      }

      if (wasPlaying) void v.play();

      const regions: FaceTimedRegion[] = [];
      for (const [trackId, { label, points }] of trajectories) {
        if (points.length === 0) continue;
        regions.push({
          id: uuidv4(),
          faceId: trackId,
          label,
          startTime: points[0]!.time,
          endTime: points[points.length - 1]!.time,
          style: 'blur',
          partialMode: 'full',
          selected: true,
          trajectory: points,
        });
      }

      setFaceRegions(regions);
      setDetecting(false);
    },
    [videoRef, duration, hasFaceDetector],
  );

  return { detecting, detectProgress, faceRegions, setFaceRegions, detectFaces, hasFaceDetector };
}
