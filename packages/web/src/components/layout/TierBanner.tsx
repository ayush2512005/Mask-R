import { useSessionStore } from '@/stores/session.store';
import { UserTier } from '@redact/shared';

export function TierBanner() {
  const { tier } = useSessionStore();

  if (tier !== UserTier.FREE) return null;

  return null;
}
