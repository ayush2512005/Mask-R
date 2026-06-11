export type BBox = { x: number; y: number; width: number; height: number };

export interface Detection {
  boundingBox: BBox;
}

export interface TrackedFace {
  id: string;
  label: string;
  bbox: BBox;
  lastSeenFrame: number;
  missedFrames: number;
}

const MAX_MISSED_FRAMES = 30;
const IOU_THRESHOLD = 0.3;
const LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function iou(a: BBox, b: BBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  if (intersection === 0) return 0;
  const union = a.width * a.height + b.width * b.height - intersection;
  return union === 0 ? 0 : intersection / union;
}

// Simplified IoU-based multi-object tracker (DeepSORT-lite).
// Handles occlusion up to MAX_MISSED_FRAMES before dropping a track.
export class FaceTracker {
  private tracks: TrackedFace[] = [];
  private nextIdx = 0;
  private frameNum = 0;

  update(detections: Detection[]): TrackedFace[] {
    this.frameNum++;
    const matchedDetections = new Set<number>();

    // Greedy IoU matching: assign each track to its best-matching detection
    for (const track of this.tracks) {
      let bestScore = IOU_THRESHOLD;
      let bestIdx = -1;
      for (let i = 0; i < detections.length; i++) {
        if (matchedDetections.has(i)) continue;
        const score = iou(track.bbox, detections[i]!.boundingBox);
        if (score > bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }
      if (bestIdx >= 0) {
        track.bbox = { ...detections[bestIdx]!.boundingBox };
        track.lastSeenFrame = this.frameNum;
        track.missedFrames = 0;
        matchedDetections.add(bestIdx);
      } else {
        track.missedFrames++;
      }
    }

    // Drop tracks occluded longer than the allowed window
    this.tracks = this.tracks.filter((t) => t.missedFrames <= MAX_MISSED_FRAMES);

    // Spawn new tracks for unmatched detections
    for (let i = 0; i < detections.length; i++) {
      if (matchedDetections.has(i)) continue;
      const letter = LABELS[this.nextIdx % LABELS.length] ?? String(this.nextIdx + 1);
      this.tracks.push({
        id: `track-${this.nextIdx}`,
        label: `Person ${letter}`,
        bbox: { ...detections[i]!.boundingBox },
        lastSeenFrame: this.frameNum,
        missedFrames: 0,
      });
      this.nextIdx++;
    }

    return this.tracks.filter((t) => t.missedFrames === 0);
  }
}
