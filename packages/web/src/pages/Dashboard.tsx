import { PricingGate } from '@/components/auth/PricingGate';
import { UserTier } from '@redact/shared';
import { Badge } from '@/components/ui/Badge';
import { useProfileStore } from '@/stores/profile.store';

export function Dashboard() {
  const profiles = useProfileStore((s) => s.savedProfiles);

  return (
    <PricingGate requiredTier={UserTier.PRO} feature="Dashboard">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

        <section>
          <h2 className="font-semibold mb-3">Your Redaction Profiles</h2>
          <div className="space-y-2">
            {profiles.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{p.name}</span>
                  {p.isSystem && <Badge variant="secondary" className="text-[10px]">System</Badge>}
                </div>
                <span className="text-xs text-muted-foreground">{p.piiTypes.length} PII types</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </PricingGate>
  );
}
