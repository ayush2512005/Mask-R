import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useRedactionStore } from '@/stores/redaction.store';
import { useFileStore } from '@/stores/file.store';
import { MaskingStyle, type RedactionRegion, type PiiType } from '@redact/shared';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Undo2, Redo2, ScanFace, Loader2, Search, Plus, X, EyeOff } from 'lucide-react';
import { useImageProcessor, useImageFaceDetector } from '@/hooks/useImageProcessor';
import { usePiiDetection } from '@/hooks/usePiiDetection';
import { PiiReviewPanel } from '../detection/PiiReviewPanel';
import { Progress } from '../ui/Progress';
import { cn } from '@/lib/utils';

interface DrawState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  active: boolean;
}

interface ImageEditorProps {
  enabledTypes?: PiiType[];
}

function countOccurrences(text: string, term: string): number {
  if (!text || !term.trim()) return 0;
  try {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return (text.match(new RegExp(escaped, 'gi')) ?? []).length;
  } catch {
    return 0;
  }
}

function getImageMimeType(fileType: string | undefined): string {
  const t = (fileType ?? '').toUpperCase();
  if (t === 'JPEG' || t === 'JPG') return 'image/jpeg';
  if (t === 'PNG') return 'image/png';
  if (t === 'WEBP') return 'image/webp';
  // BMP and TIFF not natively supported by canvas toBlob — fall back to PNG
  return 'image/png';
}

