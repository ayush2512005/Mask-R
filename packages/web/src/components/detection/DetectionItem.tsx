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

const CONFIDENCE_VARIANT = (score: number): 'success' | 'warning' | 'destructive' =>
  score >= 90 ? 'success' : score >= 70 ? 'warning' : 'destructive';

export function DetectionItem({ item, onApprove, onReject }: DetectionItemProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 rounded-md border p-2 text-sm',
        item.approved ? 'border-green-200 bg-green-50' : 'border-border'
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Badge variant={CONFIDENCE_VARIANT(item.confidence)} className="shrink-0 text-[10px]">
          {item.confidence}%
        </Badge>
        <span className="text-xs text-muted-foreground shrink-0">{item.type}</span>
        <span className="truncate font-mono text-xs">{item.text}</span>
      </div>
      <div className="flex gap-1 shrink-0">
        <Button
          size="icon"
          variant={item.approved ? 'default' : 'outline'}
          className="h-6 w-6"
          onClick={() => onApprove(item.id)}
          aria-label={`Approve ${item.text}`}
        >
          <Check className="h-3 w-3" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 text-destructive hover:text-destructive"
          onClick={() => onReject(item.id)}
          aria-label={`Reject ${item.text}`}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
