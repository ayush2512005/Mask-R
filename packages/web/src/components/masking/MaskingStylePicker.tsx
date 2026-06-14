import { MaskingStyle } from '@redact/shared';
import { useMaskingStyle } from '@/hooks/useMaskingStyle';
import { cn } from '@/lib/utils';

const STYLES: { style: MaskingStyle; label: string; sub: string; preview: string; previewClass: string }[] = [
  {
    style: MaskingStyle.BLACK_BOX,
    label: 'Black bar',
    sub: 'Classic redaction',
    preview: '████',
    previewClass: 'bg-[#1A1A1A] text-transparent rounded-sm',
  },
  {
    style: MaskingStyle.BLUR,
    label: 'Blur',
    sub: 'Gaussian mosaic',
    preview: 'TEXT',
    previewClass: 'bg-muted-foreground/40 text-transparent blur-sm rounded-sm',
  },
  {
    style: MaskingStyle.PIXELATE,
    label: 'Pixelate',
    sub: 'Block mosaic',
    preview: '████',
    previewClass: 'bg-muted-foreground/50 text-transparent rounded-none',
  },
  {
    style: MaskingStyle.REDACTED_LABEL,
    label: '[REDACTED]',
    sub: 'Text label',
    preview: '[REDACTED]',
    previewClass: 'bg-[#1A1A1A] text-white text-[8px] font-bold tracking-wider rounded-sm',
  },
  {
    style: MaskingStyle.FAKE_DATA,
    label: 'Fake data',
    sub: 'Synthetic replace',
    preview: 'Jane Doe',
    previewClass: 'bg-primary/10 text-primary/80 text-[10px] rounded-sm',
  },
];

export function MaskingStylePicker() {
  const { maskingStyle, selectStyle } = useMaskingStyle();

  return (
    <div className="space-y-2.5">
      <p className="text-sm font-semibold text-foreground">Masking Style</p>
      <div className="grid grid-cols-1 gap-2">
        {STYLES.map(({ style, label, sub, preview, previewClass }) => {
          const active = maskingStyle === style;
          return (
            <button
              key={style}
              onClick={() => selectStyle(style)}
              aria-pressed={active}
              className={cn(
                'flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all duration-100',
                active
                  ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/30'
                  : 'border-border hover:bg-muted/50'
              )}
            >
              <div className={cn('flex h-6 min-w-[52px] items-center justify-center px-1.5 text-[10px] font-mono', previewClass)}>
                {preview}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('text-xs font-semibold', active ? 'text-primary' : 'text-foreground')}>{label}</p>
                <p className="text-[11px] text-muted-foreground">{sub}</p>
              </div>
              <div className={cn(
                'h-3.5 w-3.5 rounded-full border-2 flex-shrink-0 transition-colors',
                active ? 'border-primary bg-primary' : 'border-muted-foreground/30'
              )} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
