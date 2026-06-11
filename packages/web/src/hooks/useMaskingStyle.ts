import { useCallback } from 'react';
import { MaskingStyle } from '@redact/shared';
import { useRedactionStore } from '../stores/redaction.store';

export function useMaskingStyle() {
  const maskingStyle = useRedactionStore((s) => s.maskingStyle);
  const setMaskingStyle = useRedactionStore((s) => s.setMaskingStyle);

  const selectStyle = useCallback(
    (style: MaskingStyle) => setMaskingStyle(style),
    [setMaskingStyle]
  );

  return { maskingStyle, selectStyle, allStyles: Object.values(MaskingStyle) };
}
