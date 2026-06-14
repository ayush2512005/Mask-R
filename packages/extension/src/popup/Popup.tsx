/**
 * Extension Popup — Stories 4.x (Phase 1) + 6.1–6.6 (Phase 2)
 *
 * Tabs:
 *   Main  — open web tool, suppressed sites, quick live toggle
 *   Live  — camera preview with real-time detection, face blur (6.4), doc alert (6.5)
 *   Zones — persistent "always private" zone drawing (6.6)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  WEB_APP_BASE,
  getSuppressedSites,
  removeSuppressedSite,
  getLiveZones,
  saveLiveZones,
  getLiveModeEnabled,
  setLiveModeEnabled,
  getFaceBlurEnabled,
  setFaceBlurEnabled,
  getAutoBlurDocs,
  setAutoBlurDocs,
  type CameraZone,
  type PopupToSwMessage,
  type LiveDetectionResult,
} from '../shared/messaging';
import { LiveDetector, type DetectedObject, type DetectionObjectType } from '../live/live-detector';

const genId = () => crypto.randomUUID();

// ─── Styles ───────────────────────────────────────────────────────────────────

const BASE_STYLE: React.CSSProperties = {
  width: 380,
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: 13,
  color: '#1e293b',
  backgroundColor: '#fff',
};

const BTN: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '7px 14px', borderRadius: 8, border: 'none',
  cursor: 'pointer', fontSize: 13, fontWeight: 500,
};
const BTN_PRIMARY: React.CSSProperties = { ...BTN, background: '#3b82f6', color: '#fff' };
const BTN_OUTLINE: React.CSSProperties = { ...BTN, background: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0' };
const BTN_DANGER: React.CSSProperties = { ...BTN, background: '#ef4444', color: '#fff' };
const BTN_SUCCESS: React.CSSProperties = { ...BTN, background: '#22c55e', color: '#fff' };
const BTN_PURPLE: React.CSSProperties = { ...BTN, background: '#a855f7', color: '#fff' };

type Tab = 'main' | 'live' | 'zones';

const DET_COLORS: Record<DetectionObjectType, string> = {
  face: 'rgba(59,130,246,0.85)',
  card: 'rgba(245,158,11,0.85)',
  plate: 'rgba(16,185,129,0.85)',
  document: 'rgba(168,85,247,0.85)',
};

const DET_BG: Record<DetectionObjectType, string> = {
  face: 'rgba(59,130,246,0.12)',
  card: 'rgba(245,158,11,0.12)',
  plate: 'rgba(16,185,129,0.12)',
  document: 'rgba(168,85,247,0.10)',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function Popup() {
  const [tab, setTab] = useState<Tab>('main');

  // Main tab
  const [suppressed, setSuppressed] = useState<string[]>([]);

  // Live tab — core
  const [liveEnabled, setLiveEnabled] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [overlayDetections, setOverlayDetections] = useState<DetectedObject[]>([]);
  const [detectionCounts, setDetectionCounts] = useState({ face: 0, card: 0, plate: 0, document: 0 });
  const [detectorReady, setDetectorReady] = useState(false);

  // 6.4 — Face Blur
  const [facesBlurEnabled, setFacesBlurEnabled] = useState(false);
  // Indices (into face-filtered overlay list) that the user has clicked to unblur
  const [unblurredFaceIndices, setUnblurredFaceIndices] = useState<number[]>([]);

  // 6.5 — Document / Whiteboard alert
  const [docAlert, setDocAlert] = useState(false);
  const [docBlurActive, setDocBlurActive] = useState(false);
  const [autoBlurDocs, setAutoBlurDocs] = useState(false);
  const docAlertDismissedRef = useRef(false); // don't re-show alert until doc leaves frame

  // Zones tab (6.6)
  const [zones, setZones] = useState<CameraZone[]>([]);
  const [drawingZone, setDrawingZone] = useState<{
    startX: number; startY: number; currentX: number; currentY: number; active: boolean;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const zoneCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const detectorRef = useRef<LiveDetector | null>(null);
  const detectionFrameRef = useRef<number>(0);
  const latestDetectionsRef = useRef<DetectedObject[]>([]);

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    getSuppressedSites().then(setSuppressed).catch(() => setSuppressed([]));
    getLiveZones().then(setZones).catch(() => setZones([]));
    getLiveModeEnabled().then((enabled) => {
      setLiveEnabled(enabled);
      if (enabled) setTab('live');
    }).catch(() => {});
    getFaceBlurEnabled().then(setFacesBlurEnabled).catch(() => {});
    getAutoBlurDocs().then(setAutoBlurDocs).catch(() => {});

    const detector = new LiveDetector();
    detectorRef.current = detector;
    detector.init().then(() => setDetectorReady(true)).catch(() => setDetectorReady(true));

    return () => {
      cancelAnimationFrame(rafRef.current);
      stopCamera();
    };
  }, []);

  // ── Camera lifecycle ──────────────────────────────────────────────────────

  async function startCamera() {
    setCameraError(null);
    setCameraActive(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 30 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.onloadedmetadata = () => {
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = video.videoWidth || 320;
          canvas.height = video.videoHeight || 180;
        }
        setCameraActive(true);
      };
      video.srcObject = stream;
      await video.play();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Camera access failed';
      setCameraError(
        msg.includes('denied') || msg.includes('NotAllowed')
          ? 'Camera access denied. Click the camera icon in the address bar to allow access.'
          : msg,
      );
    }
  }

  function stopCamera() {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const video = videoRef.current;
    if (video) {
      video.onloadedmetadata = null;
      video.srcObject = null;
    }
    setCameraActive(false);
    setOverlayDetections([]);
    latestDetectionsRef.current = [];
    setDocAlert(false);
    docAlertDismissedRef.current = false;
  }

  // ── Toggle live mode ──────────────────────────────────────────────────────

  async function toggleLive() {
    const next = !liveEnabled;
    setLiveEnabled(next);
    await setLiveModeEnabled(next);
    if (next) {
      await startCamera();
    } else {
      stopCamera();
      chrome.runtime.sendMessage({ type: 'LIVE_MODE_STOPPED' }).catch(() => {});
    }
  }

  // ── 6.4 — Face blur toggle ────────────────────────────────────────────────

  async function toggleFaceBlur() {
    const next = !facesBlurEnabled;
    setFacesBlurEnabled(next);
    setUnblurredFaceIndices([]); // reset per-face unblur when toggling
    await setFaceBlurEnabled(next);
  }

  function toggleUnblurFace(index: number) {
    setUnblurredFaceIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
    );
  }

  // ── 6.5 — Document blur ───────────────────────────────────────────────────

  async function handleDocBlur() {
    setDocBlurActive(true);
    setDocAlert(false);
  }

  function handleDocDismiss() {
    setDocAlert(false);
    docAlertDismissedRef.current = true;
  }

  async function handleToggleAutoBlurDocs() {
    const next = !autoBlurDocs;
    setAutoBlurDocs(next);
    await setAutoBlurDocs(next);
    if (next) setDocBlurActive(true);
  }

  // ── Detection render loop ─────────────────────────────────────────────────

  const renderLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const detector = detectorRef.current;

    if (!video || !canvas || !detector) {
      rafRef.current = requestAnimationFrame(renderLoop);
      return;
    }

    if (video.readyState < 2 || video.videoWidth === 0) {
      rafRef.current = requestAnimationFrame(renderLoop);
      return;
    }

    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Persistent zones (FR-33) — always blur
    for (const zone of zones) {
      applyZoneBlur(ctx, canvas, zone);
    }

    const dets = latestDetectionsRef.current;
    const scaleX = canvas.width / (video.videoWidth || canvas.width);
    const scaleY = canvas.height / (video.videoHeight || canvas.height);

    // Separate face detections for indexed unblur
    const faceDets = dets.filter((d) => d.type === 'face');

    for (const det of dets) {
      const bx = det.bbox.x * scaleX;
      const by = det.bbox.y * scaleY;
      const bw = det.bbox.width * scaleX;
      const bh = det.bbox.height * scaleY;

      if (det.type === 'face') {
        // 6.4: blur face unless user has unblurred that face index
        const faceIdx = faceDets.indexOf(det);
        const isUnblurred = unblurredFaceIndices.includes(faceIdx);
        if (facesBlurEnabled && !isUnblurred) {
          applyBlurToRegion(ctx, canvas, bx, by, bw, bh);
        }
      } else if (det.type === 'card' || det.type === 'plate') {
        applyBlurToRegion(ctx, canvas, bx, by, bw, bh);
      } else if (det.type === 'document') {
        // 6.5: blur document region if active
        if (docBlurActive || autoBlurDocs) {
          applyBlurToRegion(ctx, canvas, bx, by, bw, bh);
        }
      }

      // Bounding box overlay
      ctx.strokeStyle = DET_COLORS[det.type];
      ctx.lineWidth = 2;
      ctx.strokeRect(bx, by, bw, bh);
      ctx.fillStyle = DET_BG[det.type];
      ctx.fillRect(bx, by, bw, bh);

      // Label
      const labelMap: Record<DetectionObjectType, string> = {
        face: '👤 Face', card: '💳 Card', plate: '🚗 Plate', document: '📄 Doc',
      };
      ctx.fillStyle = DET_COLORS[det.type];
      ctx.font = 'bold 11px system-ui';
      ctx.textBaseline = 'bottom';
      ctx.fillText(labelMap[det.type], bx + 4, by - 2);
      ctx.textBaseline = 'alphabetic';
    }

    // Run detection every 3rd render frame (NFR-2: <10% CPU)
    detectionFrameRef.current = (detectionFrameRef.current + 1) % 3;
    if (detectionFrameRef.current === 0 && detectorReady) {
      detector.detectFrameForOverlay(video).then((detected) => {
        latestDetectionsRef.current = detected;
        setOverlayDetections(detected);
        setDetectionCounts({
          face: detected.filter((d) => d.type === 'face').length,
          card: detected.filter((d) => d.type === 'card').length,
          plate: detected.filter((d) => d.type === 'plate').length,
          document: detected.filter((d) => d.type === 'document').length,
        });

        // 6.5: document alert logic
        const hasDocs = detected.some((d) => d.type === 'document');
        if (!hasDocs) {
          setDocAlert(false);
          docAlertDismissedRef.current = false;
        } else if (hasDocs && autoBlurDocs) {
          setDocBlurActive(true);
        } else if (hasDocs && !docBlurActive && !docAlertDismissedRef.current) {
          setDocAlert(true);
        }

        // Forward confirmed detections to service worker for page toasts
        if (detected.length > 0) {
          detector.detectFrame(video).then((confirmed) => {
            if (confirmed.length === 0) return;
            const payload: LiveDetectionResult[] = confirmed.map((c) => ({
              type: c.type as LiveDetectionResult['type'],
              label: c.label,
              notification: c.notification,
              count: 1,
            }));
            const msg: PopupToSwMessage = { type: 'LIVE_DETECTION_EVENT', detections: payload };
            chrome.runtime.sendMessage(msg).catch(() => {});
          }).catch(() => {});
        }
      }).catch(() => {});
    }

    rafRef.current = requestAnimationFrame(renderLoop);
  }, [zones, detectorReady, facesBlurEnabled, unblurredFaceIndices, docBlurActive, autoBlurDocs]);

  useEffect(() => {
    if (liveEnabled && cameraActive) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(renderLoop);
      return () => cancelAnimationFrame(rafRef.current);
    }
    return undefined;
  }, [liveEnabled, cameraActive, renderLoop]);

  // ── Zone drawing (FR-33) ──────────────────────────────────────────────────

  function zoneCanvasCoords(e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } {
    const canvas = zoneCanvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function onZoneMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (zones.length >= 5) return;
    const { x, y } = zoneCanvasCoords(e);
    setDrawingZone({ startX: x, startY: y, currentX: x, currentY: y, active: true });
  }

  function onZoneMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawingZone?.active) return;
    const { x, y } = zoneCanvasCoords(e);
    setDrawingZone((d) => d ? { ...d, currentX: x, currentY: y } : d);
  }

  async function onZoneMouseUp() {
    if (!drawingZone?.active) return;
    const x = Math.min(drawingZone.startX, drawingZone.currentX);
    const y = Math.min(drawingZone.startY, drawingZone.currentY);
    const width = Math.abs(drawingZone.currentX - drawingZone.startX);
    const height = Math.abs(drawingZone.currentY - drawingZone.startY);
    if (width > 8 && height > 8) {
      const newZones = [...zones, { id: genId(), x, y, width, height }];
      setZones(newZones);
      await saveLiveZones(newZones);
    }
    setDrawingZone(null);
  }

  // Zone canvas preview render
  useEffect(() => {
    const canvas = zoneCanvasRef.current;
    if (!canvas || tab !== 'zones') return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#334155';
    ctx.font = '12px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Camera preview (Live Mode must be active)', canvas.width / 2, canvas.height / 2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    const video = videoRef.current;
    if (video && video.readyState >= 2) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }

    for (const zone of zones) {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(239,68,68,0.2)';
      ctx.fillRect(zone.x, zone.y, zone.width, zone.height);
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 10px system-ui';
      ctx.fillText('ZONE', zone.x + 4, zone.y + 13);
    }

    if (drawingZone?.active) {
      const rx = Math.min(drawingZone.startX, drawingZone.currentX);
      const ry = Math.min(drawingZone.startY, drawingZone.currentY);
      const rw = Math.abs(drawingZone.currentX - drawingZone.startX);
      const rh = Math.abs(drawingZone.currentY - drawingZone.startY);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.setLineDash([]);
    }
  }, [zones, drawingZone, tab]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleRemoveSuppressed(site: string) {
    await removeSuppressedSite(site);
    setSuppressed((prev) => prev.filter((s) => s !== site));
  }

  async function removeZone(id: string) {
    const updated = zones.filter((z) => z.id !== id);
    setZones(updated);
    await saveLiveZones(updated);
  }

  async function clearZones() {
    setZones([]);
    await saveLiveZones([]);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const tabStyle = (t: Tab): React.CSSProperties => ({
    flex: 1, padding: '8px 0', background: tab === t ? '#3b82f6' : '#f1f5f9',
    color: tab === t ? '#fff' : '#64748b', border: 'none', cursor: 'pointer',
    fontSize: 12, fontWeight: tab === t ? 700 : 500,
    borderRadius: tab === t ? 6 : 0, transition: 'all 0.15s',
  });

  const faceDets = overlayDetections.filter((d) => d.type === 'face');

  return (
    <div style={BASE_STYLE}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px 8px', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 18 }}>🔒</span>
          <strong style={{ fontSize: 15 }}>Redact</strong>
          {liveEnabled && (
            <span style={{ fontSize: 10, background: '#22c55e', color: '#fff', padding: '2px 7px', borderRadius: 20, fontWeight: 700 }}>LIVE</span>
          )}
          {facesBlurEnabled && liveEnabled && (
            <span style={{ fontSize: 10, background: '#3b82f6', color: '#fff', padding: '2px 7px', borderRadius: 20, fontWeight: 700 }}>FACE BLUR</span>
          )}
        </div>
        <span style={{ fontSize: 10, color: '#94a3b8' }}>v0.1</span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', padding: '8px 14px 0', gap: 4 }}>
        <button style={tabStyle('main')} onClick={() => setTab('main')}>Main</button>
        <button style={tabStyle('live')} onClick={() => setTab('live')}>
          {liveEnabled ? '🟢 ' : ''}Live
        </button>
        <button style={tabStyle('zones')} onClick={() => setTab('zones')}>
          Zones {zones.length > 0 ? `(${zones.length})` : ''}
        </button>
      </div>

      {/* ── Main Tab ────────────────────────────────────────────────────── */}
      {tab === 'main' && (
        <div style={{ padding: 14 }}>
          <a
            href={`${WEB_APP_BASE}/`}
            target="_blank"
            rel="noreferrer"
            style={{ display: 'block', background: '#3b82f6', color: '#fff', padding: '9px 14px', borderRadius: 8, textDecoration: 'none', textAlign: 'center', fontSize: 13, fontWeight: 600, marginBottom: 12 }}
          >
            Open Redact Tool
          </a>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>Live Camera Protection</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Detect cards, plates, faces & documents</div>
            </div>
            <button onClick={() => { void toggleLive(); setTab('live'); }} style={liveEnabled ? BTN_DANGER : BTN_SUCCESS}>
              {liveEnabled ? 'Stop' : 'Enable'}
            </button>
          </div>

          {suppressed.length > 0 && (
            <div>
              <p style={{ fontSize: 11, color: '#64748b', marginBottom: 5 }}>Suppressed sites:</p>
              {suppressed.map((site) => (
                <button
                  key={site}
                  onClick={() => void handleRemoveSuppressed(site)}
                  style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '5px 9px', borderRadius: 6, fontSize: 12, cursor: 'pointer', marginBottom: 4, color: '#334155' }}
                >
                  <span>{site}</span><span style={{ color: '#94a3b8' }}>✕</span>
                </button>
              ))}
            </div>
          )}

          <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 10 }}>
            Right-click any PDF, DOCX, image link, or inline image to redact it.
          </p>
        </div>
      )}

      {/* ── Live Protection Tab ──────────────────────────────────────────── */}
      {tab === 'live' && (
        <div style={{ padding: 14 }}>
          {/* Camera toggle row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>Live Protection Mode</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>
                {liveEnabled ? 'Camera active — detecting objects' : 'Off — camera not accessed'}
              </div>
            </div>
            <button onClick={() => void toggleLive()} style={liveEnabled ? BTN_DANGER : BTN_SUCCESS}>
              {liveEnabled ? '⏹ Stop' : '▶ Start'}
            </button>
          </div>

          {cameraError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 10 }}>
              {cameraError}
            </div>
          )}

          {/* 6.5 — Document alert banner */}
          {docAlert && !docBlurActive && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f3e8ff', border: '1px solid #a855f7', borderRadius: 8, padding: '8px 12px', marginBottom: 10, gap: 8 }}>
              <span style={{ fontSize: 12, color: '#581c87', flex: 1 }}>📄 Document visible — blur it?</span>
              <button onClick={() => void handleDocBlur()} style={{ ...BTN_PURPLE, padding: '4px 10px', fontSize: 11 }}>Blur</button>
              <button onClick={handleDocDismiss} style={{ ...BTN_OUTLINE, padding: '4px 8px', fontSize: 11 }}>✕</button>
            </div>
          )}
          {docBlurActive && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f3e8ff', border: '1px solid #a855f7', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: '#581c87' }}>📄 Document region blurred</span>
              <button onClick={() => { setDocBlurActive(false); setDocAlert(false); docAlertDismissedRef.current = false; }} style={{ ...BTN_OUTLINE, padding: '4px 8px', fontSize: 11 }}>Unblur</button>
            </div>
          )}

          {/* Camera canvas preview */}
          <div style={{ position: 'relative', background: '#0f172a', borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
            {/* Must NOT be display:none — browsers skip frame decoding for hidden videos */}
            <video ref={videoRef} muted playsInline style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />
            <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: 200, objectFit: 'contain' }} />
            {!liveEnabled && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 6, color: '#64748b' }}>
                <span style={{ fontSize: 28 }}>📷</span>
                <span style={{ fontSize: 12 }}>Enable Live Protection to start camera</span>
              </div>
            )}
          </div>

          {/* Detection count badges */}
          {liveEnabled && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              <DetBadge type="face" count={detectionCounts.face} icon="👤" label="Faces" />
              <DetBadge type="card" count={detectionCounts.card} icon="💳" label="Cards" />
              <DetBadge type="plate" count={detectionCounts.plate} icon="🚗" label="Plates" />
              <DetBadge type="document" count={detectionCounts.document} icon="📄" label="Docs" />
            </div>
          )}

          {/* 6.4 — Face Blur controls */}
          {liveEnabled && (
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: facesBlurEnabled && faceDets.length > 0 ? 8 : 0 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 12, color: '#1e40af' }}>Face Blur (FR-31)</div>
                  <div style={{ fontSize: 11, color: '#3b82f6', marginTop: 1 }}>
                    {facesBlurEnabled ? 'All faces blurred — click a face below to unblur it' : 'Off — faces shown with box only'}
                  </div>
                </div>
                <button
                  onClick={() => void toggleFaceBlur()}
                  style={facesBlurEnabled ? { ...BTN_DANGER, padding: '5px 12px', fontSize: 11 } : { ...BTN_PRIMARY, padding: '5px 12px', fontSize: 11 }}
                >
                  {facesBlurEnabled ? 'Disable' : 'Enable'}
                </button>
              </div>

              {/* Per-face selective unblur (FR-31) */}
              {facesBlurEnabled && faceDets.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {faceDets.map((_, fi) => {
                    const isUnblurred = unblurredFaceIndices.includes(fi);
                    return (
                      <div key={fi} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '4px 8px' }}>
                        <span style={{ fontSize: 11, color: '#1e40af' }}>👤 Face {fi + 1}</span>
                        <button
                          onClick={() => toggleUnblurFace(fi)}
                          style={{ ...BTN_OUTLINE, padding: '2px 8px', fontSize: 10, border: isUnblurred ? '1px solid #3b82f6' : '1px solid #e2e8f0', color: isUnblurred ? '#3b82f6' : '#64748b' }}
                        >
                          {isUnblurred ? 'Re-blur' : 'Unblur'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 6.5 — Auto-blur docs setting */}
          {liveEnabled && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 12, color: '#581c87' }}>Auto-blur documents (FR-32)</div>
                <div style={{ fontSize: 11, color: '#7c3aed', marginTop: 1 }}>Blur instantly when doc/whiteboard detected</div>
              </div>
              <button
                onClick={() => void handleToggleAutoBlurDocs()}
                style={autoBlurDocs ? { ...BTN_PURPLE, padding: '5px 12px', fontSize: 11 } : { ...BTN_OUTLINE, padding: '5px 12px', fontSize: 11 }}
              >
                {autoBlurDocs ? 'On' : 'Off'}
              </button>
            </div>
          )}

          {/* Detection list */}
          {overlayDetections.length > 0 && (
            <div style={{ borderRadius: 8, border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: 10 }}>
              {overlayDetections.map((det, i) => {
                const iconMap: Record<DetectionObjectType, string> = { card: '💳', plate: '🚗', face: '👤', document: '📄' };
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: i % 2 === 0 ? '#f8fafc' : '#fff', fontSize: 12 }}>
                    <span>{iconMap[det.type]}</span>
                    <span style={{ flex: 1, color: '#334155' }}>{det.label}</span>
                    <span style={{ fontSize: 10, background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, color: '#64748b', fontFamily: 'monospace' }}>
                      {Math.round(det.confidence * 100)}%
                    </span>
                    <span style={{ fontSize: 10, background: '#dcfce7', color: '#15803d', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>HIDDEN</span>
                  </div>
                );
              })}
            </div>
          )}

          {liveEnabled && overlayDetections.length === 0 && (
            <p style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', padding: '8px 0' }}>
              Scanning… hold a card, plate, or show your face to test detection.
            </p>
          )}

          {zones.length > 0 && (
            <p style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
              🔴 {zones.length} persistent zone{zones.length !== 1 ? 's' : ''} active — always hidden.
            </p>
          )}

          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8, lineHeight: 1.5 }}>
            All detection runs locally in your browser — no video is transmitted.
          </div>
        </div>
      )}

      {/* ── Zones Tab (FR-33) ────────────────────────────────────────────── */}
      {tab === 'zones' && (
        <div style={{ padding: 14 }}>
          <p style={{ fontSize: 12, color: '#64748b', marginBottom: 10, lineHeight: 1.5 }}>
            Draw up to 5 "always private" zones on your camera feed. These regions are permanently obscured whenever Live Protection is active.
          </p>

          <div style={{ position: 'relative', background: '#0f172a', borderRadius: 10, overflow: 'hidden', marginBottom: 10, cursor: zones.length < 5 ? 'crosshair' : 'not-allowed' }}>
            <canvas
              ref={zoneCanvasRef}
              width={340}
              height={191}
              style={{ display: 'block', width: '100%' }}
              onMouseDown={onZoneMouseDown}
              onMouseMove={onZoneMouseMove}
              onMouseUp={() => void onZoneMouseUp()}
              onMouseLeave={() => void onZoneMouseUp()}
            />
          </div>

          {zones.length >= 5 && (
            <p style={{ fontSize: 11, color: '#f59e0b', background: '#fef3c7', border: '1px solid #fcd34d', padding: '6px 10px', borderRadius: 6, marginBottom: 8 }}>
              Maximum 5 zones reached.
            </p>
          )}

          {zones.length > 0 ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontWeight: 600, fontSize: 12 }}>Zones ({zones.length}/5)</span>
                <button onClick={() => void clearZones()} style={{ ...BTN_OUTLINE, padding: '4px 10px', fontSize: 11 }}>Clear All</button>
              </div>
              {zones.map((zone, i) => (
                <div key={zone.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, marginBottom: 4, fontSize: 11 }}>
                  <span style={{ color: '#ef4444', fontWeight: 700 }}>{i + 1}</span>
                  <span style={{ flex: 1, fontFamily: 'monospace', color: '#334155' }}>
                    {Math.round(zone.width)}×{Math.round(zone.height)} at ({Math.round(zone.x)},{Math.round(zone.y)})
                  </span>
                  <button onClick={() => void removeZone(zone.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 14, padding: '0 2px' }}>✕</button>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', padding: '12px 0' }}>
              No zones defined. Draw on the camera preview above.
            </p>
          )}

          <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 10 }}>
            Zones are saved and restored across browser sessions (chrome.storage.local).
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Detection badge sub-component ───────────────────────────────────────────

