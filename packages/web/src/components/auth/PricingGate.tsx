import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Lock } from 'lucide-react';
import { Button } from '../ui/Button';
import { useSessionStore } from '@/stores/session.store';
import { UserTier } from '@redact/shared';

interface PricingGateProps {
  children: ReactNode;
  requiredTier?: UserTier;
  feature?: string;
}

export function PricingGate({ children, requiredTier = UserTier.PRO, feature }: PricingGateProps) {
  const tier = useSessionStore((s) => s.tier);
  const canProcessFile = useSessionStore((s) => s.canProcessFile);

  const hasAccess =
    requiredTier === UserTier.FREE ||
    (requiredTier === UserTier.PRO && tier !== UserTier.FREE) ||
    tier === UserTier.ENTERPRISE ||
    tier === UserTier.TEAM;

  const sessionAllowed = canProcessFile();

  if (hasAccess && sessionAllowed) return <>{children}</>;

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border p-8 text-center">
      <Lock className="h-8 w-8 text-muted-foreground" />
      <div>
        <p className="font-medium">
          {!sessionAllowed ? 'Session limit reached' : `${feature ?? 'This feature'} requires Pro`}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {!sessionAllowed
            ? "You've used all 5 free files this session."
            : `Upgrade to unlock ${feature ?? 'this feature'} and more.`}
        </p>
      </div>
      <Button asChild size="sm">
        <Link to="/pricing">View Pricing</Link>
      </Button>
    </div>
  );
}
