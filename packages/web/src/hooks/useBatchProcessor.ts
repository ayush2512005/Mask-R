import { useCallback, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { PiiItem, PiiType } from '@redact/shared';
import { MaskingStyle, SupportedFileType, SUPPORTED_MIME_TYPES } from '@redact/shared';
import type { WorkerMessage, WorkerResponse } from './useWorker';
import type { PdfProcessConfig, PdfProcessResult } from '../workers/pdf-processor.worker';
import type { DocxProcessConfig, DocxProcessResult } from '../workers/docx-processor.worker';
import type { XlsxProcessConfig, XlsxProcessResult } from '../workers/xlsx-processor.worker';
import type { PiiDetectionConfig, PiiDetectionResult } from '../workers/pii-detection.worker';
import PdfWorker from '../workers/pdf-processor.worker.ts?worker';
import DocxWorker from '../workers/docx-processor.worker.ts?worker';
import XlsxWorker from '../workers/xlsx-processor.worker.ts?worker';
import PiiWorker from '../workers/pii-detection.worker.ts?worker';

export type BatchItemStatus = 'pending' | 'extracting' | 'detecting' | 'redacting' | 'done' | 'error';

export interface BatchItem {
  id: string;
  name: string;
  fileType: SupportedFileType;
  sizeBytes: number;
  status: BatchItemStatus;
  progress: number;
  stage: string;
  error?: string;
  outputBuffer?: ArrayBuffer;
  piiCount?: number;
}

interface BatchConfig {
  maskingStyle: MaskingStyle;
  enabledTypes?: PiiType[];
  customTerms?: string[];
}

const CONCURRENCY = 2;

function runWorker<TConfig, TResult>(
  create: () => Worker,
  payload: TConfig,
  onProgress?: (pct: number, stage: string) => void,
): Promise<TResult> {
  return new Promise((resolve, reject) => {
    const worker = create();
    const msg: WorkerMessage<TConfig> = { type: 'PROCESS', payload };
    worker.onmessage = ({ data }: MessageEvent<WorkerResponse<TResult>>) => {
      if (data.type === 'PROGRESS') {
        onProgress?.(data.payload.pct, data.payload.stage);
      } else if (data.type === 'COMPLETE') {
        worker.terminate();
        resolve(data.payload);
      } else if (data.type === 'ERROR') {
        worker.terminate();
        reject(new Error(data.payload.message));
      }
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message ?? 'Worker error'));
    };
    worker.postMessage(msg);
  });
}

function getFileType(file: File): SupportedFileType | null {
  return SUPPORTED_MIME_TYPES[file.type] ?? null;
}

function isImageType(type: SupportedFileType): boolean {
  return [
    SupportedFileType.JPEG,
    SupportedFileType.PNG,
    SupportedFileType.WEBP,
    SupportedFileType.TIFF,
    SupportedFileType.BMP,
  ].includes(type);
}

