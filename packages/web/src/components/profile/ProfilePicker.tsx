import { Shield } from 'lucide-react';
import { useProfileStore } from '@/stores/profile.store';
import { useRedactionStore } from '@/stores/redaction.store';
import { useProfiles } from '@/hooks/useProfiles';
import type { RedactionProfile } from '@redact/shared';

interface ProfilePickerProps {
  onProfileChange?: (profile: RedactionProfile | null) => void;
}

export function ProfilePicker({ onProfileChange }: ProfilePickerProps) {
  useProfiles(); // loads saved profiles into store on mount

  const { activeProfile, savedProfiles, setActiveProfile } = useProfileStore();
  const { setMaskingStyle } = useRedactionStore();

  const systemProfiles = savedProfiles.filter((p) => p.isSystem);
  const userProfiles = savedProfiles.filter((p) => !p.isSystem);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    if (!id) {
      setActiveProfile(null);
      onProfileChange?.(null);
      return;
    }
    const profile = savedProfiles.find((p) => p.id === id) ?? null;
    if (profile) {
      setActiveProfile(profile);
      setMaskingStyle(profile.maskingStyle);
      onProfileChange?.(profile);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Shield className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium">Redaction Profile</span>
      </div>

      <select
        value={activeProfile?.id ?? ''}
        onChange={handleChange}
        className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <option value="">— No Profile —</option>
        {systemProfiles.length > 0 && (
          <optgroup label="Built-in">
            {systemProfiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </optgroup>
        )}
        {userProfiles.length > 0 && (
          <optgroup label="Saved">
            {userProfiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>

      {activeProfile && (
        <p className="text-[11px] text-muted-foreground leading-snug">
          Detects: {activeProfile.piiTypes.join(', ')}
        </p>
      )}
    </div>
  );
}
