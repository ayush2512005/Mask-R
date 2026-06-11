import { Suspense } from 'react';
import { SupportedFileType } from '@redact/shared';
import { useFileStore } from '@/stores/file.store';
import { useRedactionStore } from '@/stores/redaction.store';
import { useProfileStore } from '@/stores/profile.store';
import { PdfEditor } from './PdfEditor';
import { ImageEditor } from './ImageEditor';
import { DocxEditor } from './DocxEditor';
import { XlsxEditor } from './XlsxEditor';
import { VideoEditor } from './VideoEditor';
import { MaskingStylePicker } from '../masking/MaskingStylePicker';
import { BeforeAfterPreview } from '../preview/BeforeAfterPreview';
import { DownloadPanel } from '../preview/DownloadPanel';
import { ProfilePicker } from '../profile/ProfilePicker';
import { ProfileManager } from '../profile/ProfileManager';

const IMAGE_TYPES = new Set([
  SupportedFileType.JPEG,
  SupportedFileType.PNG,
  SupportedFileType.WEBP,
  SupportedFileType.TIFF,
  SupportedFileType.BMP,
]);

const VIDEO_TYPES = new Set([
  SupportedFileType.MP4,
  SupportedFileType.MOV,
  SupportedFileType.WEBM,
  SupportedFileType.AVI,
]);

export function RedactionEditor() {
  const { fileMetadata, fileType, errorMessage } = useFileStore();
  const { redactedBuffer } = useRedactionStore();
  const { activeProfile } = useProfileStore();

  if (!fileMetadata || !fileType) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No file loaded. Return to home to upload a file.
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="rounded-lg border border-destructive bg-destructive/5 p-4 text-destructive text-sm">
        {errorMessage}
      </div>
    );
  }

  const isImage = IMAGE_TYPES.has(fileType);
  const isVideo = VIDEO_TYPES.has(fileType);
  const isPdf = fileType === SupportedFileType.PDF;
  const isDocx = fileType === SupportedFileType.DOCX;
  const isXlsx = fileType === SupportedFileType.XLSX;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm">{fileMetadata.name}</h2>
            <span className="text-xs text-muted-foreground">
              {(fileMetadata.sizeBytes / 1024 / 1024).toFixed(1)} MB
            </span>
          </div>

          <Suspense fallback={<div className="h-32 animate-pulse bg-muted rounded" />}>
            {isPdf && <PdfEditor enabledTypes={activeProfile?.piiTypes} />}
            {isImage && <ImageEditor enabledTypes={activeProfile?.piiTypes} />}
            {isVideo && <VideoEditor />}
            {isDocx && <DocxEditor enabledTypes={activeProfile?.piiTypes} />}
            {isXlsx && <XlsxEditor enabledTypes={activeProfile?.piiTypes} />}
          </Suspense>
        </div>

        {redactedBuffer && <BeforeAfterPreview />}
      </div>

      <div className="space-y-4">
        <div className="rounded-lg border bg-card p-4 space-y-4">
          <ProfilePicker />
          <ProfileManager />
        </div>

        <div className="rounded-lg border bg-card p-4">
          <MaskingStylePicker />
        </div>

        {redactedBuffer && (
          <div className="rounded-lg border bg-card p-4">
            <DownloadPanel />
          </div>
        )}
      </div>
    </div>
  );
}