async function processSingleFile(
  file: File,
  fileType: SupportedFileType,
  config: BatchConfig,
  onUpdate: (progress: number, stage: string) => void,
): Promise<{ outputBuffer: ArrayBuffer; piiCount: number }> {
  const buffer = await file.arrayBuffer();

  if (isImageType(fileType)) {
    throw new Error('Image redaction is not supported in batch mode — open images individually.');
  }

  // Step 1: Extract text
  onUpdate(5, 'Extracting text…');
  let extractedText = '';

  if (fileType === SupportedFileType.PDF) {
    const result = await runWorker<PdfProcessConfig, PdfProcessResult>(
      () => new PdfWorker(),
      { buffer, config: { maskingStyle: config.maskingStyle, regions: [], piiItems: [], customTerms: [] }, action: 'extract-text' },
      (pct, stage) => onUpdate(5 + pct * 0.25, stage),
    );
    extractedText = result.text ?? '';
  } else if (fileType === SupportedFileType.DOCX) {
    const result = await runWorker<DocxProcessConfig, DocxProcessResult>(
      () => new DocxWorker(),
      { buffer, config: { maskingStyle: config.maskingStyle, regions: [], piiItems: [], customTerms: [] }, action: 'extract-text' },
      (pct, stage) => onUpdate(5 + pct * 0.25, stage),
    );
    extractedText = result.text ?? '';
  } else if (fileType === SupportedFileType.XLSX) {
    const result = await runWorker<XlsxProcessConfig, XlsxProcessResult>(
      () => new XlsxWorker(),
      { buffer, config: { maskingStyle: config.maskingStyle, regions: [], piiItems: [], customTerms: [] }, action: 'extract-text' },
      (pct, stage) => onUpdate(5 + pct * 0.25, stage),
    );
    extractedText = result.text ?? '';
  }

  // Step 2: Detect PII
  onUpdate(30, 'Detecting PII…');
  const detectedItems = await runWorker<PiiDetectionConfig, PiiDetectionResult>(
    () => new PiiWorker(),
    {
      text: extractedText,
      customTerms: config.customTerms ?? [],
      enabledTypes: config.enabledTypes,
    },
    (pct, stage) => onUpdate(30 + pct * 0.2, stage),
  );

  // Auto-approve all detected items for batch mode
  const approvedItems: PiiItem[] = detectedItems.map((item) => ({ ...item, approved: true }));
  const piiCount = approvedItems.length;

  // Step 3: Redact
  onUpdate(55, 'Applying redactions…');
  const redactionConfig = {
    maskingStyle: config.maskingStyle,
    regions: [],
    piiItems: approvedItems,
    customTerms: config.customTerms ?? [],
  };

  let outputBuffer: ArrayBuffer;

  if (fileType === SupportedFileType.PDF) {
    const result = await runWorker<PdfProcessConfig, PdfProcessResult>(
      () => new PdfWorker(),
      { buffer, config: redactionConfig, action: 'redact' },
      (pct, stage) => onUpdate(55 + pct * 0.4, stage),
    );
    if (!result.redactedBuffer) throw new Error('PDF redaction produced no output');
    outputBuffer = result.redactedBuffer;
  } else if (fileType === SupportedFileType.DOCX) {
    const result = await runWorker<DocxProcessConfig, DocxProcessResult>(
      () => new DocxWorker(),
      { buffer, config: redactionConfig, action: 'redact' },
      (pct, stage) => onUpdate(55 + pct * 0.4, stage),
    );
    if (!result.redactedBuffer) throw new Error('DOCX redaction produced no output');
    outputBuffer = result.redactedBuffer;
  } else if (fileType === SupportedFileType.XLSX) {
    const result = await runWorker<XlsxProcessConfig, XlsxProcessResult>(
      () => new XlsxWorker(),
      { buffer, config: redactionConfig, action: 'redact' },
      (pct, stage) => onUpdate(55 + pct * 0.4, stage),
    );
    if (!result.redactedBuffer) throw new Error('XLSX redaction produced no output');
    outputBuffer = result.redactedBuffer;
  } else {
    throw new Error(`Unsupported file type: ${fileType}`);
  }

  onUpdate(100, 'Done');
  return { outputBuffer, piiCount };
}

