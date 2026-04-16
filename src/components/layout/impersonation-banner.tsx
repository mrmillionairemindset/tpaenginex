'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';

interface ImpersonationBannerProps {
  impersonation: {
    targetName: string | null;
    targetEmail: string;
    actualEmail: string | null;
  };
}

export function ImpersonationBanner({ impersonation }: ImpersonationBannerProps) {
  const router = useRouter();
  const [ending, setEnding] = useState(false);

  async function end() {
    setEnding(true);
    try {
      const res = await fetch('/api/platform/impersonate', { method: 'DELETE' });
      if (res.ok) {
        router.push('/platform');
        router.refresh();
      } else {
        setEnding(false);
      }
    } catch {
      setEnding(false);
    }
  }

  const display = impersonation.targetName
    ? `${impersonation.targetName} (${impersonation.targetEmail})`
    : impersonation.targetEmail;

  return (
    <div className="bg-red-600 text-white px-4 py-2 text-sm flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 flex-shrink-0" />
        <span>
          <strong>Impersonating:</strong> {display}
          {impersonation.actualEmail && (
            <span className="opacity-80"> — signed in as {impersonation.actualEmail}</span>
          )}
        </span>
      </div>
      <button
        onClick={end}
        disabled={ending}
        className="bg-white text-red-700 hover:bg-red-50 px-3 py-1 rounded text-xs font-medium disabled:opacity-60"
      >
        {ending ? 'Ending…' : 'End impersonation'}
      </button>
    </div>
  );
}
