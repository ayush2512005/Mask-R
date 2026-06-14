import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { getFaceDetector, runFaceDetection } from '@/lib/face-detector.service';
import type { MediaPipeFaceDetector, FaceBBox } from '@/lib/face-detector.service';

type BlurStyle = 'blur' | 'pixelate' | 'black_box';

const BLUR_OPTIONS: { value: BlurStyle; label: string }[] = [
  { value: 'blur', label: 'Blur' },
  { value: 'pixelate', label: 'Pixelate' },
  { value: 'black_box', label: 'Black Box' },
];

function applyFaceEffect(
  ctx: CanvasRenderingContext2D,
  bbox: FaceBBox,
  style: BlurStyle,
): void {
  const { x, y, width: w, height: h } = bbox;
  if (w <= 0 || h <= 0) return;

  if (style === 'black_box') {
    ctx.fillStyle = '#000';
    ctx.fillRect(x, y, w, h);
    return;
  }

  // Pixelate or blur via downscale/upscale
  const thumbW = Math.max(1, Math.round(w / 12));
  const thumbH = Math.max(1, Math.round(h / 12));
  const off = document.createElement('canvas');
  off.width = thumbW;
  off.height = thumbH;
  off.getContext('2d')!.drawImage(ctx.canvas, x, y, w, h, 0, 0, thumbW, thumbH);
  ctx.imageSmoothingEnabled = style === 'blur';
  ctx.drawImage(off, 0, 0, thumbW, thumbH, x, y, w, h);
  ctx.imageSmoothingEnabled = true;
}

