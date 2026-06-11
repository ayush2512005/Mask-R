import { useCallback, useRef, useState } from 'react';
import { Upload, X, Download, Loader2, CheckCircle2, AlertCircle, FileText, Sheet, FileImage } from 'lucide-react';
import { MaskingStyle, SupportedFileType, SUPPORTED_MIME_TYPES, UserTier } from '@redact/shared';
import type { PiiType } from '@redact/shared';
import { PricingGate } from '@/components/auth/PricingGate';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/Progress';
import { ProfilePicker } from '@/components/profile/ProfilePicker';
import { useProfileStore } from '@/stores/profile.store';
import { useBatchProcessor } from '@/hooks/useBatchProcessor';
import type { BatchItem } from '@/hooks/useBatchProcessor';

const ACCEPTED_TYPES = Object.keys(SUPPORTED_MIME_TYPES).join(',');

function fileTypeIcon(type: SupportedFileType) {
  if (type === SupportedFileType.PDF) return <FileText className="h-4 w-4 text-red-500" />;
  if (type === SupportedFileType.DOCX) return <FileText className="h-4 w-4 text-blue-500" />;
  if (type === SupportedFileType.XLSX) return <Sheet className="h-4 w-4 text-green-600" />;
  return <FileImage className="h-4 w-4 text-purple-500" />;
}

function statusIcon(item: BatchItem) {
  if (item.status === 'done') return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  if (item.status === 'error') return <AlertCircle className="h-4 w-4 text-destructive" />;
  if (item.status !== 'pending') return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
  return null;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function Batch() {
  const [dragging, setDragging] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { activeProfile } = useProfileStore();
  const {
    items,
    isProcessing,
    doneCount,
    errorCount,
    totalProgress,
    process,
    downloadAll,
  } = useBatchProcessor();

  const hasResults = items.length > 0 && !isProcessing;
  const allDone = hasResults && items.every((i) => i.status === 'done' || i.status === 'error');

  function addToStaged(incoming: FileList | null) {
    if (!incoming) return;
    const supported = Array.from(incoming).filter((f) => SUPPORTED_MIME_TYPES[f.type]);
    setStagedFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name));
      return [...prev, ...supported.filter((f) => !existingNames.has(f.name))];
    });
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addToStaged(e.dataTransfer.files);
  }, []);

  function removeStaged(name: string) {
    setStagedFiles((prev) => prev.filter((f) => f.name !== name));
  }

  async function handleProcess() {
    if (stagedFiles.length === 0) return;
    const maskingStyle = activeProfile?.maskingStyle ?? MaskingStyle.BLACK_BOX;
    const enabledTypes: PiiType[] | undefined = activeProfile?.piiTypes;
    await process(stagedFiles, { maskingStyle, enabledTypes });
    setStagedFiles([]);
  }

  return (
    <PricingGate requiredTier={UserTier.PRO} feature="Batch Redaction">
    <div className="container mx-auto px-4 py-10 max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Batch Redaction</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload multiple files. All PII will be auto-detected and redacted. Download as a ZIP.
          <br />
          <span className="font-medium text-foreground">Images require manual review — use the single-file editor.</span>
        </p>
      </div>

      {/* Profile selector */}
      <div className="rounded-lg border bg-card p-4 space-y-2">
        <p className="text-sm font-medium">Redaction profile</p>
        <ProfilePicker />
        {activeProfile && (
          <p className="text-xs text-muted-foreground">
            Style: <span className="font-medium">{activeProfile.maskingStyle.replace('_', ' ')}</span> ·{' '}
            Types: <span className="font-medium">{activeProfile.piiTypes.length} PII types enabled</span>
          </p>
        )}
      </div>

      {/* Drop zone */}
      {!isProcessing && (
        <div
          role="button"
          tabIndex={0}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
          className={cn(
            'flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition-colors select-none',
            dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30',
          )}
        >
          <Upload className="h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">Drop files here or click to browse</p>
          <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, XLSX — up to 500 MB each. Images not supported in batch.</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_TYPES}
            className="sr-only"
            onChange={(e) => addToStaged(e.target.files)}
          />
        </div>
      )}

      {/* Staged file list */}
      {stagedFiles.length > 0 && !isProcessing && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{stagedFiles.length} file{stagedFiles.length !== 1 ? 's' : ''} ready</p>
            <button onClick={() => setStagedFiles([])} className="text-xs text-muted-foreground hover:text-foreground">
              Clear all
            </button>
          </div>
          <ul className="divide-y rounded-lg border overflow-hidden">
            {stagedFiles.map((file) => {
              const type = SUPPORTED_MIME_TYPES[file.type];
              return (
                <li key={file.name} className="flex items-center gap-3 bg-card px-4 py-2.5">
                  {type && fileTypeIcon(type)}
                  <span className="flex-1 text-sm truncate">{file.name}</span>
                  <span className="text-xs text-muted-foreground">{formatBytes(file.size)}</span>
                  <button onClick={() => removeStaged(file.name)} className="ml-1 text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
          <Button onClick={handleProcess} className="w-full" disabled={stagedFiles.length === 0}>
            Process {stagedFiles.length} file{stagedFiles.length !== 1 ? 's' : ''}
          </Button>
        </div>
      )}

      {/* Processing / results */}
      {items.length > 0 && (
        <div className="space-y-4">
          {isProcessing && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Overall progress</span>
                <span>{totalProgress}%</span>
              </div>
              <Progress value={totalProgress} />
            </div>
          )}

          <ul className="divide-y rounded-lg border overflow-hidden">
            {items.map((item) => (
              <li key={item.id} className="bg-card px-4 py-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  {fileTypeIcon(item.fileType)}
                  <span className="flex-1 text-sm font-medium truncate">{item.name}</span>
                  <span className="text-xs text-muted-foreground">{formatBytes(item.sizeBytes)}</span>
                  {statusIcon(item)}
                </div>

                {item.status !== 'pending' && item.status !== 'done' && item.status !== 'error' && (
                  <div className="space-y-0.5">
                    <Progress value={item.progress} className="h-1.5" />
                    <p className="text-xs text-muted-foreground">{item.stage}</p>
                  </div>
                )}

                {item.status === 'done' && (
                  <p className="text-xs text-green-600">
                    Done · {item.piiCount ?? 0} PII item{item.piiCount !== 1 ? 's' : ''} redacted
                  </p>
                )}

                {item.status === 'error' && (
                  <p className="text-xs text-destructive">{item.error}</p>
                )}
              </li>
            ))}
          </ul>

          {allDone && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border bg-muted/30 p-4">
              <div>
                <p className="text-sm font-medium">
                  {doneCount} file{doneCount !== 1 ? 's' : ''} redacted
                  {errorCount > 0 && `, ${errorCount} error${errorCount !== 1 ? 's' : ''}`}
                </p>
                <p className="text-xs text-muted-foreground">Files are bundled into a single ZIP.</p>
              </div>
              <Button
                onClick={() => downloadAll(items)}
                disabled={doneCount === 0}
                className="gap-1.5 shrink-0"
              >
                <Download className="h-4 w-4" />
                {doneCount === 1 ? 'Download file' : `Download ZIP (${doneCount} files)`}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
    </PricingGate>
  );
}
