import { MaskingStyle } from '@redact/shared';
import { useMaskingStyle } from '@/hooks/useMaskingStyle';
import { cn } from '@/lib/utils';

const STYLE_LABELS: Record<MaskingStyle, string> = {
  [MaskingStyle.BLACK_BOX]: 'Black Box',
  [MaskingStyle.BLUR]: 'Blur',
  [MaskingStyle.PIXELATE]: 'Pixelate',
  [MaskingStyle.REDACTED_LABEL]: '[REDACTED]',
  [MaskingStyle.FAKE_DATA]: 'Fake Data',
};

const STYLE_PREVIEW: Record<MaskingStyle, string> = {
  [MaskingStyle.BLACK_BOX]: 'bg-black',
  [MaskingStyle.BLUR]: 'bg-gray-400 blur-sm',
  [MaskingStyle.PIXELATE]: 'bg-gray-400',
  [MaskingStyle.REDACTED_LABEL]: 'bg-black',
  [MaskingStyle.FAKE_DATA]: 'bg-blue-100',
};

export function MaskingStylePicker() {
  const { maskingStyle, selectStyle, allStyles } = useMaskingStyle();

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">Masking Style</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {allStyles.map((style) => (
          <button
            key={style}
            onClick={() => selectStyle(style)}
            className={cn(
              'flex flex-col items-center gap-2 rounded-lg border p-3 text-sm transition-colors hover:bg-muted',
              maskingStyle === style
                ? 'border-primary bg-primary/5 font-medium'
                : 'border-border'
            )}
            aria-pressed={maskingStyle === style}
          >
            <div className={cn('h-5 w-16 rounded text-center text-[10px] leading-5 font-bold text-white', STYLE_PREVIEW[style])}>
              {style === MaskingStyle.REDACTED_LABEL && '[REDACTED]'}
              {style === MaskingStyle.FAKE_DATA && <span className="text-blue-700">John Smith</span>}
            </div>
            <span>{STYLE_LABELS[style]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