export function useBatchProcessor() {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const abortRef = useRef(false);

  const addFiles = useCallback((files: File[]) => {
    const newItems: BatchItem[] = [];
    for (const file of files) {
      const fileType = getFileType(file);
      if (!fileType) continue;
      newItems.push({
        id: uuidv4(),
        name: file.name,
        fileType,
        sizeBytes: file.size,
        status: 'pending',
        progress: 0,
        stage: '',
      });
    }
    setItems((prev) => {
      const existingNames = new Set(prev.map((i) => i.name));
      return [...prev, ...newItems.filter((i) => !existingNames.has(i.name))];
    });
    return newItems;
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setItems([]);
  }, []);

  const process = useCallback(
    async (files: File[], config: BatchConfig) => {
      abortRef.current = false;
      setIsProcessing(true);

      // Build a stable list of {item, file} pairs
      const itemFileMap = new Map<string, File>();
      const newItems: BatchItem[] = [];
      for (const file of files) {
        const fileType = getFileType(file);
        if (!fileType) continue;
        const id = uuidv4();
        itemFileMap.set(id, file);
        newItems.push({
          id,
          name: file.name,
          fileType,
          sizeBytes: file.size,
          status: 'pending',
          progress: 0,
          stage: '',
        });
      }
      setItems(newItems);

      const queue = [...newItems];
      let activeCount = 0;
      let queueIndex = 0;

      await new Promise<void>((resolve) => {
        function startNext() {
          while (activeCount < CONCURRENCY && queueIndex < queue.length) {
            const item = queue[queueIndex++]!;
            activeCount++;
            const file = itemFileMap.get(item.id)!;

            setItems((prev) =>
              prev.map((i) =>
                i.id === item.id ? { ...i, status: 'extracting', progress: 5, stage: 'Starting…' } : i
              )
            );

            processSingleFile(file, item.fileType, config, (progress, stage) => {
              setItems((prev) =>
                prev.map((i) => (i.id === item.id ? { ...i, progress, stage } : i))
              );
            })
              .then(({ outputBuffer, piiCount }) => {
                setItems((prev) =>
                  prev.map((i) =>
                    i.id === item.id
                      ? { ...i, status: 'done', progress: 100, stage: 'Done', outputBuffer, piiCount }
                      : i
                  )
                );
              })
              .catch((err: unknown) => {
                setItems((prev) =>
                  prev.map((i) =>
                    i.id === item.id
                      ? {
                          ...i,
                          status: 'error',
                          progress: 0,
                          stage: 'Error',
                          error: err instanceof Error ? err.message : 'Processing failed',
                        }
                      : i
                  )
                );
              })
              .finally(() => {
                activeCount--;
                if (queueIndex < queue.length) {
                  startNext();
                } else if (activeCount === 0) {
                  resolve();
                }
              });
          }
        }
        startNext();
        if (queue.length === 0) resolve();
      });

      setIsProcessing(false);
    },
    []
  );

  const downloadAll = useCallback(async (batchItems: BatchItem[]) => {
    if (batchItems.length === 0) return;

    const summary = {
      generatedAt: new Date().toISOString(),
      totalFiles: batchItems.length,
      succeeded: batchItems.filter((i) => i.status === 'done').length,
      failed: batchItems.filter((i) => i.status === 'error').length,
      files: batchItems.map((i) => ({
        name: i.name,
        status: i.status,
        piiItemsRedacted: i.piiCount ?? 0,
        ...(i.status === 'error' ? { errorCode: 'PROCESSING_FAILED', errorMessage: i.error } : {}),
      })),
    };
    const summaryJson = JSON.stringify(summary, null, 2);

    const done = batchItems.filter((i) => i.status === 'done' && i.outputBuffer);

    if (done.length === 1 && batchItems.length === 1) {
      // Single file with no errors — download it directly without a ZIP
      const item = done[0]!;
      const blob = new Blob([item.outputBuffer!]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `redacted_${item.name}`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    // Bundle everything into a ZIP including the summary
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    zip.file('batch-summary.json', summaryJson);
    for (const item of done) {
      zip.file(`redacted_${item.name}`, item.outputBuffer!);
    }
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'redacted_files.zip';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const doneCount = items.filter((i) => i.status === 'done').length;
  const errorCount = items.filter((i) => i.status === 'error').length;
  const totalProgress =
    items.length > 0
      ? Math.round(items.reduce((sum, i) => sum + i.progress, 0) / items.length)
      : 0;

  return {
    items,
    isProcessing,
    doneCount,
    errorCount,
    totalProgress,
    addFiles,
    removeItem,
    clearAll,
    process,
    downloadAll,
  };
}
