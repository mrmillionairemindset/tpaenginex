'use client';

import { useState } from 'react';

export function UnverifiedEmailBanner() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  const handleResend = async () => {
    setStatus('sending');
    setError('');
    try {
      const res = await fetch('/api/auth/resend-verification', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setStatus('error');
        setError(data?.error || 'Failed to send verification email');
        return;
      }
      setStatus('sent');
    } catch {
      setStatus('error');
      setError('Failed to send verification email');
    }
  };

  return (
    <div className="bg-yellow-50 dark:bg-yellow-950 border-b border-yellow-200 dark:border-yellow-900 px-4 py-2.5">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-yellow-900 dark:text-yellow-100">
          Please verify your email to enable all features.
        </p>
        <div className="flex items-center gap-3">
          {status === 'sent' ? (
            <span className="text-yellow-900 dark:text-yellow-100">
              Verification email sent. Check your inbox.
            </span>
          ) : (
            <button
              onClick={handleResend}
              disabled={status === 'sending'}
              className="font-medium text-yellow-900 dark:text-yellow-100 underline hover:no-underline disabled:opacity-50"
            >
              {status === 'sending' ? 'Sending...' : 'Resend verification email'}
            </button>
          )}
          {status === 'error' && error && (
            <span className="text-red-700 dark:text-red-300">{error}</span>
          )}
        </div>
      </div>
    </div>
  );
}
