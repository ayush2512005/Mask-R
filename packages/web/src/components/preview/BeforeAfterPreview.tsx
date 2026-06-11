import { useEffect, useRef } from 'react';
import { useFileStore } from '@/stores/file.store';
import { useRedactionStore } from '@/stores/redaction.store';
import { SupportedFileType } from '@redact/shared';
import { Button } from '../ui/Button';
import { Pencil } from 'lucide-react';

export function BeforeAfterPreview() {
  const { fileBuffer, fileMetadata, fileType } = useFileStore();
  const { redactedBuffer, clearRedactedBuffer } = useRedactionStore();
  const beforeRef = useRef<HTMLCanvasElement>(null);
  const afterRef = useRef<HTMLCanvasElement>(null);

  const isImage = fileType && [
    SupportedFileType.JPEG, SupportedFileType.PNG,
    SupportedFileType.WEBP, SupportedFileType.BMP,
  ].includes(fileType);

  const isPdf = fileType === SupportedFileType.PDF;

  useEffect(() => {
    if ((!isImage && !isPdf) || !fileBuffer || !redactedBuffer) return;
    const mimeType = `image/${fileMetadata?.type.toLowerCase() ?? 'png'}`;

    function drawToCanvas(canvas: HTMLCanvasElement | null, buf: ArrayBuffer) {
      if (!canvas) return;
      const blob = new Blob([buf], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d')?.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
      };
      img.src = url;
    }

    async function drawPdfToCanvas(canvas: HTMLCanvasElement | null, buf: ArrayBuffer) {
      if (!canvas) return;
      try {
        const pdfjsLib = await import('pdfjs-dist');
        const workerUrl = await import('pdfjs-dist/build/pdf.worker.mjs?url');
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl.default;

        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buf.slice(0)) });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1.5 });

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          await page.render({ canvasContext: ctx, viewport }).promise;
        }
      } catch (err) {
        console.error('Failed to render PDF preview:', err);
      }
    }

    if (isImage) {
      drawToCanvas(beforeRef.current, fileBuffer);
      drawToCanvas(afterRef.current, redactedBuffer);
    } else if (isPdf) {
      drawPdfToCanvas(beforeRef.current, fileBuffer);
      drawPdfToCanvas(afterRef.current, redactedBuffer);
    }
  }, [isImage, isPdf, fileBuffer, redactedBuffer, fileMetadata]);

  if (!redactedBuffer) return null;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Before / After Preview</h3>
        <Button size="sm" variant="outline" onClick={clearRedactedBuffer} className="gap-1.5">
          <Pencil className="h-3.5 w-3.5" />
          Back to Edit
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">Original</p>
          {isImage || isPdf ? (
            <canvas ref={beforeRef} className="w-full rounded border" />
          ) : (
            <div className="flex items-center justify-center h-32 rounded border bg-muted/30 text-xs text-muted-foreground">
              Original document
            </div>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">Redacted</p>
          {isImage || isPdf ? (
            <canvas ref={afterRef} className="w-full rounded border" />
          ) : (
            <div className="flex items-center justify-center h-32 rounded border bg-muted/30 text-xs text-muted-foreground">
              Redacted document
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
