import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { RedactionProfile } from '@redact/shared';
import {
  fetchLocalProfiles,
  saveLocalProfileEntry,
  deleteLocalProfile,
} from '../services/profile/profile.service';
import { useProfileStore } from '../stores/profile.store';
import { useEffect } from 'react';

export function useProfile() {
  const qc = useQueryClient();
  const loadProfiles = useProfileStore((s) => s.loadProfiles);

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['profiles-local'],
    queryFn: fetchLocalProfiles,
  });

  useEffect(() => {
    if (profiles.length) loadProfiles(profiles);
  }, [profiles, loadProfiles]);

  const save = useMutation({
    mutationFn: (profile: Omit<RedactionProfile, 'id' | 'createdAt' | 'updatedAt'>) =>
      saveLocalProfileEntry(profile),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles-local'] }),
  });

  const remove = useMutation({
    mutationFn: (profileId: string) => deleteLocalProfile(profileId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles-local'] }),
  });

  return { profiles, isLoading, save, remove };
}
