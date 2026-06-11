import { useEffect } from 'react';
import { useSessionStore } from '@/stores/session.store';
import { UserTier } from '@redact/shared';

export function TierSyncer() {
  const setTier = useSessionStore((s) => s.setTier);

  useEffect(() => {
    setTier(UserTier.FREE);
  }, [setTier]);

  return null;
}
