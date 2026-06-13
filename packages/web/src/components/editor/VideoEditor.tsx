import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { MaskingStyle, VIDEO_SERVER_THRESHOLD_BYTES } from '@redact/shared';
import type { VideoRedactionConfig } from '@redact/shared';
import { useFileStore } from '@/stores/file.store';
import { useRedactionStore } from '@/stores/redaction.store';
import { Button } from '../ui/Button';
import { Progress } from '../ui/Progress';
import { Play, Pause, Download, Loader2, Trash2, Scan, Eye, EyeOff, Users, CloudUpload } from 'lucide-react';
import type { TimedRegion } from '@/workers/video-processor.worker';
import { useVideoFaceDetector } from '@/hooks/useVideoFaceDetector';
import type { FaceTimedRegion, VideoFaceStyle, FacePartialMode } from '@/hooks/useVideoFaceDetector';
import { useAudioRedactor } from '@/hooks/useAudioRedactor';
import { AudioRedactionPanel } from './AudioRedactionPanel';
import { useServerVideoProcessor } from '@/hooks/useServerVideoProcessor';
import { ServerVideoDisclosure } from './ServerVideoDisclosure';

// ─── Types & constants ────────────────────────────────────────────────────────

interface DrawState {
  startX: number; startY: number; currentX: number; currentY: number; active: boolean;
}

const FACE_STYLES: { value: VideoFaceStyle; label: string; title: string }[] = [
  { value: 'blur', label: 'Blur', title: 'Gaussian blur' },
  { value: 'pixelate', label: 'Pixel', title: 'Pixelate' },
  { value: 'black_box', label: '■', title: 'Black box' },
  { value: 'emoji', label: '😊', title: 'Emoji overlay' },
  { value: 'sticker', label: '🎭', title: 'Sticker overlay' },
  { value: 'face_swap', label: 'Swap', title: 'AI face swap — replace with a unique synthetic face' },
];

const PARTIAL_MODES: { value: FacePartialMode; label: string; title: string }[] = [
  { value: 'full', label: 'Full', title: 'Mask entire face' },
  { value: 'eyes', label: 'Eyes', title: 'Mask eyes only' },
  { value: 'mouth', label: 'Mouth', title: 'Mask mouth only' },
];

// ─── Pure helpers (module-level) ──────────────────────────────────────────────

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(2).padStart(5, '0');
  return `${String(m).padStart(2, '0')}:${sec}`;
}

function interpolateBbox(
  trajectory: FaceTimedRegion['trajectory'],
  t: number,
): { x: number; y: number; width: number; height: number } | null {
  if (trajectory.length === 0) return null;
  const first = trajectory[0]!;
  const last = trajectory[trajectory.length - 1]!;
  if (t <= first.time) return first.bbox;
  if (t >= last.time) return last.bbox;
  for (let i = 0; i < trajectory.length - 1; i++) {
    const a = trajectory[i]!;
    const b = trajectory[i + 1]!;
    if (t >= a.time && t <= b.time) {
      const span = b.time - a.time;
      const alpha = span === 0 ? 0 : (t - a.time) / span;
      return {
        x: a.bbox.x + (b.bbox.x - a.bbox.x) * alpha,
        y: a.bbox.y + (b.bbox.y - a.bbox.y) * alpha,
        width: a.bbox.width + (b.bbox.width - a.bbox.width) * alpha,
        height: a.bbox.height + (b.bbox.height - a.bbox.height) * alpha,
      };
    }
  }
  return last.bbox;
}

// Story 5.6: compute sub-region bbox for partial face mask
function computePartialBbox(
  bbox: { x: number; y: number; width: number; height: number },
  mode: FacePartialMode,
): { x: number; y: number; width: number; height: number } {
  if (mode === 'full') return bbox;
  if (mode === 'eyes') {
    return {
      x: bbox.x + bbox.width * 0.1,
      y: bbox.y + bbox.height * 0.2,
      width: bbox.width * 0.8,
      height: bbox.height * 0.32,
    };
  }
  // mouth
  return {
    x: bbox.x + bbox.width * 0.2,
    y: bbox.y + bbox.height * 0.62,
    width: bbox.width * 0.6,
    height: bbox.height * 0.25,
  };
}

