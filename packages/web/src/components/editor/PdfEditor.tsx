import { useEffect, useRef, useState } from 'react';
import { useFileStore } from '@/stores/file.store';
import { usePdfProcessor } from '@/hooks/usePdfProcessor';
import { usePiiDetection } from '@/hooks/usePiiDetection';
import { PiiReviewPanel } from '../detection/PiiReviewPanel';
import { Progress } from '../ui/Progress';
import { Button } from '../ui/Button';
import { useRedactionStore } from '@/stores/redaction.store';
import type { PiiType } from '@redact/shared';

interface PdfEditorProps {
  onPiiDetected?: () => void;
  enabledTypes?: PiiType[];
}

export function PdfEditor({ onPiiDetected, enabledTypes }: PdfEditorProps) {
  const { fileBuffer } = useFileStore();
  const { extractText, redact, progress, stage, status, result, error } = usePdfProcessor();
  const { detect, status: piiStatus } = usePiiDetection();
  const { approvedItems, customTerms, maskingStyle, regions, setExtractedText } = useRedactionStore();
  const [textExtracted, setTextExtracted] = useState(false);
  const extractedTextRef = useRef('');

  useEffect(() => {
    if (fileBuffer && !textExtracted) {
      extractText(fileBuffer);
      setTextExtracted(true);
    }
  }, [fileBuffer, textExtracted, extractText]);

  // Run PII detection when text extraction completes
  useEffect(() => {
    if (result?.text) {
      extractedTextRef.current = result.text;
      setExtractedText(result.text);
      detect(result.text, customTerms, enabledTypes);
      onPiiDetected?.();
    }
    // intentionally omit customTerms/enabledTypes — handled by the effects below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, detect, onPiiDetected, setExtractedText]);

  useEffect(() => {
    if (extractedTextRef.current) {
      detect(extractedTextRef.current, customTerms, enabledTypes);
    }
  }, [customTerms, enabledTypes, detect]);

  function handleRedact() {
    if (!fileBuffer) return;
    redact(fileBuffer, { maskingStyle, regions, piiItems: approvedItems, customTerms });
  }

  return (
    <div className="space-y-4">
      {status === 'running' && (
        <div className="space-y-1.5">
          <Progress value={progress} />
          <p className="text-xs text-muted-foreground">{stage}</p>
        </div>
      )}

      {status === 'error' && error && (
        <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-destructive text-sm">
          Error: {error.message}
        </div>
      )}

      {piiStatus === 'running' && (
        <p className="text-xs text-muted-foreground animate-pulse">Scanning for PII...</p>
      )}

      {result?.text && (
        <div className="rounded-md border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground font-medium mb-1">Extracted text ({result.pageCount ?? '?'} pages)</p>
          <pre className="text-xs whitespace-pre-wrap line-clamp-6 text-foreground">{result.text.slice(0, 500)}…</pre>
        </div>
      )}

      <PiiReviewPanel />

      <Button onClick={handleRedact} disabled={status === 'running' || (approvedItems.length === 0 && customTerms.length === 0)}>
        Apply Redactions ({approvedItems.length} items)
      </Button>
    </div>
  );
}
