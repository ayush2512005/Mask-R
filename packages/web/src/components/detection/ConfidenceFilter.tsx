import { cn } from '@/lib/utils';

export type ConfidenceLevel = 'all' | 'high' | 'medium' | 'low';

interface ConfidenceFilterProps {
  value: ConfidenceLevel;
  onChange: (level: ConfidenceLevel) => void;
  counts: { high: number; medium: number; low: number };
}

const LEVELS: { key: ConfidenceLevel; label: string; color: string }[] = [
  { key: 'all', label: 'All', color: 'bg-secondary text-secondary-foreground' },
  { key: 'high', label: 'High (>90%)', color: 'bg-green-100 text-green-800' },
  { key: 'medium', label: 'Medium (70–90%)', color: 'bg-yellow-100 text-yellow-800' },
  { key: 'low', label: 'Low (<70%)', color: 'bg-red-100 text-red-800' },
];

export function ConfidenceFilter({ value, onChange, counts }: ConfidenceFilterProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {LEVELS.map(({ key, label, color }) => {
        const count = key === 'all' ? counts.high + counts.medium + counts.low : counts[key];
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all',
              color,
              value === key ? 'ring-2 ring-primary ring-offset-1' : 'opacity-70 hover:opacity-100'
            )}
          >
            {label}
            <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[10px] font-bold">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
