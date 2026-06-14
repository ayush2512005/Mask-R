import { useEffect, useRef, useState } from 'react';
import { useFileStore } from '@/stores/file.store';
import { useDocxProcessor } from '@/hooks/useDocxProcessor';
import { PiiReviewPanel } from '../detection/PiiReviewPanel';
import { Progress } from '../ui/Progress';
import { Button } from '../ui/Button';
import { useRedactionStore } from '@/stores/redaction.store';
import { usePiiDetection } from '@/hooks/usePiiDetection';
import type { PiiType } from '@redact/shared';

interface DocxEditorProps {
  enabledTypes?: PiiType[];
}

export function DocxEditor({ enabledTypes }: DocxEditorProps) {
  const { fileBuffer } = useFileStore();
  const { extractText, redact, progress, stage, status, result, error } = useDocxProcessor();
  const { detect, status: piiStatus } = usePiiDetection();
  const { approvedItems, customTerms, maskingStyle, regions, setExtractedText } = useRedactionStore();
  const [extracted, setExtracted] = useState(false);
  const extractedTextRef = useRef('');

  useEffect(() => {
    if (fileBuffer && !extracted) {
      extractText(fileBuffer);
      setExtracted(true);
    }
  }, [fileBuffer, extracted, extractText]);

  useEffect(() => {
    if (result?.text) {
      extractedTextRef.current = result.text;
      setExtractedText(result.text);
      detect(result.text, customTerms, enabledTypes);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, detect, setExtractedText]);

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
        <div className="rounded-lg border border-destructive bg-destructive/5 p-4 text-destructive text-sm">
          {error.message}
        </div>
      )}

      {piiStatus === 'running' && (
        <p className="text-xs text-muted-foreground animate-pulse">Scanning for PII...</p>
      )}

      {result?.text && (
        <div className="rounded-md border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground font-medium mb-1">Document text preview</p>
          <pre className="text-xs whitespace-pre-wrap line-clamp-6">{result.text.slice(0, 500)}…</pre>
        </div>
      )}

      <PiiReviewPanel />

      <Button onClick={handleRedact} disabled={status === 'running' || (approvedItems.length === 0 && customTerms.length === 0)}>
        Apply Redactions ({approvedItems.length} items)
      </Button>
    </div>
  );
}