// ─── Story 5.9: Smart Face Swap ───────────────────────────────────────────────

function hashFaceId(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  }
  return h;
}

function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 15), z | 1) | 0;
    z ^= z + (Math.imul(z ^ (z >>> 7), z | 61) | 0);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

function drawSyntheticFace(
  ctx: CanvasRenderingContext2D,
  faceId: string,
  bbox: { x: number; y: number; width: number; height: number },
): void {
  const rng = mulberry32(hashFaceId(faceId));
  const x = Math.round(bbox.x);
  const y = Math.round(bbox.y);
  const w = Math.round(bbox.width);
  const h = Math.round(bbox.height);
  if (w < 4 || h < 4) return;

  const cx = x + w / 2;
  const cy = y + h / 2;
  const rx = w * 0.44;
  const ry = h * 0.46;

  // Skin tone — warm flesh range (15–45°)
  const skinH = 15 + rng() * 30;
  const skinS = 35 + rng() * 25;
  const skinL = 52 + rng() * 22;

  // Face oval
  ctx.fillStyle = `hsl(${skinH},${skinS}%,${skinL}%)`;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  // Hair (upper half of face oval + extension)
  const darkHair = rng() > 0.35;
  const hairH = darkHair ? 20 + rng() * 20 : 35 + rng() * 20;
  const hairL = darkHair ? 10 + rng() * 20 : 55 + rng() * 20;
  ctx.fillStyle = `hsl(${hairH},25%,${hairL}%)`;
  ctx.beginPath();
  ctx.ellipse(cx, cy - ry * 0.28, rx * 1.02, ry * 0.68, 0, Math.PI, Math.PI * 2);
  ctx.fill();

  // Eyes
  const eyeY = cy - h * 0.07;
  const eyeXOff = w * 0.165;
  const erx = w * 0.095;
  const ery = h * 0.055;
  const irisH = 180 + rng() * 90;

  for (const ex of [cx - eyeXOff, cx + eyeXOff]) {
    ctx.fillStyle = '#f8f8f8';
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, erx, ery, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `hsl(${irisH},55%,32%)`;
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, erx * 0.62, ery * 0.78, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, erx * 0.27, ery * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.arc(ex + erx * 0.15, eyeY - ery * 0.2, erx * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }

  // Nose tip
  ctx.fillStyle = `hsl(${skinH - 3},${skinS * 0.7}%,${skinL * 0.78}%)`;
  ctx.beginPath();
  ctx.ellipse(cx, cy + h * 0.1, w * 0.06, h * 0.04, 0, 0, Math.PI * 2);
  ctx.fill();

  // Mouth
  const mouthY = cy + h * 0.26;
  const mw = w * 0.22;
  const smileD = h * 0.045;
  ctx.strokeStyle = `hsl(${skinH - 10},${skinS}%,${skinL * 0.62}%)`;
  ctx.lineWidth = Math.max(1.5, h * 0.022);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - mw, mouthY);
  ctx.quadraticCurveTo(cx, mouthY + smileD, cx + mw, mouthY);
  ctx.stroke();

  // Subtle face outline
  ctx.strokeStyle = `hsl(${skinH},${skinS}%,${skinL * 0.65}%)`;
  ctx.lineWidth = Math.max(0.5, Math.min(1.5, w * 0.008));
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
}

// ─────────────────────────────────────────────────────────────────────────────

