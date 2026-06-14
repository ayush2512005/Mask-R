import { cn } from '@/lib/utils';

export type ConfidenceLevel = 'all' | 'high' | 'medium' | 'low';

interface ConfidenceFilterProps {
  value: ConfidenceLevel;
  onChange: (level: ConfidenceLevel) => void;
  counts: { high: number; medium: number; low: number };
}

const LEVELS: { key: ConfidenceLevel; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'high', label: 'High' },
  { key: 'medium', label: 'Med' },
  { key: 'low', label: 'Low' },
];

export function ConfidenceFilter({ value, onChange, counts }: ConfidenceFilterProps) {
  return (
    <div className="flex gap-1">
      {LEVELS.map(({ key, label }) => {
        const count = key === 'all' ? counts.high + counts.medium + counts.low : counts[key];
        const active = value === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              active
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {label}
            <span
              className={cn(
                'rounded px-1 py-px text-[10px] font-semibold tabular-nums',
                active ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
