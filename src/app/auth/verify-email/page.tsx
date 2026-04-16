'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

type Status = 'verifying' | 'success' | 'error';

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
          <div className="text-sm text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const email = searchParams.get('email') || '';

  const [status, setStatus] = useState<Status>('verifying');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token || !email) {
      setStatus('error');
      setMessage('Invalid or missing verification link');
      return;
    }

    (async () => {
      try {
        const res = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, email }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setStatus('error');
          setMessage(data?.error || 'Verification failed');
          return;
        }
        setStatus('success');
        setMessage(
          data?.alreadyVerified
            ? 'Your email was already verified.'
            : 'Your email has been verified.'
        );
      } catch {
        setStatus('error');
        setMessage('An error occurred. Please try again.');
      }
    })();
  }, [token, email]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Email verification</h2>

        {status === 'verifying' && (
          <p className="text-sm text-muted-foreground">Verifying your email...</p>
        )}

        {status === 'success' && (
          <div className="rounded-md bg-green-50 dark:bg-green-950 p-4 text-sm text-green-800 dark:text-green-200">
            {message}
          </div>
        )}

        {status === 'error' && (
          <div className="rounded-md bg-red-50 dark:bg-red-950 p-4 text-sm text-red-800 dark:text-red-200">
            {message}
          </div>
        )}

        <div className="text-sm">
          <Link href="/auth/signin" className="font-medium text-primary hover:text-primary/80">
            Go to sign in →
          </Link>
        </div>
      </div>
    </div>
  );
}