export function CameraBlurGuard() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const frameCountRef = useRef(0);
  const facesRef = useRef<FaceBBox[]>([]);
  const detectorRef = useRef<MediaPipeFaceDetector | null>(null);
  const detectingRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);

  const [active, setActive] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [faceCount, setFaceCount] = useState(0);
  const [blurStyle, setBlurStyle] = useState<BlurStyle>('blur');
  const [autoBlur, setAutoBlur] = useState(true);
  const [detectorLoading, setDetectorLoading] = useState(false);
  const [detectorError, setDetectorError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Load MediaPipe face detector on mount
  useEffect(() => {
    setDetectorLoading(true);
    getFaceDetector()
      .then((d) => { detectorRef.current = d; })
      .catch((err: unknown) => {
        setDetectorError(err instanceof Error ? err.message : 'Face detector failed to load');
      })
      .finally(() => setDetectorLoading(false));
  }, []);

  const renderFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || canvas.width === 0 || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(renderFrame);
      return;
    }

    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Apply blur to last detected face bounding boxes
    if (autoBlur) {
      for (const bbox of facesRef.current) {
        applyFaceEffect(ctx, bbox, blurStyle);
      }
    }

    // Run face detection every 5 frames to keep the RAF loop smooth
    frameCountRef.current++;
    if (frameCountRef.current % 5 === 0 && detectorRef.current && !detectingRef.current) {
      detectingRef.current = true;
      try {
        const bboxes = runFaceDetection(detectorRef.current, canvas);
        facesRef.current = bboxes;
        setFaceCount(bboxes.length);
      } finally {
        detectingRef.current = false;
      }
    }

    rafRef.current = requestAnimationFrame(renderFrame);
  }, [autoBlur, blurStyle]);

  useEffect(() => {
    if (active && videoReady) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(renderFrame);
      return () => cancelAnimationFrame(rafRef.current);
    }
    return undefined;
  }, [active, videoReady, renderFrame]);

  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  function onLoadedMetadata() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    setVideoReady(true);
  }

  async function startCamera() {
    setCameraError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = s;
      const video = videoRef.current!;
      video.srcObject = s;
      await video.play();
      setActive(true);
      s.getVideoTracks()[0]?.addEventListener('ended', stopCamera);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Camera access failed';
      if (!msg.toLowerCase().includes('denied') && !msg.toLowerCase().includes('abort')) {
        setCameraError(msg);
      }
    }
  }

  function stopCamera() {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const video = videoRef.current;
    if (video) video.srcObject = null;
    setActive(false);
    setVideoReady(false);
    facesRef.current = [];
    setFaceCount(0);
  }

  async function switchCamera() {
    stopCamera();
    await startCamera();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Camera Blur Guard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Real-time face blur for your webcam — entirely in your browser, never uploaded.
        </p>
      </div>

      {detectorError && (
        <div className="rounded-lg border border-destructive bg-destructive/5 p-3 text-destructive text-sm">
          Face detector error: {detectorError}
        </div>
      )}
      {cameraError && (
        <div className="rounded-lg border border-destructive bg-destructive/5 p-3 text-destructive text-sm">
          Camera error: {cameraError}
        </div>
      )}

      {/* Controls bar */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground font-medium">Style:</span>
          {BLUR_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => setBlurStyle(o.value)}
              className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                blurStyle === o.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border hover:bg-muted'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setAutoBlur((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-1 text-sm rounded-full border transition-colors ${
            autoBlur
              ? 'bg-success/10 text-success border-success/30'
              : 'bg-background border-border text-muted-foreground hover:bg-muted'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${autoBlur ? 'bg-success animate-pulse' : 'bg-muted-foreground'}`} />
          {autoBlur ? 'Blur ON' : 'Blur OFF'}
        </button>

        {active && videoReady && (
          <Badge variant={faceCount > 0 ? 'default' : 'muted'}>
            {faceCount} face{faceCount !== 1 ? 's' : ''} detected
          </Badge>
        )}

        {detectorLoading && <Badge variant="warning">Loading detector…</Badge>}
      </div>

      {/* Camera canvas */}
      <div className="relative rounded-xl overflow-hidden border-2 border-border bg-black aspect-video">
        {/*
          Video must NOT be display:none — browsers skip frame decoding for hidden elements.
          Position off-screen and invisible instead.
        */}
        <video
          ref={videoRef}
          muted
          playsInline
          onLoadedMetadata={onLoadedMetadata}
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
        />
        <canvas ref={canvasRef} className="w-full h-full object-contain" />

        {!active && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/70">
            <Camera className="h-16 w-16 text-white/20" />
            <p className="text-sm">Click <strong>Start Camera</strong> to begin</p>
          </div>
        )}

        {active && !videoReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="h-6 w-6 rounded-full border-2 border-white border-t-transparent animate-spin" />
          </div>
        )}

        {active && videoReady && autoBlur && faceCount > 0 && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/75 text-white/90 text-xs px-2.5 py-1.5 rounded-full pointer-events-none">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            {faceCount} face{faceCount !== 1 ? 's' : ''} blurred
          </div>
        )}

        {active && videoReady && autoBlur && faceCount === 0 && !detectorLoading && (
          <div className="absolute top-3 inset-x-0 flex justify-center pointer-events-none">
            <span className="bg-black/70 text-white/70 text-xs px-3 py-1.5 rounded-full">
              No faces detected — move into frame or improve lighting
            </span>
          </div>
        )}
      </div>

      {/* Start / stop buttons */}
      <div className="flex items-center gap-3">
        {!active ? (
          <Button
            onClick={() => void startCamera()}
            className="gap-2"
            disabled={detectorLoading}
          >
            <Camera className="h-4 w-4" />
            {detectorLoading ? 'Loading detector…' : 'Start Camera'}
          </Button>
        ) : (
          <>
            <Button onClick={stopCamera} variant="outline" className="gap-2">
              <CameraOff className="h-4 w-4" />
              Stop Camera
            </Button>
            <Button onClick={() => void switchCamera()} variant="outline" size="sm" className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Switch Camera
            </Button>
          </>
        )}
      </div>

      <div className="rounded-lg bg-muted/50 border p-4 space-y-1.5 text-sm text-muted-foreground">
        <p className="font-semibold text-foreground text-xs uppercase tracking-wide">How it works</p>
        <p>1. Click <strong>Start Camera</strong> — grant camera permission when prompted.</p>
        <p>2. MediaPipe face detection runs on every 5th frame entirely in your browser.</p>
        <p>3. Toggle <strong>Blur ON/OFF</strong> and pick a style — changes apply instantly.</p>
        <p>4. Your camera feed is never sent anywhere — all processing is local.</p>
      </div>
    </div>
  );
}
