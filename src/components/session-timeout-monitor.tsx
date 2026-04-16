'use client';

/**
 * HIPAA Session Timeout Monitor.
 *
 * Watches for user inactivity and:
 *   - Shows a warning modal at 13 min of inactivity ("signed out in 2 minutes")
 *   - Signs the user out at 15 min of inactivity
 *   - Resets the timer on mousemove / keydown / click / scroll (throttled)
 *
 * Also calls POST /api/auth/log-logout before signOut() to create an audit trail.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { signOut } from 'next-auth/react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const IDLE_WARNING_MS = 13 * 60 * 1000; // 13 min — show warning
const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 min — hard logout
const ACTIVITY_THROTTLE_MS = 5 * 1000;  // throttle activity updates to once per 5s
const COUNTDOWN_TICK_MS = 1000;

async function logLogout(reason: 'manual' | 'idle_timeout') {
  try {
    await fetch('/api/auth/log-logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
      keepalive: true,
    });
  } catch {
    // Swallow — never block signOut on logging failure
  }
}

export function SessionTimeoutMonitor() {
  const [warningOpen, setWarningOpen] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(
    Math.floor((IDLE_TIMEOUT_MS - IDLE_WARNING_MS) / 1000)
  );

  const lastActivityRef = useRef<number>(Date.now());
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastThrottleRef = useRef<number>(0);

  const clearAllTimers = useCallback(() => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    warningTimerRef.current = null;
    timeoutTimerRef.current = null;
    countdownIntervalRef.current = null;
  }, []);

  const doIdleLogout = useCallback(async () => {
    clearAllTimers();
    await logLogout('idle_timeout');
    signOut({ callbackUrl: '/auth/signin?timeout=1' });
  }, [clearAllTimers]);

  const scheduleTimers = useCallback(() => {
    clearAllTimers();

    warningTimerRef.current = setTimeout(() => {
      setWarningOpen(true);
      setRemainingSeconds(Math.floor((IDLE_TIMEOUT_MS - IDLE_WARNING_MS) / 1000));

      countdownIntervalRef.current = setInterval(() => {
        setRemainingSeconds((s) => (s > 0 ? s - 1 : 0));
      }, COUNTDOWN_TICK_MS);
    }, IDLE_WARNING_MS);

    timeoutTimerRef.current = setTimeout(() => {
      doIdleLogout();
    }, IDLE_TIMEOUT_MS);
  }, [clearAllTimers, doIdleLogout]);

  const resetTimer = useCallback(
    (options?: { force?: boolean }) => {
      const now = Date.now();
      // Throttle: don't thrash timers on every mousemove
      if (!options?.force && now - lastThrottleRef.current < ACTIVITY_THROTTLE_MS) {
        return;
      }
      lastThrottleRef.current = now;
      lastActivityRef.current = now;
      scheduleTimers();
    },
    [scheduleTimers]
  );

  const handleStaySignedIn = useCallback(async () => {
    setWarningOpen(false);
    // Refresh session token on the server by pinging /api/auth/session
    try {
      await fetch('/api/auth/session', { cache: 'no-store' });
    } catch {
      // ignore
    }
    resetTimer({ force: true });
  }, [resetTimer]);

  const handleSignOutNow = useCallback(async () => {
    clearAllTimers();
    setWarningOpen(false);
    await logLogout('manual');
    signOut({ callbackUrl: '/auth/signin' });
  }, [clearAllTimers]);

  useEffect(() => {
    const events: Array<keyof WindowEventMap> = [
      'mousemove',
      'keydown',
      'click',
      'scroll',
      'touchstart',
    ];

    const onActivity = () => {
      // If warning modal is up, don't auto-reset — user must click "Stay signed in"
      if (warningOpen) return;
      resetTimer();
    };

    events.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }));
    scheduleTimers();

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, onActivity));
      clearAllTimers();
    };
  }, [warningOpen, resetTimer, scheduleTimers, clearAllTimers]);

  const mm = Math.floor(remainingSeconds / 60);
  const ss = String(remainingSeconds % 60).padStart(2, '0');

  return (
    <Dialog open={warningOpen} onOpenChange={() => { /* modal is controlled — ignore outside closes */ }}>
      <DialogContent onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Are you still there?</DialogTitle>
          <DialogDescription>
            For your security, you will be signed out automatically in{' '}
            <span className="font-mono font-semibold">
              {mm}:{ss}
            </span>{' '}
            due to inactivity.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleSignOutNow}>
            Sign out now
          </Button>
          <Button onClick={handleStaySignedIn}>Stay signed in</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