function applyManualStyle(
  ctx: CanvasRenderingContext2D,
  v: HTMLVideoElement,
  style: MaskingStyle,
  bbox: { x: number; y: number; width: number; height: number },
): void {
  const { x, y, width, height } = bbox;
  if (style === MaskingStyle.BLUR) {
    ctx.filter = 'blur(12px)';
    ctx.drawImage(v, x, y, width, height, x, y, width, height);
    ctx.filter = 'none';
  } else if (style === MaskingStyle.PIXELATE) {
    const bw = Math.round(width);
    const bh = Math.round(height);
    if (bw <= 0 || bh <= 0) return;
    const blockSize = Math.max(6, Math.floor(bw / 12));
    const imgData = ctx.getImageData(Math.round(x), Math.round(y), bw, bh);
    const d = imgData.data;
    for (let py = 0; py < bh; py += blockSize) {
      for (let px = 0; px < bw; px += blockSize) {
        const idx = (py * bw + px) * 4;
        ctx.fillStyle = `rgb(${d[idx] ?? 0},${d[idx + 1] ?? 0},${d[idx + 2] ?? 0})`;
        ctx.fillRect(Math.round(x) + px, Math.round(y) + py, Math.min(blockSize, bw - px), Math.min(blockSize, bh - py));
      }
    }
  } else if (style === MaskingStyle.REDACTED_LABEL) {
    ctx.fillStyle = '#000';
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = '#fff';
    ctx.font = `${Math.max(12, height * 0.3)}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('[REDACTED]', x + width / 2, y + height / 2);
  } else {
    ctx.fillStyle = '#000';
    ctx.fillRect(x, y, width, height);
  }
}

function applyFaceStyle(
  ctx: CanvasRenderingContext2D,
  v: HTMLVideoElement,
  style: VideoFaceStyle,
  bbox: { x: number; y: number; width: number; height: number },
  faceId = '',
): void {
  const x = Math.round(bbox.x);
  const y = Math.round(bbox.y);
  const w = Math.round(bbox.width);
  const h = Math.round(bbox.height);
  if (w <= 0 || h <= 0) return;

  switch (style) {
    case 'blur':
      ctx.filter = 'blur(16px)';
      ctx.drawImage(v, x, y, w, h, x, y, w, h);
      ctx.filter = 'none';
      break;
    case 'pixelate': {
      const blockSize = Math.max(6, Math.floor(w / 12));
      const imgData = ctx.getImageData(x, y, w, h);
      const d = imgData.data;
      for (let py = 0; py < h; py += blockSize) {
        for (let px = 0; px < w; px += blockSize) {
          const idx = (py * w + px) * 4;
          ctx.fillStyle = `rgb(${d[idx] ?? 0},${d[idx + 1] ?? 0},${d[idx + 2] ?? 0})`;
          ctx.fillRect(x + px, y + py, Math.min(blockSize, w - px), Math.min(blockSize, h - py));
        }
      }
      break;
    }
    case 'black_box':
      ctx.fillStyle = '#000';
      ctx.fillRect(x, y, w, h);
      break;
    case 'emoji': {
      ctx.fillStyle = 'rgba(255,220,150,0.85)';
      ctx.fillRect(x, y, w, h);
      ctx.font = `${Math.max(16, Math.floor(h * 0.75))}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('😊', x + w / 2, y + h / 2);
      break;
    }
    case 'sticker': {
      ctx.fillStyle = 'rgba(255,240,0,0.7)';
      ctx.fillRect(x, y, w, h);
      ctx.font = `${Math.max(16, Math.floor(h * 0.75))}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🎭', x + w / 2, y + h / 2);
      break;
    }
    case 'face_swap':
      drawSyntheticFace(ctx, faceId, bbox);
      break;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function VideoEditor() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pendingRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timedRegions, setTimedRegions] = useState<TimedRegion[]>([]);
  const [drawing, setDrawing] = useState<DrawState | null>(null);
  const [pendingRegion, setPendingRegion] = useState<Omit<TimedRegion, 'startTime' | 'endTime'> | null>(null);
  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  // Story 5.7: background crowd blur
  const [bgCrowdBlurMode, setBgCrowdBlurMode] = useState(false);
  const [foregroundFaceId, setForegroundFaceId] = useState<string | null>(null);

  // Story 5.1: server-side path for videos >100 MB
  const [showDisclosure, setShowDisclosure] = useState(false);
  const serverProc = useServerVideoProcessor();

  // Scroll the confirm dialog into view whenever a new pending region is drawn
  useEffect(() => {
    if (!pendingRegion) return;
    pendingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [pendingRegion]);

  const { fileBuffer, fileMetadata } = useFileStore();
  const { maskingStyle, setRedactedBuffer } = useRedactionStore();

  // Stories 5.3 + 5.4 + 5.5 + 5.9
  const { detecting, detectProgress, faceRegions, setFaceRegions, detectFaces, hasFaceDetector, faceDetectError } =
    useVideoFaceDetector(videoRef, duration);

  // Story 5.8: audio redaction
  const audioRedactor = useAudioRedactor(fileBuffer, videoRef);

  useEffect(() => {
    if (!fileBuffer || !fileMetadata) return;
    const mimeMap: Record<string, string> = {
      MP4: 'video/mp4', MOV: 'video/quicktime', WEBM: 'video/webm', AVI: 'video/x-msvideo',
    };
    const mime = mimeMap[fileMetadata.type] ?? 'video/mp4';
    const blob = new Blob([fileBuffer], { type: mime });
    const url = URL.createObjectURL(blob);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [fileBuffer, fileMetadata]);

  function onLoadedMetadata() {
    const v = videoRef.current;
    if (!v) return;
    setDuration(v.duration);
    if (canvasRef.current) {
      canvasRef.current.width = v.videoWidth;
      canvasRef.current.height = v.videoHeight;
    }
  }

  function onTimeUpdate() {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
  }

  function onEnded() { setIsPlaying(false); }

  // Story 5.7: find the auto-foreground face (largest bbox at time t)
  const getAutoForegroundId = useCallback(
    (t: number): string | null => {
      let maxArea = 0;
      let foreId: string | null = null;
      for (const fr of faceRegions) {
        if (!fr.selected || t < fr.startTime || t > fr.endTime) continue;
        const bbox = interpolateBbox(fr.trajectory, t);
        if (!bbox) continue;
        const area = bbox.width * bbox.height;
        if (area > maxArea) { maxArea = area; foreId = fr.faceId; }
      }
      return foreId;
    },
    [faceRegions],
  );

  const renderFrame = useCallback(() => {
    const v = videoRef.current;
    const canvas = canvasRef.current;
    if (!v || !canvas) return;

    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);

    const t = v.currentTime;

    // Manual timed regions
    for (const r of timedRegions) {
      if (t < r.startTime || t > r.endTime) continue;
      applyManualStyle(ctx, v, maskingStyle, r.boundingBox);
    }

    // Face regions — Stories 5.3–5.7
    const effectiveForeId = bgCrowdBlurMode ? (foregroundFaceId ?? getAutoForegroundId(t)) : null;

    for (const fr of faceRegions) {
      if (!fr.selected || t < fr.startTime || t > fr.endTime) continue;
      // Story 5.7: skip foreground face in crowd-blur mode
      if (bgCrowdBlurMode && fr.faceId === effectiveForeId) continue;

      const rawBbox = interpolateBbox(fr.trajectory, t);
      if (!rawBbox) continue;
      // Story 5.6: compute partial sub-region bbox
      const bbox = computePartialBbox(rawBbox, fr.partialMode);
      applyFaceStyle(ctx, v, fr.style, bbox, fr.faceId);
    }

    ctx.filter = 'none';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    if (drawing?.active) {
      const x = Math.min(drawing.startX, drawing.currentX);
      const y = Math.min(drawing.startY, drawing.currentY);
      const w = Math.abs(drawing.currentX - drawing.startX);
      const h = Math.abs(drawing.currentY - drawing.startY);
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = 'rgba(59,130,246,0.15)';
      ctx.fillRect(x, y, w, h);
      ctx.setLineDash([]);
    }

    rafRef.current = requestAnimationFrame(renderFrame);
  }, [timedRegions, maskingStyle, faceRegions, drawing, bgCrowdBlurMode, foregroundFaceId, getAutoForegroundId]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [renderFrame]);

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { void v.play(); setIsPlaying(true); }
    else { v.pause(); setIsPlaying(false); }
  }

  function seek(e: React.ChangeEvent<HTMLInputElement>) {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = parseFloat(e.target.value);
  }

  function canvasPos(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (pendingRegion) return;
    const { x, y } = canvasPos(e);
    setDrawing({ startX: x, startY: y, currentX: x, currentY: y, active: true });
  }

  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawing?.active) return;
    const { x, y } = canvasPos(e);
    setDrawing((d) => (d ? { ...d, currentX: x, currentY: y } : d));
  }

  function onMouseUp() {
    if (!drawing?.active) return;
    const x = Math.min(drawing.startX, drawing.currentX);
    const y = Math.min(drawing.startY, drawing.currentY);
    const width = Math.abs(drawing.currentX - drawing.startX);
    const height = Math.abs(drawing.currentY - drawing.startY);
    if (width > 5 && height > 5) {
      setPendingRegion({ id: uuidv4(), boundingBox: { x, y, width, height } });
      setStartInput(formatTime(currentTime));
      setEndInput(formatTime(Math.min(currentTime + 5, duration)));
    }
    setDrawing(null);
  }

  function parseTimeInput(s: string): number {
    const parts = s.split(':');
    if (parts.length === 2) return parseFloat(parts[0] ?? '0') * 60 + parseFloat(parts[1] ?? '0');
    return parseFloat(s) || 0;
  }

  function confirmRegion() {
    if (!pendingRegion) return;
    const start = Math.max(0, parseTimeInput(startInput));
    const end = Math.min(duration, parseTimeInput(endInput));
    if (end <= start) return;
    setTimedRegions((prev) => [...prev, { ...pendingRegion, startTime: start, endTime: end }]);
    setPendingRegion(null);
  }

  function removeRegion(id: string) {
    setTimedRegions((prev) => prev.filter((r) => r.id !== id));
  }

  const VIDEO_TYPES = ['MP4', 'MOV', 'WEBM', 'AVI'];
  const isServerSide =
    fileMetadata != null &&
    VIDEO_TYPES.includes(fileMetadata.type) &&
    fileMetadata.sizeBytes > VIDEO_SERVER_THRESHOLD_BYTES;

  function buildRedactionConfig(): VideoRedactionConfig {
    const v = videoRef.current;
    return {
      videoDimensions: { width: v?.videoWidth ?? 1920, height: v?.videoHeight ?? 1080 },
      maskingStyle,
      timedRegions: timedRegions.map((r) => ({
        startTime: r.startTime,
        endTime: r.endTime,
        bbox: r.boundingBox,
      })),
      faceRegions: faceRegions
        .filter((f) => f.selected)
        .map((f) => ({
          faceId: f.faceId,
          startTime: f.startTime,
          endTime: f.endTime,
          style: f.style,
          partialMode: f.partialMode,
          trajectory: f.trajectory,
        })),
      audioRanges: audioRedactor.ranges.map((r) => ({
        startTime: r.startTime,
        endTime: r.endTime,
        mode: r.mode,
      })),
    };
  }

  const hasRegionsToExport =
    timedRegions.length > 0 ||
    faceRegions.some((f) => f.selected) ||
    audioRedactor.ranges.length > 0;
  const totalRegionCount =
    timedRegions.length +
    faceRegions.filter((f) => f.selected).length +
    audioRedactor.ranges.length;

  async function handleExport() {
    const v = videoRef.current;
    const canvas = canvasRef.current;
    if (!v || !canvas || !hasRegionsToExport) return;

    setExporting(true);
    setExportProgress(0);
    chunksRef.current = [];

    const videoStream = canvas.captureStream(30);

    // Story 5.8: merge processed audio stream if audio redaction is active
    const audioStream = audioRedactor.getExportAudioStream();
    const stream = audioStream
      ? new MediaStream([...videoStream.getVideoTracks(), ...audioStream.getAudioTracks()])
      : videoStream;

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
      ? 'video/webm;codecs=vp8'
      : 'video/webm';

    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      setRedactedBuffer(await blob.arrayBuffer());
      setExporting(false);
      setExportProgress(100);
    };

    recorder.start(100);
    // Register onseeked BEFORE setting currentTime to avoid missing the event
    // when the video is already near 0 and the seek completes synchronously.
    await new Promise<void>((resolve) => {
      v.onseeked = () => resolve();
      v.currentTime = 0;
    });
    v.onseeked = null;
    void v.play();

    const tick = () => {
      if (!v.paused && !v.ended) {
        setExportProgress(Math.round((v.currentTime / duration) * 100));
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
    v.onended = () => { recorder.stop(); v.onended = null; };
  }

  if (!objectUrl) {
    return <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Loading video…</div>;
  }

  return (
    <div className="space-y-4">
      <video
        ref={videoRef}
        src={objectUrl}
        className="hidden"
        onLoadedMetadata={onLoadedMetadata}
        onTimeUpdate={onTimeUpdate}
        onEnded={onEnded}
        preload="metadata"
      />

      {/* Canvas */}
      <div className="relative rounded-lg overflow-hidden border bg-black">
        <canvas
          ref={canvasRef}
          className="w-full cursor-crosshair"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        />
        {/* Idle hint */}
        {!pendingRegion && timedRegions.length === 0 && faceRegions.length === 0 && (
          <div className="absolute inset-x-0 top-2 flex justify-center pointer-events-none">
            <span className="bg-black/60 text-white/80 text-xs px-2 py-1 rounded">
              Click and drag on the video to draw a redaction region
            </span>
          </div>
        )}
        {/* Step 2 banner after drawing */}
        {pendingRegion && (
          <div className="absolute inset-x-0 bottom-0 bg-primary text-primary-foreground text-xs text-center py-1.5 font-medium pointer-events-none">
            ↓ Region drawn — scroll down to set the time range and click "Add Region"
          </div>
        )}
      </div>

      {/* Playback controls */}
      <div className="flex items-center gap-3">
        <Button size="sm" variant="outline" onClick={togglePlay} disabled={exporting || detecting}>
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <input
          type="range" min={0} max={duration || 1} step={0.001} value={currentTime}
          onChange={seek} className="flex-1 h-1.5 accent-primary"
        />
        <span className="text-xs tabular-nums text-muted-foreground w-24 text-right">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      {/* Timeline */}
      {duration > 0 && (
        <div className="relative h-8 rounded bg-muted/40 border overflow-hidden">
          {timedRegions.map((r) => (
            <div key={r.id} className="absolute top-0 h-full bg-primary/60 rounded"
              style={{ left: `${(r.startTime / duration) * 100}%`, width: `${((r.endTime - r.startTime) / duration) * 100}%` }}
              title={`Manual: ${formatTime(r.startTime)} → ${formatTime(r.endTime)}`} />
          ))}
          {faceRegions.filter((fr) => fr.selected).map((fr) => (
            <div key={fr.id} className="absolute top-0 h-full bg-green-500/50 rounded"
              style={{ left: `${(fr.startTime / duration) * 100}%`, width: `${((fr.endTime - fr.startTime) / duration) * 100}%` }}
              title={`${fr.label}: ${formatTime(fr.startTime)} → ${formatTime(fr.endTime)}`} />
          ))}
          {audioRedactor.ranges.map((r) => (
            <div key={r.id} className="absolute bottom-0 h-1/3 bg-orange-500/60 rounded"
              style={{ left: `${(r.startTime / duration) * 100}%`, width: `${((r.endTime - r.startTime) / duration) * 100}%` }}
              title={`Audio ${r.mode}: ${formatTime(r.startTime)} → ${formatTime(r.endTime)}`} />
          ))}
          <div className="absolute top-0 h-full w-0.5 bg-primary z-10" style={{ left: `${(currentTime / duration) * 100}%` }} />
          {timedRegions.length === 0 && faceRegions.length === 0 && audioRedactor.ranges.length === 0 && (
            <p className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground pointer-events-none">
              Draw a region on the video above to add a timed mask
            </p>
          )}
        </div>
      )}

      {/* Pending region */}
      {pendingRegion && (
        <div ref={pendingRef} className="rounded-lg border-2 border-primary bg-primary/5 p-3 space-y-2">
          <p className="text-sm font-semibold text-primary">Step 2 — Set time range for this region</p>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-xs text-muted-foreground w-12">Start</label>
            <input value={startInput} onChange={(e) => setStartInput(e.target.value)}
              className="border rounded px-2 py-1 text-xs w-28 font-mono" placeholder="MM:SS.mm" />
            <label className="text-xs text-muted-foreground w-12">End</label>
            <input value={endInput} onChange={(e) => setEndInput(e.target.value)}
              className="border rounded px-2 py-1 text-xs w-28 font-mono" placeholder="MM:SS.mm" />
            <Button size="sm" onClick={confirmRegion}>Add Region</Button>
            <Button size="sm" variant="outline" onClick={() => setPendingRegion(null)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Manual region list */}
      {timedRegions.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Manual Regions ({timedRegions.length})
          </p>
          <ul className="divide-y rounded-lg border overflow-hidden">
            {timedRegions.map((r, i) => (
              <li key={r.id} className="flex items-center gap-3 bg-card px-3 py-2">
                <span className="text-xs tabular-nums text-muted-foreground w-4">{i + 1}</span>
                <span className="text-xs font-mono flex-1">{formatTime(r.startTime)} → {formatTime(r.endTime)}</span>
                <span className="text-xs text-muted-foreground">{Math.round(r.boundingBox.width)}×{Math.round(r.boundingBox.height)}px</span>
                <button onClick={() => removeRegion(r.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Auto Face Blur panel (Stories 5.3 / 5.4 / 5.5 / 5.6 / 5.7) ──── */}
      <div className="rounded-lg border bg-card p-3 space-y-3">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Auto Face Blur</p>
          <div className="flex items-center gap-2">
            {/* Story 5.7: Background Crowd Blur toggle */}
            {faceRegions.length > 1 && (
              <button
                onClick={() => { setBgCrowdBlurMode((m) => !m); setForegroundFaceId(null); }}
                title="Story 5.7: blur all faces except the foreground subject"
                className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded border transition-colors ${
                  bgCrowdBlurMode
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background border-border hover:bg-muted'
                }`}
              >
                <Users className="h-3 w-3" />
                Crowd Blur {bgCrowdBlurMode ? 'On' : 'Off'}
              </button>
            )}
            <Button
              size="sm" variant="outline"
              onClick={() => void detectFaces(0.5)}
              disabled={!hasFaceDetector || detecting || duration === 0 || exporting}
              className="gap-1.5 h-7 text-xs"
            >
              {detecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Scan className="h-3 w-3" />}
              {detecting ? `Scanning… ${detectProgress}%` : 'Detect Faces'}
            </Button>
          </div>
        </div>

        {faceDetectError && (
          <p className="text-xs text-destructive rounded border border-destructive/30 bg-destructive/10 px-2 py-1.5">
            {faceDetectError}
          </p>
        )}
        {detecting && <Progress value={detectProgress} className="h-1.5" />}

        {bgCrowdBlurMode && faceRegions.length > 1 && (
          <p className="text-xs text-muted-foreground">
            Largest face auto-designated as foreground — click "Foreground" to override.
          </p>
        )}

        {/* Face list */}
        {faceRegions.length > 0 && (
          <div className="rounded-md border overflow-hidden">
            <div className="bg-muted/40 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {faceRegions.length} face{faceRegions.length !== 1 ? 's' : ''} detected
              {' '}— toggle to opt out · style per face · partial mask (5.6)
            </div>
            <ul className="divide-y">
              {faceRegions.map((fr) => (
                <li key={fr.id} className="px-3 py-2 bg-card space-y-1.5">
                  {/* Row 1: toggle, label, timespan, foreground override */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setFaceRegions((prev) => prev.map((r) => r.id === fr.id ? { ...r, selected: !r.selected } : r))}
                      title={fr.selected ? 'Exclude this face' : 'Include this face'}
                      className="flex-shrink-0"
                    >
                      {fr.selected
                        ? <Eye className="h-3.5 w-3.5 text-green-500" />
                        : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                    </button>
                    <span className={`text-xs font-medium w-20 ${!fr.selected ? 'line-through text-muted-foreground' : ''}`}>
                      {fr.label}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums flex-1">
                      {formatTime(fr.startTime)} → {formatTime(fr.endTime)}
                    </span>
                    {/* Story 5.7: foreground override button */}
                    {bgCrowdBlurMode && fr.selected && (
                      <button
                        onClick={() => setForegroundFaceId((id) => id === fr.faceId ? null : fr.faceId)}
                        className={`text-xs px-1.5 py-0.5 rounded border transition-colors ${
                          foregroundFaceId === fr.faceId
                            ? 'bg-green-500 text-white border-green-500'
                            : 'border-border hover:bg-muted text-muted-foreground'
                        }`}
                      >
                        Foreground
                      </button>
                    )}
                  </div>

                  {/* Row 2: style wardrobe + partial mode (Story 5.5 + 5.6) */}
                  {fr.selected && (
                    <div className="flex gap-1 flex-wrap pl-5">
                      {FACE_STYLES.map((s) => (
                        <button key={s.value} title={s.title}
                          onClick={() => setFaceRegions((prev) => prev.map((r) => r.id === fr.id ? { ...r, style: s.value } : r))}
                          className={`px-1.5 py-0.5 text-xs rounded border transition-colors ${
                            fr.style === s.value
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-background border-border hover:bg-muted'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                      <span className="w-px bg-border mx-0.5" />
                      {PARTIAL_MODES.map((p) => (
                        <button key={p.value} title={p.title}
                          onClick={() => setFaceRegions((prev) => prev.map((r) => r.id === fr.id ? { ...r, partialMode: p.value } : r))}
                          className={`px-1.5 py-0.5 text-xs rounded border transition-colors ${
                            fr.partialMode === p.value
                              ? 'bg-secondary text-secondary-foreground border-secondary'
                              : 'bg-background border-border hover:bg-muted'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ── Audio Redaction panel (Story 5.8) ─────────────────────────────── */}
      <AudioRedactionPanel
        audioRedactor={audioRedactor}
        currentTime={currentTime}
        duration={duration}
      />

      {/* ── Client-side export (files ≤100 MB) ──────────────────────────── */}
      {!isServerSide && (
        <>
          {exporting && (
            <div className="space-y-1.5">
              <Progress value={exportProgress} />
              <p className="text-xs text-muted-foreground">Exporting redacted video… {exportProgress}%</p>
            </div>
          )}
          <div className="flex gap-2">
            <Button
              onClick={() => void handleExport()}
              disabled={!hasRegionsToExport || exporting || detecting}
              className="gap-1.5"
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {exporting
                ? 'Exporting…'
                : `Export Redacted Video (${totalRegionCount} region${totalRegionCount !== 1 ? 's' : ''})`}
            </Button>
          </div>
        </>
      )}

      {/* ── Server-side export (files >100 MB via ECS Fargate) ───────────── */}
      {isServerSide && (
        <div className="space-y-3">
          {/* Disclosure prompt */}
          {showDisclosure && serverProc.phase === 'idle' && (
            <ServerVideoDisclosure
              fileSizeMb={(fileMetadata?.sizeBytes ?? 0) / (1024 * 1024)}
              onAccept={() => {
                setShowDisclosure(false);
                const file = useFileStore.getState().currentFile;
                if (file) void serverProc.proceed(file, buildRedactionConfig());
              }}
              onCancel={() => setShowDisclosure(false)}
            />
          )}

          {/* Upload progress */}
          {serverProc.phase === 'uploading' && (
            <div className="space-y-1.5">
              <Progress value={serverProc.uploadProgress} />
              <p className="text-xs text-muted-foreground">
                Uploading to secure server… {serverProc.uploadProgress}%
              </p>
            </div>
          )}

          {/* Processing progress */}
          {serverProc.phase === 'processing' && (
            <div className="space-y-1.5">
              <Progress value={serverProc.jobProgress} />
              <p className="text-xs text-muted-foreground">
                Processing on server… {serverProc.jobProgress}%
              </p>
            </div>
          )}

          {/* Error */}
          {serverProc.phase === 'failed' && serverProc.error && (
            <p className="text-sm text-destructive rounded border border-destructive/30 bg-destructive/10 px-3 py-2">
              {serverProc.error}
            </p>
          )}

          <div className="flex gap-2 flex-wrap">
            {/* Trigger button — shows when idle or failed */}
            {(serverProc.phase === 'idle' || serverProc.phase === 'failed') && (
              <Button
                onClick={() => setShowDisclosure(true)}
                disabled={!hasRegionsToExport || detecting}
                className="gap-1.5"
              >
                <CloudUpload className="h-4 w-4" />
                {`Export on Server (${totalRegionCount} region${totalRegionCount !== 1 ? 's' : ''})`}
              </Button>
            )}

            {/* Spinner while uploading/processing */}
            {(serverProc.phase === 'uploading' || serverProc.phase === 'processing') && (
              <Button disabled className="gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin" />
                {serverProc.phase === 'uploading' ? 'Uploading…' : 'Processing on server…'}
              </Button>
            )}

            {/* Download button once ready */}
            {serverProc.phase === 'ready' && (
              <>
                <Button
                  onClick={async () => {
                    try {
                      const buffer = await serverProc.downloadAndCleanup();
                      setRedactedBuffer(buffer);
                    } catch (err) {
                      console.error('[ServerVideo] Download error:', err);
                    }
                  }}
                  className="gap-1.5"
                >
                  <Download className="h-4 w-4" />
                  Download Redacted Video
                </Button>
                <Button variant="outline" size="sm" onClick={serverProc.reset}>
                  Start over
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
