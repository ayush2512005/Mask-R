import { useRedactionStore } from '@/stores/redaction.store';
import { useFileStore } from '@/stores/file.store';
import { Button } from '../ui/Button';
import { Download, CheckCircle2 } from 'lucide-react';
import { downloadBuffer, getRedactedFileName } from '@/lib/utils';
import { SupportedFileType } from '@redact/shared';

const MIME_MAP: Partial<Record<SupportedFileType, string>> = {
  [SupportedFileType.PDF]: 'application/pdf',
  [SupportedFileType.DOCX]: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  [SupportedFileType.XLSX]: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  [SupportedFileType.JPEG]: 'image/jpeg',
  [SupportedFileType.PNG]: 'image/png',
  [SupportedFileType.WEBP]: 'image/webp',
  [SupportedFileType.BMP]: 'image/bmp',
  [SupportedFileType.TIFF]: 'image/tiff',
  [SupportedFileType.MP4]: 'video/webm',
  [SupportedFileType.MOV]: 'video/webm',
  [SupportedFileType.WEBM]: 'video/webm',
  [SupportedFileType.AVI]: 'video/webm',
};

export function DownloadPanel() {
  const { redactedBuffer } = useRedactionStore();
  const { fileMetadata, fileType } = useFileStore();

  if (!redactedBuffer || !fileMetadata || !fileType) return null;

  const mimeType = MIME_MAP[fileType] ?? 'application/octet-stream';
  const fileName = getRedactedFileName(fileMetadata.name);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-success">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <p className="text-sm font-semibold">Ready to download</p>
      </div>
      <p className="text-xs text-muted-foreground">
        {(redactedBuffer.byteLength / 1024 / 1024).toFixed(2)} MB · redacted file
      </p>
      <Button
        variant="success"
        className="w-full"
        onClick={() => downloadBuffer(redactedBuffer, fileName, mimeType)}
      >
        <Download className="h-4 w-4" />
        Download {fileName}
      </Button>
    </div>
  );
}
