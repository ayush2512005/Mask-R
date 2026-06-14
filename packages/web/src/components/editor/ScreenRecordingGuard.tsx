import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { MaskingStyle } from '@redact/shared';
import { Button } from '../ui/Button';
import { Monitor, StopCircle, Download, Trash2, Video } from 'lucide-react';

interface PrivateZone {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DrawState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  active: boolean;
}

const ZONE_STYLE_OPTIONS = [
  { value: MaskingStyle.BLACK_BOX, label: 'Black Box' },
  { value: MaskingStyle.PIXELATE, label: 'Pixelate' },
  { value: MaskingStyle.BLUR, label: 'Blur' },
] as const;

function applyZone(
  ctx: CanvasRenderingContext2D,
  zone: PrivateZone,
  style: MaskingStyle,
): void {
  const { x, y, width: w, height: h } = zone;
  if (w <= 0 || h <= 0) return;

  if (style === MaskingStyle.BLACK_BOX) {
    ctx.fillStyle = '#000';
    ctx.fillRect(x, y, w, h);
  } else {
    // Downscale then upscale: pixelate (smoothing=false) or blur-like (smoothing=true)
    const thumbW = Math.max(1, Math.round(w / 14));
    const thumbH = Math.max(1, Math.round(h / 14));
    const off = document.createElement('canvas');
    off.width = thumbW;
    off.height = thumbH;
    off.getContext('2d')!.drawImage(ctx.canvas, x, y, w, h, 0, 0, thumbW, thumbH);
    ctx.imageSmoothingEnabled = style === MaskingStyle.BLUR;
    ctx.drawImage(off, 0, 0, thumbW, thumbH, x, y, w, h);
    ctx.imageSmoothingEnabled = true;
  }
}

