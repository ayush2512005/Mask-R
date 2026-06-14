import { PricingGate } from '@/components/auth/PricingGate';
import { UserTier } from '@redact/shared';
import { Badge } from '@/components/ui/Badge';
import { useProfileStore } from '@/stores/profile.store';

export function Dashboard() {
  const profiles = useProfileStore((s) => s.savedProfiles);

  return (
    <PricingGate requiredTier={UserTier.PRO} feature="Dashboard">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Dashboard</h1>
        <p className="text-sm text-muted-foreground mb-8">Your redaction profiles and history.</p>

        <section>
          <h2 className="text-sm font-semibold text-foreground mb-3">Redaction Profiles</h2>
          <div className="space-y-2">
            {profiles.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">No profiles saved yet.</p>
            )}
            {profiles.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/30"
              >
                <div className="flex items-center gap-2.5">
                  <span className="font-medium text-sm">{p.name}</span>
                  {p.isSystem && (
                    <Badge variant="secondary" className="text-[10px]">System</Badge>
                  )}
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
