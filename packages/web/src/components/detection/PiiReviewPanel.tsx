import { useState, useMemo } from 'react';
import { useRedactionStore } from '@/stores/redaction.store';
import { DetectionItem } from './DetectionItem';
import { ConfidenceFilter, type ConfidenceLevel } from './ConfidenceFilter';
import { Button } from '../ui/Button';

export function PiiReviewPanel() {
  const { detectedItems, approveItem, rejectItem, approveAll, approveHighConfidence } =
    useRedactionStore();
  const [filter, setFilter] = useState<ConfidenceLevel>('all');

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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Detected PII</p>
          {detectedItems.length > 0 && (
            <p className="text-xs text-muted-foreground">{detectedItems.length} items found</p>
          )}
        </div>
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" onClick={approveHighConfidence} className="text-xs">
            Approve High
          </Button>
          <Button size="sm" variant="outline" onClick={approveAll} className="text-xs">
            Approve All
          </Button>
        </div>
      </div>

      <ConfidenceFilter value={filter} onChange={setFilter} counts={counts} />

      <div className="max-h-64 overflow-y-auto space-y-1 pr-0.5">
        {filtered.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">
            {detectedItems.length === 0 ? 'No PII detected yet' : 'No items in this range'}
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
