'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';

export default function SsoCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';

    if (!token) {
      setError('Missing SSO token');
      return;
    }

    (async () => {
      try {
        const res = await signIn('sso', {
          token,
          redirect: false,
        });
        if (res?.error) {
          setError('SSO sign-in failed. The token may have expired — please try again.');
          return;
        }
        router.push(callbackUrl);
        router.refresh();
      } catch {
        setError('Unexpected error during SSO sign-in');
      }
    })();
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-4 text-center">
        {error ? (
          <>
            <h1 className="text-xl font-semibold text-foreground">Sign-in failed</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
            <a
              href="/auth/signin"
              className="inline-block text-sm font-medium text-primary hover:text-primary/80"
            >
              Return to sign in
            </a>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-foreground">Completing sign-in…</h1>
            <p className="text-sm text-muted-foreground">
              Verifying your identity provider response.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
