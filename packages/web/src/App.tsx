import { QueryClientProvider } from '@tanstack/react-query';
import { ClerkProvider } from '@clerk/clerk-react';
import { queryClient } from './lib/query-client';
import { Router } from './router';
import { TierSyncer } from './components/auth/TierSyncer';

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? '';
const hasRealClerkKey = CLERK_KEY.startsWith('pk_test_') && CLERK_KEY.length > 20;

function AppContent() {
  return (
    <QueryClientProvider client={queryClient}>
      <TierSyncer />
      <Router />
    </QueryClientProvider>
  );
}

export function App() {
  if (hasRealClerkKey) {
    return (
      <ClerkProvider publishableKey={CLERK_KEY}>
        <AppContent />
      </ClerkProvider>
    );
  }

  return <AppContent />;
}
