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
import { WordHider } from './WordHider';
import { FileText, ImageIcon, Video, FileSpreadsheet, Monitor, HardDriveDownload } from 'lucide-react';

const IMAGE_TYPES = new Set([
  SupportedFileType.JPEG, SupportedFileType.PNG,
  SupportedFileType.WEBP, SupportedFileType.TIFF, SupportedFileType.BMP,
]);

const VIDEO_TYPES = new Set([
  SupportedFileType.MP4, SupportedFileType.MOV,
  SupportedFileType.WEBM, SupportedFileType.AVI,
]);

function fileIcon(type: SupportedFileType | null) {
  if (!type) return FileText;
  if (IMAGE_TYPES.has(type)) return ImageIcon;
  if (VIDEO_TYPES.has(type)) return Video;
  if (type === SupportedFileType.XLSX) return FileSpreadsheet;
  if (type === SupportedFileType.PDF || type === SupportedFileType.DOCX) return FileText;
  return Monitor;
}

const GLASS_CARD = {
  background: 'rgba(255,255,255,0.65)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.88)',
  boxShadow: '0 2px 20px rgba(0,0,0,0.07)',
} as const;

const SIDEBAR_SECTION = {
  ...GLASS_CARD,
  boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
} as const;

export function RedactionEditor() {
  const { fileMetadata, fileType, errorMessage } = useFileStore();
  const { redactedBuffer } = useRedactionStore();
  const { activeProfile } = useProfileStore();

  if (!fileMetadata || !fileType) {
    return (
      <div className="py-20 text-center text-muted-foreground text-sm">
        No file loaded. Return to home to upload a file.
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div
        className="rounded-2xl p-5 text-sm text-destructive"
        style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)' }}
      >
        {errorMessage}
      </div>
    );
  }

  const isImage = IMAGE_TYPES.has(fileType);
  const isVideo = VIDEO_TYPES.has(fileType);
  const isPdf = fileType === SupportedFileType.PDF;
  const isDocx = fileType === SupportedFileType.DOCX;
  const isXlsx = fileType === SupportedFileType.XLSX;
  const FileIcon = fileIcon(fileType);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

      {/* ── Document pane ── */}
      <div className="lg:col-span-2 space-y-4">
        <div className="rounded-2xl overflow-hidden" style={GLASS_CARD}>
          {/* Pane header */}
          <div
            className="flex items-center justify-between px-5 py-4 border-b"
            style={{ borderColor: 'rgba(226,225,240,0.6)', background: 'rgba(255,255,255,0.4)' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ background: 'linear-gradient(135deg,rgba(91,94,244,0.15),rgba(124,58,237,0.15))', border: '1px solid rgba(91,94,244,0.15)' }}
              >
                <FileIcon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground leading-tight">{fileMetadata.name}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {(fileMetadata.sizeBytes / 1024 / 1024).toFixed(2)} MB · {fileType.toUpperCase()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: 'rgba(91,94,244,0.08)', color: '#5B5EF4' }}>
              Editing
            </div>
          </div>

          {/* Editor content */}
          <div className="p-5">
            <Suspense fallback={
              <div className="h-40 rounded-xl shimmer" style={{ background: 'rgba(0,0,0,0.04)' }} />
            }>
              {isPdf   && <PdfEditor  enabledTypes={activeProfile?.piiTypes} />}
              {isImage && <ImageEditor enabledTypes={activeProfile?.piiTypes} />}
              {isVideo && <VideoEditor />}
              {isDocx  && <DocxEditor  enabledTypes={activeProfile?.piiTypes} />}
              {isXlsx  && <XlsxEditor  enabledTypes={activeProfile?.piiTypes} />}
            </Suspense>
          </div>
        </div>

        {redactedBuffer && <BeforeAfterPreview />}
      </div>

      {/* ── Control panel (sidebar) ── */}
      <div className="space-y-4">

        {/* Profile */}
        <div className="rounded-2xl p-4 space-y-4" style={SIDEBAR_SECTION}>
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Detection Profile</p>
          <ProfilePicker />
          <ProfileManager />
        </div>

        {/* Masking style */}
        <div className="rounded-2xl p-4" style={SIDEBAR_SECTION}>
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Masking Style</p>
          <MaskingStylePicker />
        </div>

        {/* Word hider (docs only) */}
        {(isPdf || isDocx || isXlsx) && <WordHider />}

        {/* Download */}
        {redactedBuffer && (
          <div className="rounded-2xl p-4" style={{ ...SIDEBAR_SECTION, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <div className="flex items-center gap-2 mb-3">
              <HardDriveDownload className="h-4 w-4 text-success" />
              <p className="text-[11px] font-bold uppercase tracking-widest text-success">Ready to download</p>
            </div>
            <DownloadPanel />
          </div>
        )}
      </div>

    </div>
  );
}
