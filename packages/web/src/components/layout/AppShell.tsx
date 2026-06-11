import type { ReactNode } from 'react';
import { Header } from './Header';
import { TierBanner } from './TierBanner';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />
      <TierBanner />
      <main className="flex-1">{children}</main>
    </div>
  );
}
