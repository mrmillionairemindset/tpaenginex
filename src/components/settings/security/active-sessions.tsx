'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Laptop, Smartphone, Monitor, LogOut } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Session {
  id: string;
  deviceLabel: string | null;
  ipAddress: string | null;
  lastSeenAt: string;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

function deviceIcon(label: string | null): typeof Laptop {
  if (!label) return Monitor;
  const lower = label.toLowerCase();
  if (/iphone|android|mobile|phone/.test(lower)) return Smartphone;
  if (/mac|windows|linux/.test(lower)) return Laptop;
  return Monitor;
}

export function ActiveSessions() {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeAllOpen, setRevokeAllOpen] = useState(false);
  const [revokingAll, setRevokingAll] = useState(false);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/user/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions);
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load sessions',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const revokeSession = async (id: string) => {
    setRevokingId(id);
    try {
      const res = await fetch(`/api/user/sessions/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast({ title: 'Session revoked', description: 'The device has been signed out' });
        await fetchSessions();
      } else {
        const data = await res.json().catch(() => ({}));
        toast({
          title: 'Could not revoke',
          description: data.error || 'An error occurred',
          variant: 'destructive',
        });
      }
    } finally {
      setRevokingId(null);
    }
  };

  const revokeAllOthers = async () => {
    setRevokingAll(true);
    try {
      const res = await fetch('/api/user/sessions', { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        toast({
          title: 'Sessions revoked',
          description: `Signed out ${data.revokedCount} other session${data.revokedCount === 1 ? '' : 's'}`,
        });
        setRevokeAllOpen(false);
        await fetchSessions();
      } else {
        toast({ title: 'Error', description: 'Failed to revoke sessions', variant: 'destructive' });
      }
    } finally {
      setRevokingAll(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex justify-center py-4">
          <LoadingSpinner size="md" />
        </div>
      </Card>
    );
  }

  const otherSessionCount = sessions.filter((s) => !s.isCurrent).length;

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-lg font-semibold">Active Sessions</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Devices currently signed in to your account. Revoke any you don't recognize.
          </p>
        </div>
        {otherSessionCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRevokeAllOpen(true)}
          >
            <LogOut className="h-4 w-4 mr-1" />
            Sign out all others
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {sessions.length === 0 && (
          <p className="text-sm text-muted-foreground">No active sessions.</p>
        )}
        {sessions.map((session) => {
          const Icon = deviceIcon(session.deviceLabel);
          return (
            <div
              key={session.id}
              className="flex items-start justify-between gap-4 p-3 rounded-lg border"
            >
              <div className="flex items-start gap-3 flex-1">
                <Icon className="h-5 w-5 mt-0.5 text-muted-foreground" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {session.deviceLabel || 'Unknown device'}
                    </span>
                    {session.isCurrent && (
                      <Badge variant="default" className="bg-green-600 text-xs">
                        This device
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {session.ipAddress && <span>{session.ipAddress} · </span>}
                    Last active {formatDistanceToNow(new Date(session.lastSeenAt), { addSuffix: true })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Signed in {formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}
                  </div>
                </div>
              </div>
              {!session.isCurrent && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => revokeSession(session.id)}
                  disabled={revokingId === session.id}
                >
                  {revokingId === session.id ? 'Revoking...' : 'Revoke'}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <Dialog open={revokeAllOpen} onOpenChange={(open) => !revokingAll && setRevokeAllOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign out all other sessions?</DialogTitle>
            <DialogDescription>
              This will immediately sign you out from all other devices. You'll stay signed in on this device.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeAllOpen(false)} disabled={revokingAll}>
              Cancel
            </Button>
            <Button onClick={revokeAllOthers} disabled={revokingAll}>
              {revokingAll ? 'Revoking...' : `Sign out ${otherSessionCount} session${otherSessionCount === 1 ? '' : 's'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
