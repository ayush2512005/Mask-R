import type { RedactionProfile } from '@redact/shared';
import { supabase } from '../../lib/supabase';
import { getLocalProfiles, saveLocalProfile, deleteLocalProfile } from '../storage/indexed-db.service';
import { RedactionError } from '../../lib/errors';
import { v4 as uuidv4 } from 'uuid';

export async function fetchUserProfiles(userId: string): Promise<RedactionProfile[]> {
  const { data, error } = await supabase
    .from('redaction_profiles')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new RedactionError('PROCESSING_FAILED', error.message);
  return (data ?? []).map(dbRowToProfile);
}

export async function saveUserProfile(
  userId: string,
  profile: Omit<RedactionProfile, 'id' | 'createdAt' | 'updatedAt'>
): Promise<RedactionProfile> {
  const now = new Date().toISOString();
  const newProfile: RedactionProfile = {
    ...profile,
    id: uuidv4(),
    createdAt: now,
    updatedAt: now,
  };

  const { error } = await supabase.from('redaction_profiles').insert({
    id: newProfile.id,
    user_id: userId,
    name: newProfile.name,
    pii_types: newProfile.piiTypes,
    custom_terms: newProfile.customTerms,
    masking_style: newProfile.maskingStyle,
    is_system: false,
    created_at: now,
    updated_at: now,
  });

  if (error) throw new RedactionError('PROCESSING_FAILED', error.message);
  return newProfile;
}

export async function updateUserProfile(
  profile: RedactionProfile
): Promise<RedactionProfile> {
  const now = new Date().toISOString();
  const updated = { ...profile, updatedAt: now };

  const { error } = await supabase
    .from('redaction_profiles')
    .update({ name: profile.name, pii_types: profile.piiTypes, custom_terms: profile.customTerms, masking_style: profile.maskingStyle, updated_at: now })
    .eq('id', profile.id);

  if (error) throw new RedactionError('PROCESSING_FAILED', error.message);
  return updated;
}

export async function deleteUserProfile(profileId: string): Promise<void> {
  const { error } = await supabase.from('redaction_profiles').delete().eq('id', profileId);
  if (error) throw new RedactionError('PROCESSING_FAILED', error.message);
}

export async function fetchLocalProfiles(): Promise<RedactionProfile[]> {
  return getLocalProfiles();
}

export async function saveLocalProfileEntry(
  profile: Omit<RedactionProfile, 'id' | 'createdAt' | 'updatedAt'>
): Promise<RedactionProfile> {
  const now = new Date().toISOString();
  const newProfile: RedactionProfile = { ...profile, id: uuidv4(), createdAt: now, updatedAt: now };
  await saveLocalProfile(newProfile);
  return newProfile;
}

export { deleteLocalProfile };

function dbRowToProfile(row: Record<string, unknown>): RedactionProfile {
  return {
    id: String(row['id']),
    name: String(row['name']),
    piiTypes: (row['pii_types'] as RedactionProfile['piiTypes']) ?? [],
    customTerms: (row['custom_terms'] as string[]) ?? [],
    maskingStyle: row['masking_style'] as RedactionProfile['maskingStyle'],
    isSystem: Boolean(row['is_system']),
    createdAt: String(row['created_at']),
    updatedAt: String(row['updated_at']),
  };
}
