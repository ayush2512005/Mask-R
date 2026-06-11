import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useProfileStore } from '../stores/profile.store';
import type { RedactionProfile } from '@redact/shared';
import {
  fetchLocalProfiles,
  saveLocalProfileEntry,
  deleteLocalProfile,
} from '../services/profile/profile.service';

const PROFILES_KEY = ['profiles'] as const;

export function useProfiles() {
  const { loadProfiles } = useProfileStore();

  return useQuery({
    queryKey: PROFILES_KEY,
    queryFn: async () => {
      const profiles = await fetchLocalProfiles();
      loadProfiles(profiles);
      return profiles;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useSaveProfile() {
  const qc = useQueryClient();
  const { addProfile } = useProfileStore();

  return useMutation({
    mutationFn: (profile: Omit<RedactionProfile, 'id' | 'createdAt' | 'updatedAt'>) =>
      saveLocalProfileEntry(profile),
    onSuccess: (saved) => {
      addProfile(saved);
      qc.invalidateQueries({ queryKey: PROFILES_KEY });
    },
  });
}

export function useDeleteProfile() {
  const qc = useQueryClient();
  const { removeProfile } = useProfileStore();

  return useMutation({
    mutationFn: (profileId: string) => deleteLocalProfile(profileId),
    onSuccess: (_, profileId) => {
      removeProfile(profileId);
      qc.invalidateQueries({ queryKey: PROFILES_KEY });
    },
  });
}
