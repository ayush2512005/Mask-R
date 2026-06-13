import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Upload, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFileRouter } from '@/hooks/useFileRouter';
import { useSessionStore } from '@/stores/session.store';
import { useFileStore } from '@/stores/file.store';
import { SUPPORTED_EXTENSIONS } from '@/lib/constants';

const ACCEPTED = Object.keys(SUPPORTED_EXTENSIONS).join(',');

export function DropZone() {
  const [dragging, setDragging] = useState(false);
  const { processFile } = useFileRouter();
  const { canProcessFile } = useSessionStore();
  const { processingStatus } = useFileStore();
  const navigate = useNavigate();

  // Prevent the browser from opening dropped files as a new page navigation.
  // Without this, dropping a file anywhere outside the zone causes a full "reload".
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
      const result = await processFile(file);
      if (result) {
        navigate('/editor');
      }
    },
    [processFile, navigate]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      e.target.value = '';
    },
    [handleFile]
  );

  const disabled = !canProcessFile() || processingStatus === 'loading';

  return (
    <label
      className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-12 cursor-pointer transition-colors',
        dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30',
        disabled && 'opacity-50 cursor-not-allowed pointer-events-none'
      )}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      aria-label="Upload file for redaction"
    >
      <div className="flex flex-col items-center gap-2 text-center">
        {dragging ? (
          <FileText className="h-12 w-12 text-primary" />
        ) : (
          <Upload className="h-12 w-12 text-muted-foreground" />
        )}
        <div>
          <p className="font-medium text-foreground">
            {dragging ? 'Drop to upload' : 'Drag & drop or click to upload'}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            PDF, DOCX, XLSX, JPEG, PNG, WebP, TIFF, BMP — up to 500 MB
          </p>
        </div>
      </div>
      <input
        type="file"
        accept={ACCEPTED}
        className="sr-only"
        onChange={onInputChange}
        disabled={disabled}
        aria-hidden="true"
      />
    </label>
  );
}
