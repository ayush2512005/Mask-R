import { create } from 'zustand';
import { UserTier } from '@redact/shared';

const SESSION_STORAGE_KEY = 'redact_files_this_session';

function loadSessionCount(): number {
  try {
    return parseInt(sessionStorage.getItem(SESSION_STORAGE_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveSessionCount(count: number): void {
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, String(count));
  } catch {
    // sessionStorage unavailable
  }
}

interface SessionState {
  filesThisSession: number;
  tier: UserTier;
  canProcessFile: () => boolean;
  incrementFileCount: () => void;
  setTier: (tier: UserTier) => void;
  resetSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  filesThisSession: loadSessionCount(),
  tier: UserTier.FREE,

  canProcessFile: () => {
    return true; // Limit disabled as requested
  },

  incrementFileCount: () =>
    set((state) => {
      const next = state.filesThisSession + 1;
      saveSessionCount(next);
      return { filesThisSession: next };
    }),

  setTier: (tier) => set({ tier }),

  resetSession: () => {
    saveSessionCount(0);
    set({ filesThisSession: 0 });
  },
}));
