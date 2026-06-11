import { useRef, useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useRedactionStore } from '@/stores/redaction.store';
import { useFileStore } from '@/stores/file.store';
import type { RedactionRegion, PiiType } from '@redact/shared';
import { Button } from '../ui/Button';
import { Undo2, Redo2, ScanFace, Loader2 } from 'lucide-react';
import { useImageProcessor, useImageFaceDetector } from '@/hooks/useImageProcessor';
import { usePiiDetection } from '@/hooks/usePiiDetection';
import { PiiReviewPanel } from '../detection/PiiReviewPanel';
import { Progress } from '../ui/Progress';

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

export function ImageEditor({ enabledTypes }: ImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [drawing, setDrawing] = useState<DrawState | null>(null);
  const [history, setHistory] = useState<RedactionRegion[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [extracted, setExtracted] = useState(false);
  const [ocrRegions, setOcrRegions] = useState<RedactionRegion[]>([]);
  const [faceRegions, setFaceRegions] = useState<RedactionRegion[]>([]);

  const { fileBuffer, fileMetadata } = useFileStore();
  const { regions, addRegion, removeRegion, maskingStyle, customTerms, approvedItems } = useRedactionStore();
  const setRedactedBuffer = useRedactionStore((s) => s.setRedactedBuffer);
  const { extractText, progress, stage, status, result } = useImageProcessor();
  const { detectFaces, status: faceStatus, result: faceResult } = useImageFaceDetector();
  const { detect, status: piiStatus } = usePiiDetection();

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
  // redrawCanvas is stable (defined below with useCallback); listing it would cause a loop
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

  // Map approved PII items → canvas overlay regions
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

    // Manual + OCR regions — black overlay
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    for (const r of [...regions, ...ocrRegions]) {
      const { x, y, width, height } = r.boundingBox;
      ctx.fillRect(x, y, width, height);
    }

    // Face regions — distinct blue-tinted overlay so user can opt out
    for (const r of faceRegions) {
      const { x, y, width, height } = r.boundingBox;
      ctx.fillStyle = 'rgba(59,130,246,0.5)';
      ctx.fillRect(x, y, width, height);
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.strokeRect(x, y, width, height);
    }

    // Active draw preview
    if (drawing?.active) {
      const x = Math.min(drawing.startX, drawing.currentX);
      const y = Math.min(drawing.startY, drawing.currentY);
      const w = Math.abs(drawing.currentX - drawing.startX);
      const h = Math.abs(drawing.currentY - drawing.startY);
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = 'rgba(59,130,246,0.2)';
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
    ctx.fillStyle = '#000000';
    for (const r of [...regions, ...ocrRegions, ...faceRegions]) {
      const { x, y, width, height } = r.boundingBox;
      ctx.fillRect(x, y, width, height);
    }

    offscreen.toBlob(async (blob) => {
      if (blob) setRedactedBuffer(await blob.arrayBuffer());
    }, `image/${fileMetadata?.type.toLowerCase() || 'png'}`);
  }

  const totalRegions = regions.length + ocrRegions.length + faceRegions.length;

  return (
    <div className="flex flex-col gap-4">
      {status === 'running' && (
        <div className="space-y-1.5">
          <Progress value={progress} />
          <p className="text-xs text-muted-foreground">{stage}</p>
        </div>
      )}

      {piiStatus === 'running' && (
        <p className="text-xs text-muted-foreground animate-pulse">Scanning image for PII...</p>
      )}

      {result?.text && <PiiReviewPanel />}

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

      <div className="overflow-auto rounded-lg border border-border bg-muted/30">
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
