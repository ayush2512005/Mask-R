import { useEffect, useRef, useState } from 'react';
import { useFileStore } from '@/stores/file.store';
import { useXlsxProcessor } from '@/hooks/useXlsxProcessor';
import { usePiiDetection } from '@/hooks/usePiiDetection';
import { PiiReviewPanel } from '../detection/PiiReviewPanel';
import { Progress } from '../ui/Progress';
import { Button } from '../ui/Button';
import { useRedactionStore } from '@/stores/redaction.store';
import type { PiiType } from '@redact/shared';

interface XlsxEditorProps {
  enabledTypes?: PiiType[];
}

export function XlsxEditor({ enabledTypes }: XlsxEditorProps) {
  const { fileBuffer } = useFileStore();
  const { extractText, redact, progress, stage, status, result, error } = useXlsxProcessor();
  const { detect, status: piiStatus } = usePiiDetection();
  const { approvedItems, customTerms, maskingStyle, regions } = useRedactionStore();
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
      detect(result.text, customTerms, enabledTypes);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, detect]);

  useEffect(() => {
    if (extractedTextRef.current) {
      detect(extractedTextRef.current, customTerms, enabledTypes);
    }
  }, [customTerms, enabledTypes, detect]);

  function handleRedact() {
    if (!fileBuffer) return;
    redact(fileBuffer, { maskingStyle, regions, piiItems: approvedItems, customTerms });
  }

  const allRows = result?.text ? result.text.split('\n').filter(Boolean) : [];
  const previewRows = allRows.slice(0, 8);
  const extraRows = allRows.length - previewRows.length;

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

      {previewRows.length > 0 && (
        <div className="rounded-md border bg-muted/30 p-3 overflow-x-auto">
          <p className="text-xs text-muted-foreground font-medium mb-2">
            Spreadsheet preview (first {previewRows.length} rows)
          </p>
          <table className="text-xs min-w-full border-collapse">
            <tbody>
              {previewRows.map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? '' : 'bg-muted/20'}>
                  {row.split(',').map((cell, j) => (
                    <td
                      key={j}
                      className="border border-border/40 px-2 py-0.5 max-w-[140px] truncate"
                      title={cell}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {extraRows > 0 && (
            <p className="text-xs text-muted-foreground mt-1.5">
              …and {extraRows} more row{extraRows !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}

      <PiiReviewPanel />

      <Button
        onClick={handleRedact}
        disabled={status === 'running' || approvedItems.length === 0}
      >
        Apply Redactions ({approvedItems.length} items)
      </Button>
    </div>
  );
}
