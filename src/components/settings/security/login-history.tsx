'use client';

/**
 * Renders the current user's recent login/security activity.
 * Fetches from /api/user/login-history and shows a scrollable table.
 */

import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';

interface LoginEventRow {
  id: string;
  event: string;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

function eventColor(event: string): 'default' | 'destructive' | 'secondary' | 'outline' {
  if (event === 'login_success' || event === '2fa_success' || event === 'backup_code_used') {
    return 'default';
  }
  if (
    event.startsWith('login_failed_') ||
    event === 'account_locked' ||
    event === '2fa_failed' ||
    event === 'password_reset_failed'
  ) {
    return 'destructive';
  }
  if (event.startsWith('logout_')) return 'outline';
  return 'secondary';
}

function eventLabel(event: string): string {
  return event
    .split('_')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

/**
 * Extracts a simplified browser/OS label from the User-Agent string.
 */
function simplifyUserAgent(ua: string | null): string {
  if (!ua) return '—';
  // Order matters — test most-specific first
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\//.test(ua) || /Opera/.test(ua)) return 'Opera';
  if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) return 'Chrome';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'Other';
}

export function LoginHistory() {
  const [events, setEvents] = useState<LoginEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/user/login-history', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setEvents(data.events || []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
        <CardDescription>
          Sign-in events and security actions from the last 30 days. Review this
          list periodically and contact support if you see anything suspicious.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="text-sm text-muted-foreground py-4">Loading...</div>
        )}
        {error && (
          <div className="text-sm text-destructive py-4">
            Failed to load activity: {error}
          </div>
        )}
        {!loading && !error && events.length === 0 && (
          <div className="text-sm text-muted-foreground py-4">
            No recent activity to display.
          </div>
        )}
        {!loading && !error && events.length > 0 && (
          <div className="max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Browser</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((ev) => (
                  <TableRow key={ev.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {format(new Date(ev.createdAt), 'MMM d, yyyy h:mm a')}
                    </TableCell>
                    <TableCell>
                      <Badge variant={eventColor(ev.event)}>
                        {eventLabel(ev.event)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {ev.ipAddress || '—'}
                    </TableCell>
                    <TableCell className="text-xs">
                      {simplifyUserAgent(ev.userAgent)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