function applyMask(
  ctx: CanvasRenderingContext2D,
  sourceImg: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  style: MaskingStyle,
): void {
  if (width <= 0 || height <= 0) return;
  switch (style) {
    case MaskingStyle.BLUR: {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, width, height);
      ctx.clip();
      ctx.filter = 'blur(14px)';
      ctx.drawImage(sourceImg, 0, 0);
      ctx.filter = 'none';
      ctx.restore();
      break;
    }
    case MaskingStyle.PIXELATE: {
      const BLOCK = Math.max(4, Math.ceil(Math.min(width, height) / 12));
      const tW = Math.max(1, Math.floor(width / BLOCK));
      const tH = Math.max(1, Math.floor(height / BLOCK));
      const tmp = document.createElement('canvas');
      tmp.width = tW;
      tmp.height = tH;
      const tCtx = tmp.getContext('2d')!;
      tCtx.imageSmoothingEnabled = false;
      tCtx.drawImage(sourceImg, x, y, width, height, 0, 0, tW, tH);
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tmp, 0, 0, tW, tH, x, y, width, height);
      ctx.restore();
      break;
    }
    case MaskingStyle.REDACTED_LABEL: {
      ctx.fillStyle = '#000000';
      ctx.fillRect(x, y, width, height);
      const fs = Math.max(9, Math.min(height * 0.45, width / 9, 22));
      ctx.save();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold ${fs}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('[REDACTED]', x + width / 2, y + height / 2, width - 4);
      ctx.restore();
      break;
    }
    case MaskingStyle.FAKE_DATA: {
      ctx.fillStyle = '#5B5EF4';
      ctx.fillRect(x, y, width, height);
      const fs = Math.max(8, Math.min(height * 0.4, 14));
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = `bold ${fs}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('REDACTED', x + width / 2, y + height / 2, width - 4);
      ctx.restore();
      break;
    }
    default: // BLACK_BOX
      ctx.fillStyle = '#000000';
      ctx.fillRect(x, y, width, height);
  }
}

export function ImageEditor({ enabledTypes }: ImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [drawing, setDrawing] = useState<DrawState | null>(null);
  const [history, setHistory] = useState<RedactionRegion[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [extracted, setExtracted] = useState(false);
  const [ocrRegions, setOcrRegions] = useState<RedactionRegion[]>([]);
  const [faceRegions, setFaceRegions] = useState<RedactionRegion[]>([]);
  const [textSearch, setTextSearch] = useState('');

  const { fileBuffer, fileMetadata } = useFileStore();
  const {
    regions, addRegion, removeRegion, maskingStyle,
    customTerms, approvedItems, addCustomTerm, removeCustomTerm,
  } = useRedactionStore();
  const setRedactedBuffer = useRedactionStore((s) => s.setRedactedBuffer);
  const { extractText, progress, stage, status, result } = useImageProcessor();
  const { detectFaces, status: faceStatus, result: faceResult } = useImageFaceDetector();
  const { detect, status: piiStatus } = usePiiDetection();

  // Unique words from OCR for the text-search chip list
  const ocrUniqueWords = useMemo(() => {
    if (!result?.words) return [];
    const seen = new Set<string>();
    return result.words
      .map((w) => w.text.trim())
      .filter((t) => t.length >= 1 && /\w/.test(t))
      .filter((t) => {
        const lower = t.toLowerCase();
        if (seen.has(lower)) return false;
        seen.add(lower);
        return true;
      })
      .sort((a, b) => a.localeCompare(b));
  }, [result?.words]);

  // Load image into canvas on file change
  useEffect(() => {
    if (!fileBuffer || !fileMetadata) return;
    const blob = new Blob([fileBuffer], { type: `image/${fileMetadata.type.toLowerCase()}` });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      redrawCanvas();
      URL.revokeObjectURL(url);
    };
    img.src = url;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileBuffer, fileMetadata]);

  // Auto-run OCR on mount
  useEffect(() => {
    if (fileBuffer && !extracted) {
      extractText(fileBuffer);
      setExtracted(true);
    }
  }, [fileBuffer, extracted, extractText]);

  // Feed OCR text into PII detection
  useEffect(() => {
    if (result?.text) {
      detect(result.text, customTerms, enabledTypes);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result?.text, detect]);

  useEffect(() => {
    if (result?.text) {
      detect(result.text, customTerms, enabledTypes);
    }
  }, [customTerms, enabledTypes, detect, result?.text]);

  // Map approved PII items + custom terms → canvas overlay regions
  useEffect(() => {
    if (!result?.words) return;
    const terms = [
      ...approvedItems.map((i) => i.text.toLowerCase()),
      ...customTerms.map((t) => t.toLowerCase()),
    ].filter(Boolean);

    const newRegions: RedactionRegion[] = [];
    for (const term of terms) {
      for (const w of result.words) {
        if (w.text.toLowerCase().includes(term) || term.includes(w.text.toLowerCase())) {
          newRegions.push({
            id: `ocr-${uuidv4()}`,
            boundingBox: w.bbox,
            pageIndex: 0,
            maskingStyle,
          });
        }
      }
    }
    setOcrRegions(newRegions);
  }, [result?.words, approvedItems, customTerms, maskingStyle]);

  // Turn face detection results into pre-selected regions
  useEffect(() => {
    if (!faceResult?.faces) return;
    setFaceRegions(
      faceResult.faces.map((box) => ({
        id: `face-${uuidv4()}`,
        boundingBox: box,
        pageIndex: 0,
        maskingStyle,
      }))
    );
  }, [faceResult, maskingStyle]);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);

    const isDrawing = drawing?.active === true;

    if (isDrawing) {
      // Fast colored overlays during active drawing for smooth interaction
      ctx.fillStyle = 'rgba(91,94,244,0.72)';
      for (const r of regions) {
        const { x, y, width, height } = r.boundingBox;
        ctx.fillRect(x, y, width, height);
      }
      ctx.fillStyle = 'rgba(244,63,94,0.72)';
      for (const r of ocrRegions) {
        const { x, y, width, height } = r.boundingBox;
        ctx.fillRect(x, y, width, height);
      }
      for (const r of faceRegions) {
        const { x, y, width, height } = r.boundingBox;
        ctx.fillStyle = 'rgba(59,130,246,0.5)';
        ctx.fillRect(x, y, width, height);
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.strokeRect(x, y, width, height);
      }
    } else {
      // Real masking preview so the canvas shows exactly what the export will look like
      for (const r of [...regions, ...ocrRegions]) {
        const { x, y, width, height } = r.boundingBox;
        applyMask(ctx, img, x, y, width, height, r.maskingStyle);
      }
      for (const r of faceRegions) {
        const { x, y, width, height } = r.boundingBox;
        applyMask(ctx, img, x, y, width, height, MaskingStyle.BLUR);
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.strokeRect(x, y, width, height);
      }
    }

    // Active draw preview (dashed selection rectangle)
    if (drawing?.active) {
      const x = Math.min(drawing.startX, drawing.currentX);
      const y = Math.min(drawing.startY, drawing.currentY);
      const w = Math.abs(drawing.currentX - drawing.startX);
      const h = Math.abs(drawing.currentY - drawing.startY);
      ctx.strokeStyle = '#5B5EF4';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = 'rgba(91,94,244,0.18)';
      ctx.fillRect(x, y, w, h);
    }
  }, [regions, ocrRegions, faceRegions, drawing]);

  useEffect(() => { redrawCanvas(); }, [redrawCanvas]);

  function canvasPos(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
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
      const region: RedactionRegion = {
        id: uuidv4(),
        boundingBox: { x, y, width, height },
        pageIndex: 0,
        maskingStyle,
      };
      addRegion(region);
      const snap = [...regions, region];
      const newHistory = [...history.slice(0, historyIndex + 1), snap];
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
    setDrawing(null);
  }

  function undo() {
    if (historyIndex === 0) return;
    const idx = historyIndex - 1;
    const prev = history[idx] ?? [];
    const toRemove = regions.slice(prev.length);
    toRemove.forEach((r) => removeRegion(r.id));
    setHistoryIndex(idx);
  }

  function redo() {
    if (historyIndex >= history.length - 1) return;
    setHistoryIndex(historyIndex + 1);
  }

  function removeFaceRegion(id: string) {
    setFaceRegions((prev) => prev.filter((r) => r.id !== id));
  }

  function handleRedact() {
    const img = imgRef.current;
    if (!img) return;

    const offscreen = document.createElement('canvas');
    offscreen.width = img.naturalWidth;
    offscreen.height = img.naturalHeight;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(img, 0, 0);

    for (const r of [...regions, ...ocrRegions]) {
      const { x, y, width, height } = r.boundingBox;
      applyMask(ctx, img, x, y, width, height, r.maskingStyle);
    }
    for (const r of faceRegions) {
      const { x, y, width, height } = r.boundingBox;
      applyMask(ctx, img, x, y, width, height, MaskingStyle.BLUR);
    }

    const mime = getImageMimeType(fileMetadata?.type);
    offscreen.toBlob(async (blob) => {
      if (blob) {
        setRedactedBuffer(await blob.arrayBuffer());
      } else {
        // toBlob returned null (unsupported mime) — retry as PNG
        offscreen.toBlob(async (b) => {
          if (b) setRedactedBuffer(await b.arrayBuffer());
        }, 'image/png');
      }
    }, mime);
  }

  function handleAddSearchTerm() {
    const term = textSearch.trim().toLowerCase();
    if (!term) return;
    addCustomTerm(term);
    setTextSearch('');
  }

  const totalRegions = regions.length + ocrRegions.length + faceRegions.length;
  const searchPreviewCount = useMemo(
    () => countOccurrences(result?.text ?? '', textSearch.trim()),
    [result?.text, textSearch],
  );

  return (
    <div className="flex flex-col gap-4">
      {status === 'running' && (
        <div className="space-y-1.5">
          <Progress value={progress} />
          <p className="text-xs text-muted-foreground">{stage}</p>
        </div>
      )}

      {piiStatus === 'running' && (
        <p className="text-xs text-muted-foreground animate-pulse">Scanning image for PII…</p>
      )}

      {result?.text && <PiiReviewPanel />}

      {/* ── Text / Word Search Panel ─────────────────────────────── */}
      {result !== null && (
        <div className="rounded-xl border border-border bg-gradient-to-br from-card to-primary/3 p-3.5 space-y-3">
          <div className="flex items-center gap-2">
            <EyeOff className="h-3.5 w-3.5 text-primary shrink-0" />
            <p className="text-sm font-semibold text-foreground">Find &amp; Redact Text</p>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                className="h-8 text-sm pl-8"
                placeholder="Type a word or letter to redact…"
                value={textSearch}
                onChange={(e) => setTextSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSearchTerm()}
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleAddSearchTerm}
              disabled={!textSearch.trim()}
              aria-label="Add word"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {textSearch.trim() && result?.text && (
            <p className="text-xs">
              {searchPreviewCount > 0 ? (
                <span className="text-success font-medium">
                  Found {searchPreviewCount} match{searchPreviewCount !== 1 ? 'es' : ''} in image text
                </span>
              ) : (
                <span className="text-muted-foreground">Not found in detected text</span>
              )}
            </p>
          )}

          {/* OCR word chips — click to toggle redaction */}
          {ocrUniqueWords.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Detected words (click to redact):</p>
              <div className="max-h-24 overflow-y-auto">
                <div className="flex flex-wrap gap-1">
                  {ocrUniqueWords.map((word) => {
                    const lower = word.toLowerCase();
                    const active = customTerms.some((t) => t.toLowerCase() === lower);
                    return (
                      <button
                        key={word}
                        onClick={() => active ? removeCustomTerm(lower) : addCustomTerm(lower)}
                        className={cn(
                          'rounded px-2 py-0.5 text-xs font-medium border transition-colors',
                          active
                            ? 'bg-primary/10 text-primary border-primary/30'
                            : 'bg-muted text-muted-foreground border-border hover:bg-primary/5 hover:text-primary hover:border-primary/20'
                        )}
                      >
                        {word}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {ocrUniqueWords.length === 0 && result?.text === '' && (
            <p className="text-xs text-muted-foreground">No text detected in this image.</p>
          )}

          {/* Active redaction terms */}
          {customTerms.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {customTerms.map((term) => (
                <span
                  key={term}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/8 border border-primary/20 px-2.5 py-0.5 text-xs text-primary"
                >
                  {term}
                  <button
                    onClick={() => removeCustomTerm(term)}
                    className="hover:text-destructive ml-0.5 rounded"
                    aria-label={`Remove "${term}"`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {customTerms.length > 0 && (
            <p className="text-[11px] text-muted-foreground bg-primary/5 border border-primary/15 rounded-lg px-3 py-2">
              {customTerms.length} term{customTerms.length !== 1 ? 's' : ''} — highlighted in{' '}
              <span className="text-primary font-medium">indigo</span> on the canvas. Click{' '}
              <strong className="text-foreground">Apply Redactions</strong> to burn them in.
            </p>
          )}
        </div>
      )}

      {/* Face detection controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => fileBuffer && detectFaces(fileBuffer)}
          disabled={faceStatus === 'running' || !fileBuffer}
        >
          {faceStatus === 'running' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ScanFace className="h-3.5 w-3.5" />
          )}
          {faceStatus === 'running' ? 'Detecting…' : 'Detect Faces'}
        </Button>

        {faceRegions.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {faceRegions.length} face{faceRegions.length !== 1 ? 's' : ''} detected (click to unblur)
          </span>
        )}
      </div>

      {/* Face region opt-out chips */}
      {faceRegions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {faceRegions.map((r, i) => (
            <button
              key={r.id}
              onClick={() => removeFaceRegion(r.id)}
              className="inline-flex items-center gap-1 rounded-full border border-blue-300 bg-blue-50 px-2.5 py-0.5 text-xs text-blue-700 hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-colors"
              title="Click to unblur this face"
            >
              Face {i + 1} ✕
            </button>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-4 rounded-sm bg-primary/70" />
          Manual
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-4 rounded-sm bg-rose/70" />
          Auto-detected
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-4 rounded-sm bg-blue-400/70" />
          Face
        </span>
      </div>

      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={undo} disabled={historyIndex === 0} aria-label="Undo">
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="outline" onClick={redo} disabled={historyIndex >= history.length - 1} aria-label="Redo">
          <Redo2 className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground self-center">
          {totalRegions} region{totalRegions !== 1 ? 's' : ''} selected
        </span>
        <Button size="sm" onClick={handleRedact} disabled={totalRegions === 0} className="ml-auto">
          Apply Redactions ({totalRegions})
        </Button>
      </div>

      <div className="overflow-auto rounded-xl border border-zinc-700 bg-zinc-950">
        <canvas
          ref={canvasRef}
          className="max-w-full cursor-crosshair"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          aria-label="Image editor — draw rectangles to mark regions for redaction"
          role="img"
        />
      </div>
    </div>
  );
}
