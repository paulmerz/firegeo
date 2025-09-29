'use client';

import { AutumnProvider } from 'autumn-js/react';
import { QueryProvider } from '@/lib/providers/query-provider';
import { AutumnCustomerProvider } from '@/hooks/useAutumnCustomer';
import { useSession } from '@/lib/auth-client';

function AuthAwareAutumnProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  
  // Always render AutumnProvider, but with different configurations based on auth state
  return (
    <AutumnProvider
      backendUrl="/api/autumn"
      betterAuthUrl={process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : "http://localhost:3000")}
      allowAnonymous={true}
      skipInitialFetch={!session}
      includeCredentials={true}
    >
      <AutumnCustomerProvider>
        {children}
      </AutumnCustomerProvider>
    </AutumnProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <AuthAwareAutumnProvider>
        {children}
      </AuthAwareAutumnProvider>
    </QueryProvider>
  );
}