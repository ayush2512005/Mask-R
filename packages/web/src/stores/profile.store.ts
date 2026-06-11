import { create } from 'zustand';
import type { RedactionProfile } from '@redact/shared';
import { SYSTEM_PROFILES } from '../lib/constants';

interface ProfileState {
  activeProfile: RedactionProfile | null;
  savedProfiles: RedactionProfile[];
  setActiveProfile: (profile: RedactionProfile | null) => void;
  addProfile: (profile: RedactionProfile) => void;
  updateProfile: (profile: RedactionProfile) => void;
  removeProfile: (profileId: string) => void;
  loadProfiles: (profiles: RedactionProfile[]) => void;
}

export const useProfileStore = create<ProfileState>((set) => ({
  activeProfile: null,
  savedProfiles: SYSTEM_PROFILES,

  setActiveProfile: (activeProfile) => set({ activeProfile }),

  addProfile: (profile) =>
    set((state) => ({ savedProfiles: [...state.savedProfiles, profile] })),

  updateProfile: (profile) =>
    set((state) => ({
      savedProfiles: state.savedProfiles.map((p) => (p.id === profile.id ? profile : p)),
      activeProfile: state.activeProfile?.id === profile.id ? profile : state.activeProfile,
    })),

  removeProfile: (profileId) =>
    set((state) => ({
      savedProfiles: state.savedProfiles.filter((p) => p.id !== profileId),
      activeProfile: state.activeProfile?.id === profileId ? null : state.activeProfile,
    })),

  loadProfiles: (profiles) =>
    set((state) => ({
      savedProfiles: [...SYSTEM_PROFILES, ...profiles.filter((p) => !p.isSystem)],
      activeProfile: state.activeProfile,
    })),
}));
