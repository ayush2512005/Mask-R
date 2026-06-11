import { useState, useMemo } from 'react';
import { useRedactionStore } from '@/stores/redaction.store';
import { DetectionItem } from './DetectionItem';
import { ConfidenceFilter, type ConfidenceLevel } from './ConfidenceFilter';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Plus } from 'lucide-react';

export function PiiReviewPanel() {
  const { detectedItems, approveItem, rejectItem, approveAll, approveHighConfidence, addCustomTerm } =
    useRedactionStore();
  const [filter, setFilter] = useState<ConfidenceLevel>('all');
  const [customTerm, setCustomTerm] = useState('');

  const counts = useMemo(
    () => ({
      high: detectedItems.filter((i) => i.confidence >= 90).length,
      medium: detectedItems.filter((i) => i.confidence >= 70 && i.confidence < 90).length,
      low: detectedItems.filter((i) => i.confidence < 70).length,
    }),
    [detectedItems]
  );

  const filtered = useMemo(() => {
    if (filter === 'all') return detectedItems;
    if (filter === 'high') return detectedItems.filter((i) => i.confidence >= 90);
    if (filter === 'medium') return detectedItems.filter((i) => i.confidence >= 70 && i.confidence < 90);
    return detectedItems.filter((i) => i.confidence < 70);
  }, [detectedItems, filter]);

  function handleAddCustomTerm() {
    const term = customTerm.trim();
    if (term) {
      addCustomTerm(term);
      setCustomTerm('');
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Detected PII ({detectedItems.length})</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={approveHighConfidence}>
            Approve High
          </Button>
          <Button size="sm" variant="outline" onClick={approveAll}>
            Approve All
          </Button>
        </div>
      </div>

      <ConfidenceFilter value={filter} onChange={setFilter} counts={counts} />

      <div className="flex gap-2">
        <Input
          placeholder="Add custom term or regex..."
          value={customTerm}
          onChange={(e) => setCustomTerm(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddCustomTerm()}
          className="h-8 text-sm"
        />
        <Button size="sm" variant="outline" onClick={handleAddCustomTerm} aria-label="Add term">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
        {filtered.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-4">
            {detectedItems.length === 0 ? 'No PII detected yet' : 'No items in this confidence range'}
          </p>
        ) : (
          filtered.map((item) => (
            <DetectionItem key={item.id} item={item} onApprove={approveItem} onReject={rejectItem} />
          ))
        )}
      </div>
    </div>
  );
}
