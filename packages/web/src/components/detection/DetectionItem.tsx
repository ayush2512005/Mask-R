import type { PiiItem } from '@redact/shared';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DetectionItemProps {
  item: PiiItem;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

const CONFIDENCE_VARIANT = (score: number): 'success' | 'warning' | 'muted' =>
  score >= 90 ? 'success' : score >= 70 ? 'warning' : 'muted';

export function DetectionItem({ item, onApprove, onReject }: DetectionItemProps) {
  const isRejected = item.approved === false;

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border p-2.5 text-sm transition-colors',
        item.approved
          ? 'border-success/30 bg-success/5'
          : isRejected
          ? 'border-border opacity-40'
          : 'border-border hover:bg-muted/40'
      )}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Badge variant={CONFIDENCE_VARIANT(item.confidence)} className="shrink-0">
          {item.confidence}%
        </Badge>
        <span className="text-[11px] text-muted-foreground shrink-0 uppercase tracking-wide font-medium">
          {item.type}
        </span>
        <span
          className={cn(
            'truncate font-mono text-xs text-foreground',
            isRejected && 'line-through text-muted-foreground'
          )}
        >
          {item.text}
        </span>
      </div>
      <div className="flex gap-1 shrink-0">
        <Button
          size="icon"
          variant={item.approved ? 'success' : 'outline'}
          className="h-6 w-6"
          onClick={() => onApprove(item.id)}
          aria-label={`Approve ${item.text}`}
        >
          <Check className="h-3 w-3" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={() => onReject(item.id)}
          aria-label={`Reject ${item.text}`}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
