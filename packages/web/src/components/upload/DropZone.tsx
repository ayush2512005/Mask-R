import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFileRouter } from '@/hooks/useFileRouter';
import { useSessionStore } from '@/stores/session.store';
import { useFileStore } from '@/stores/file.store';
import { SUPPORTED_EXTENSIONS } from '@/lib/constants';

const ALL_ACCEPTED = Object.keys(SUPPORTED_EXTENSIONS).join(',');

interface DropZoneProps {
  accept?: string;
  hint?: string;
  accentClass?: string;
  iconColorClass?: string;
}

export function DropZone({
  accept,
  hint,
  accentClass = 'border-primary/60 bg-primary/5',
  iconColorClass = 'text-primary',
}: DropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [typeError, setTypeError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { processFile } = useFileRouter();
  const { canProcessFile } = useSessionStore();
  const { processingStatus } = useFileStore();
  const navigate = useNavigate();

  const acceptStr = accept ?? ALL_ACCEPTED;
  const allowedMimes = new Set(acceptStr.split(',').map((s) => s.trim()).filter(Boolean));

  // Prevent browser from navigating when a file is dropped outside the zone
  useEffect(() => {
    const prevent = (e: DragEvent) => { e.preventDefault(); };
    document.addEventListener('dragover', prevent);
    document.addEventListener('drop', prevent);
    return () => {
      document.removeEventListener('dragover', prevent);
      document.removeEventListener('drop', prevent);
    };
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      setTypeError(null);
      // Check MIME type; fall back to extension when browser omits the type
      const mime = file.type || (() => {
        const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
        const extMap: Record<string, string> = {
          jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
          webp: 'image/webp', tiff: 'image/tiff', tif: 'image/tiff',
          bmp: 'image/bmp', pdf: 'application/pdf',
          docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', avi: 'video/x-msvideo',
        };
        return extMap[ext] ?? '';
      })();

      if (allowedMimes.size > 0 && !allowedMimes.has(mime)) {
        const ext = file.name.split('.').pop()?.toUpperCase() ?? 'this file type';
        setTypeError(`${ext} files are not supported here. Please use the correct service page.`);
        return;
      }
      const result = await processFile(file);
      if (result) navigate('/editor');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [processFile, navigate, acceptStr]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) void handleFile(file);
    },
    [handleFile]
  );

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void handleFile(file);
      e.target.value = '';
    },
    [handleFile]
  );

  // Open the hidden file picker programmatically — avoids the label double-trigger
  // bug where some browsers both process the drop AND activate the label click
  const openPicker = useCallback(() => {
    if (!disabled) inputRef.current?.click();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openPicker();
    }
  }, [openPicker]);

  const disabled = !canProcessFile() || processingStatus === 'loading';
  const active = (dragging || hovered) && !disabled;

  return (
    <div className="space-y-2">
      {typeError && (
        <p className="text-xs text-destructive text-center bg-destructive/5 border border-destructive/20 rounded-lg py-2 px-3">
          {typeError}
        </p>
      )}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        className={cn(
          'flex flex-col items-center justify-center gap-5 rounded-2xl border-2 border-dashed px-8 py-14 cursor-pointer transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
          active ? `${accentClass} scale-[1.01]` : 'border-border bg-muted/40',
          disabled && 'opacity-50 cursor-not-allowed pointer-events-none'
        )}
        onClick={openPicker}
        onKeyDown={onKeyDown}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onMouseEnter={() => { if (!disabled) setHovered(true); }}
        onMouseLeave={() => setHovered(false)}
        aria-label="Upload file for redaction"
        aria-disabled={disabled}
      >
        <div className={cn(
          'flex h-14 w-14 items-center justify-center rounded-2xl transition-colors duration-150',
          'bg-muted'
        )}>
          <Upload className={cn('h-7 w-7 transition-colors', active ? iconColorClass : 'text-muted-foreground')} />
        </div>

        <div className="text-center space-y-1.5">
          <p className="text-base font-semibold text-foreground">
            {dragging ? 'Release to upload' : 'Drop your file here'}
          </p>
          <p className="text-sm text-muted-foreground">
            or <span className={cn('font-medium', iconColorClass)}>click to browse</span>
          </p>
          {hint && (
            <p className="text-xs text-muted-foreground/70 mt-2">{hint}</p>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={acceptStr}
          className="sr-only"
          onChange={onInputChange}
          disabled={disabled}
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>
    </div>
  );
}