function DetBadge({ type, count, icon, label }: {
  type: DetectionObjectType; count: number; icon: string; label: string;
}) {
  const active = count > 0;
  const bgMap: Record<DetectionObjectType, string> = {
    face: active ? '#dbeafe' : '#f8fafc',
    card: active ? '#fef3c7' : '#f8fafc',
    plate: active ? '#d1fae5' : '#f8fafc',
    document: active ? '#f3e8ff' : '#f8fafc',
  };
  const colorMap: Record<DetectionObjectType, string> = {
    face: active ? '#1d4ed8' : '#94a3b8',
    card: active ? '#b45309' : '#94a3b8',
    plate: active ? '#15803d' : '#94a3b8',
    document: active ? '#7c3aed' : '#94a3b8',
  };
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', background: bgMap[type], borderRadius: 8, padding: '6px 4px', border: `1px solid ${active ? colorMap[type] : '#e2e8f0'}`, color: colorMap[type] }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <span style={{ fontSize: 16, fontWeight: 700, lineHeight: 1 }}>{count}</span>
      <span style={{ fontSize: 9, marginTop: 1 }}>{label}</span>
    </div>
  );
}

// ─── Canvas helpers ───────────────────────────────────────────────────────────

function applyZoneBlur(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, zone: CameraZone): void {
  const { x, y, width: w, height: h } = zone;
  if (w <= 0 || h <= 0) return;
  const tw = Math.max(1, Math.round(w / 10));
  const th = Math.max(1, Math.round(h / 10));
  const off = document.createElement('canvas');
  off.width = tw; off.height = th;
  off.getContext('2d')!.drawImage(canvas, x, y, w, h, 0, 0, tw, th);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(off, 0, 0, tw, th, x, y, w, h);
  ctx.strokeStyle = 'rgba(239,68,68,0.6)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);
}

function applyBlurToRegion(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, x: number, y: number, w: number, h: number): void {
  if (w <= 2 || h <= 2) return;
  const tw = Math.max(1, Math.round(w / 12));
  const th = Math.max(1, Math.round(h / 12));
  const off = document.createElement('canvas');
  off.width = tw; off.height = th;
  off.getContext('2d')!.drawImage(canvas, x, y, w, h, 0, 0, tw, th);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(off, 0, 0, tw, th, x, y, w, h);
}
