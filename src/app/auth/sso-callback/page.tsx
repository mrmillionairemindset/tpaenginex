import { Suspense } from 'react';
import SsoCallbackClient from './sso-callback-client';

export const dynamic = 'force-dynamic';

export default function SsoCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-sm text-muted-foreground">Completing sign-in…</p>
        </div>
      }
    >
      <SsoCallbackClient />
    </Suspense>
  );
}