function formatDuration(s: number): string {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function ScreenRecordingGuard() {
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [zones, setZones] = useState<PrivateZone[]>([]);
  const [drawing, setDrawing] = useState<DrawState | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [zoneStyle, setZoneStyle] = useState<MaskingStyle>(MaskingStyle.BLACK_BOX);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    };
  }, [downloadUrl]);

  const renderFrame = useCallback(() => {
    const video = previewVideoRef.current;
    const canvas = displayCanvasRef.current;

    if (!video || !canvas || canvas.width === 0) {
      rafRef.current = requestAnimationFrame(renderFrame);
      return;
    }

    // readyState 2 = HAVE_CURRENT_DATA: at least one frame decoded and ready
    if (video.readyState >= 2) {
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      for (const zone of zones) {
        applyZone(ctx, zone, zoneStyle);
      }

      if (drawing?.active && !recording) {
        const rx = Math.min(drawing.startX, drawing.currentX);
        const ry = Math.min(drawing.startY, drawing.currentY);
        const rw = Math.abs(drawing.currentX - drawing.startX);
        const rh = Math.abs(drawing.currentY - drawing.startY);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(rx, ry, rw, rh);
        ctx.fillStyle = 'rgba(239,68,68,0.15)';
        ctx.fillRect(rx, ry, rw, rh);
        ctx.setLineDash([]);
      }
    }

    rafRef.current = requestAnimationFrame(renderFrame);
  }, [zones, drawing, zoneStyle, recording]);

  // Start/stop the render loop whenever stream+videoReady state changes
  useEffect(() => {
    if (stream && videoReady) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(renderFrame);
      return () => cancelAnimationFrame(rafRef.current);
    }
    return undefined;
  }, [stream, videoReady, renderFrame]);

  // Handle video metadata loaded — set canvas dimensions to actual video resolution
  function onLoadedMetadata() {
    const video = previewVideoRef.current;
    const canvas = displayCanvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    setVideoReady(true);
  }

  async function startCapture() {
    setError(null);
    setDownloadUrl(null);
    setVideoReady(false);
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: false,
      });

      const video = previewVideoRef.current!;
      video.srcObject = displayStream;
      // onLoadedMetadata fires after srcObject is set and metadata decodes —
      // it will set canvas dimensions and flip videoReady = true, starting the loop.
      await video.play();

      setStream(displayStream);
      displayStream.getVideoTracks()[0]?.addEventListener('ended', () => stopCapture());
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Screen capture failed';
      if (!msg.includes('denied') && !msg.includes('cancelled') && !msg.includes('abort')) {
        setError(msg);
      }
    }
  }

  function stopCapture() {
    cancelAnimationFrame(rafRef.current);
    if (recording) stopRecording();
    stream?.getTracks().forEach((t) => t.stop());
    const video = previewVideoRef.current;
    if (video) video.srcObject = null;
    setStream(null);
    setVideoReady(false);
  }

  function canvasCoords(e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } {
    const canvas = displayCanvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!stream || recording) return;
    const { x, y } = canvasCoords(e);
    setDrawing({ startX: x, startY: y, currentX: x, currentY: y, active: true });
  }

  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawing?.active) return;
    const { x, y } = canvasCoords(e);
    setDrawing((d) => (d ? { ...d, currentX: x, currentY: y } : d));
  }

  function onMouseUp() {
    if (!drawing?.active) return;
    const x = Math.min(drawing.startX, drawing.currentX);
    const y = Math.min(drawing.startY, drawing.currentY);
    const width = Math.abs(drawing.currentX - drawing.startX);
    const height = Math.abs(drawing.currentY - drawing.startY);
    if (width > 10 && height > 10 && zones.length < 10) {
      setZones((prev) => [...prev, { id: uuidv4(), x, y, width, height }]);
    }
    setDrawing(null);
  }

  function startRecording() {
    const canvas = displayCanvasRef.current;
    if (!canvas || !stream) return;
    chunksRef.current = [];
    setDownloadUrl(null);
    setRecording(true);
    setRecordSeconds(0);

    const captureStream = canvas.captureStream(30);
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';
    const recorder = new MediaRecorder(captureStream, { mimeType, videoBitsPerSecond: 5_000_000 });
    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      setDownloadUrl(URL.createObjectURL(blob));
      setRecording(false);
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    };
    recorder.start(500);
    recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
  }

  function downloadRecording() {
    if (!downloadUrl) return;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `screen-recording-redacted-${Date.now()}.webm`;
    a.click();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Screen Recording Guard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Draw private zones before recording. Those regions are permanently burned into the output — no post-processing can reveal them.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/5 p-3 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Zone masking style */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground font-medium">Zone style:</span>
        {ZONE_STYLE_OPTIONS.map((s) => (
          <button
            key={s.value}
            onClick={() => setZoneStyle(s.value)}
            disabled={recording}
            className={`px-3 py-1 text-sm rounded-full border transition-colors ${
              zoneStyle === s.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border hover:bg-muted disabled:opacity-50'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Screen preview canvas */}
      <div className="relative rounded-xl overflow-hidden border-2 border-border bg-black aspect-video">
        {/*
          IMPORTANT: video must NOT be display:none — browsers skip frame decoding
          for hidden videos. We position it off-screen and make it invisible instead.
        */}
        <video
          ref={previewVideoRef}
          muted
          playsInline
          onLoadedMetadata={onLoadedMetadata}
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
        />
        <canvas
          ref={displayCanvasRef}
          className={`w-full h-full ${stream && !recording ? 'cursor-crosshair' : 'cursor-default'}`}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        />
        {!stream && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/70">
            <Monitor className="h-16 w-16 text-white/20" />
            <p className="text-sm">Click <strong>Start Screen Capture</strong> to begin</p>
          </div>
        )}
        {stream && !videoReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="h-6 w-6 rounded-full border-2 border-white border-t-transparent animate-spin" />
          </div>
        )}
        {stream && videoReady && zones.length === 0 && !recording && (
          <div className="absolute top-3 inset-x-0 flex justify-center pointer-events-none">
            <span className="bg-black/75 text-white text-xs px-3 py-1.5 rounded-full shadow">
              Click and drag to draw a private zone — permanently hidden in the recording
            </span>
          </div>
        )}
        {recording && (
          <div className="absolute top-3 right-3 flex items-center gap-2 bg-black/80 text-white px-3 py-1.5 rounded-full shadow">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs tabular-nums font-mono">{formatDuration(recordSeconds)}</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        {!stream ? (
          <Button onClick={() => void startCapture()} className="gap-2">
            <Monitor className="h-4 w-4" />
            Start Screen Capture
          </Button>
        ) : (
          <>
            {!recording ? (
              <Button onClick={startRecording} disabled={zones.length === 0 || !videoReady} className="gap-2">
                <Video className="h-4 w-4" />
                Start Recording
              </Button>
            ) : (
              <Button onClick={stopRecording} variant="destructive" className="gap-2">
                <StopCircle className="h-4 w-4" />
                Stop Recording
              </Button>
            )}
            <Button variant="outline" onClick={stopCapture} disabled={recording}>
              Stop Capture
            </Button>
          </>
        )}
        {downloadUrl && (
          <Button onClick={downloadRecording} variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Download Redacted Recording
          </Button>
        )}
      </div>

      {stream && videoReady && zones.length === 0 && (
        <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
          Draw at least one private zone before recording. Zones are baked into the video and cannot be removed.
        </p>
      )}

      {/* Zone list */}
      {zones.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Private Zones ({zones.length}/10)</p>
            {!recording && (
              <Button variant="outline" size="sm" onClick={() => setZones([])} className="gap-1 text-xs h-7">
                <Trash2 className="h-3 w-3" />
                Clear All
              </Button>
            )}
          </div>
          <ul className="divide-y rounded-lg border overflow-hidden">
            {zones.map((zone, i) => (
              <li key={zone.id} className="flex items-center gap-3 bg-card px-3 py-2">
                <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}</span>
                <span className="text-xs flex-1 font-mono">
                  {Math.round(zone.width)}×{Math.round(zone.height)}px at ({Math.round(zone.x)}, {Math.round(zone.y)})
                </span>
                {!recording && (
                  <button
                    onClick={() => setZones((prev) => prev.filter((z) => z.id !== zone.id))}
                    className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    aria-label="Remove zone"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-lg bg-muted/50 border p-4 space-y-1.5 text-sm text-muted-foreground">
        <p className="font-semibold text-foreground text-xs uppercase tracking-wide">How it works</p>
        <p>1. Click <strong>Start Screen Capture</strong> and choose the screen or window to share.</p>
        <p>2. Draw rectangles over sensitive areas (passwords, private chats, financial data).</p>
        <p>3. Click <strong>Start Recording</strong> — zones are composited onto every frame before encoding.</p>
        <p>4. Stop and download. The redacted areas cannot be recovered from the video file.</p>
      </div>
    </div>
  );
}
