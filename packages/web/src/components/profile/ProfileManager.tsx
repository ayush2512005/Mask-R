import { useState } from 'react';
import { Plus, Trash2, Settings } from 'lucide-react';
import { MaskingStyle, PiiType } from '@redact/shared';
import { useProfileStore } from '@/stores/profile.store';
import { useSaveProfile, useDeleteProfile } from '@/hooks/useProfiles';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

const PII_LABELS: Record<PiiType, string> = {
  [PiiType.NAME]: 'Names',
  [PiiType.EMAIL]: 'Emails',
  [PiiType.PHONE]: 'Phone Numbers',
  [PiiType.ADDRESS]: 'Addresses',
  [PiiType.CARD_NUMBER]: 'Card Numbers',
  [PiiType.DATE_OF_BIRTH]: 'Dates of Birth',
  [PiiType.SSN]: 'SSNs',
  [PiiType.PASSPORT]: 'Passports',
  [PiiType.IP_ADDRESS]: 'IP Addresses',
  [PiiType.AADHAAR]: 'Aadhaar Numbers',
  [PiiType.PAN]: 'PAN Cards',
  [PiiType.VEHICLE_NUMBER]: 'Vehicle Numbers',
  [PiiType.IFSC]: 'IFSC Codes',
  [PiiType.UPI_ID]: 'UPI IDs',
  [PiiType.GST]: 'GST Numbers',
  [PiiType.CUSTOM]: 'Custom Terms',
};

const STYLE_LABELS: Record<MaskingStyle, string> = {
  [MaskingStyle.BLACK_BOX]: 'Black Box',
  [MaskingStyle.BLUR]: 'Blur',
  [MaskingStyle.PIXELATE]: 'Pixelate',
  [MaskingStyle.REDACTED_LABEL]: '[REDACTED]',
  [MaskingStyle.FAKE_DATA]: 'Fake Data',
};

const ALL_PII = Object.values(PiiType).filter((t) => t !== PiiType.CUSTOM);

export function ProfileManager() {
  const { savedProfiles } = useProfileStore();
  const { mutate: saveProfile, isPending: saving } = useSaveProfile();
  const { mutate: deleteProfile } = useDeleteProfile();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<PiiType[]>([...ALL_PII]);
  const [maskingStyle, setMaskingStyle] = useState<MaskingStyle>(MaskingStyle.BLACK_BOX);
  const [error, setError] = useState('');

  const customProfiles = savedProfiles.filter((p) => !p.isSystem);

  function toggleType(type: PiiType) {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) { setError('Name is required.'); return; }
    if (selectedTypes.length === 0) { setError('Select at least one PII type.'); return; }
    setError('');
    saveProfile(
      { name: trimmed, piiTypes: selectedTypes, customTerms: [], maskingStyle, isSystem: false },
      {
        onSuccess: () => {
          setName('');
          setSelectedTypes([...ALL_PII]);
          setMaskingStyle(MaskingStyle.BLACK_BOX);
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="w-full gap-1.5">
          <Settings className="h-3.5 w-3.5" />
          Manage Profiles
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Redaction Profiles</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Create new profile */}
          <div className="rounded-lg border p-4 space-y-3">
            <p className="text-sm font-medium flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" /> New Profile
            </p>

            <Input
              placeholder="Profile name…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8 text-sm"
            />

            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Detect these PII types:</p>
              <div className="flex flex-wrap gap-1.5">
                {ALL_PII.map((type) => (
                  <button
                    key={type}
                    onClick={() => toggleType(type)}
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-xs border transition-colors',
                      selectedTypes.includes(type)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted text-muted-foreground border-transparent hover:border-input'
                    )}
                  >
                    {PII_LABELS[type]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Masking style:</p>
              <select
                value={maskingStyle}
                onChange={(e) => setMaskingStyle(e.target.value as MaskingStyle)}
                className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {Object.values(MaskingStyle).map((s) => (
                  <option key={s} value={s}>{STYLE_LABELS[s]}</option>
                ))}
              </select>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <Button size="sm" onClick={handleSave} disabled={saving} className="w-full">
              {saving ? 'Saving…' : 'Save Profile'}
            </Button>
          </div>

          {/* Existing custom profiles */}
          {customProfiles.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Saved Profiles
              </p>
              {customProfiles.map((profile) => (
                <div
                  key={profile.id}
                  className="flex items-start justify-between rounded-lg border p-3 gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{profile.name}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                      {profile.piiTypes.join(', ')} · {STYLE_LABELS[profile.maskingStyle]}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteProfile(profile.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors shrink-0 mt-0.5"
                    aria-label={`Delete ${profile.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
