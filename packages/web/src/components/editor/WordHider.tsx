import { useState, useMemo } from 'react';
import { EyeOff, X, Plus, Search } from 'lucide-react';
import { useRedactionStore } from '@/stores/redaction.store';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

function countOccurrences(text: string, term: string): number {
  if (!text || !term.trim()) return 0;
  try {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return (text.match(new RegExp(escaped, 'gi')) ?? []).length;
  } catch {
    return 0;
  }
}

export function WordHider() {
  const { customTerms, extractedText, addCustomTerm, removeCustomTerm } = useRedactionStore();
  const [input, setInput] = useState('');

  const previewCount = useMemo(
    () => countOccurrences(extractedText, input.trim()),
    [extractedText, input],
  );

  const termCounts = useMemo(
    () => customTerms.map((t) => ({ term: t, count: countOccurrences(extractedText, t) })),
    [customTerms, extractedText],
  );

  function handleAdd() {
    const term = input.trim();
    if (!term) return;
    addCustomTerm(term);
    setInput('');
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <EyeOff className="h-4 w-4 text-primary shrink-0" />
        <h3 className="text-sm font-semibold">Hide Specific Words</h3>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Every occurrence of these words will be hidden in the redacted file.
      </p>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            className="h-8 text-sm pl-8"
            placeholder="e.g. Confidential, Project X…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
        </div>
        <Button size="sm" variant="outline" onClick={handleAdd} disabled={!input.trim()} aria-label="Add word">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {input.trim() && extractedText && (
        <p className="text-xs">
          {previewCount > 0 ? (
            <span className="text-success font-medium">
              Found {previewCount} occurrence{previewCount !== 1 ? 's' : ''} — will be hidden
            </span>
          ) : (
            <span className="text-muted-foreground">Not found in this document</span>
          )}
        </p>
      )}

      {termCounts.length > 0 && (
        <ul className="space-y-1.5">
          {termCounts.map(({ term, count }) => (
            <li
              key={term}
              className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm"
            >
              <EyeOff className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="flex-1 truncate font-medium text-foreground text-xs">{term}</span>
              {extractedText && (
                <span className="text-[11px] text-muted-foreground tabular-nums shrink-0 bg-muted px-1.5 py-0.5 rounded">
                  {count}
                </span>
              )}
              <button
                onClick={() => removeCustomTerm(term)}
                className="text-muted-foreground hover:text-destructive transition-colors shrink-0 rounded p-0.5 hover:bg-destructive/10"
                aria-label={`Remove "${term}"`}
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {customTerms.length > 0 && (
        <p className="text-[11px] text-muted-foreground bg-primary/5 border border-primary/15 rounded-lg px-3 py-2">
          {customTerms.length} word{customTerms.length !== 1 ? 's' : ''} will be hidden when you click{' '}
          <strong className="text-foreground">Apply Redactions</strong>.
        </p>
      )}
    </div>
  );
}
