'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/components/ui/use-toast';
import { Copy, KeyRound, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

const ALL_SCOPES = [
  'orders:read', 'orders:write',
  'persons:read', 'persons:write',
  'collectors:read', 'collectors:write',
  'events:read', 'events:write',
  'billing:read',
  'leads:read', 'leads:write',
  'dqf:read', 'dqf:write',
  'webhooks:write',
] as const;

type Scope = (typeof ALL_SCOPES)[number];

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  usageCount: number;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

function keyStatus(k: ApiKey): { label: string; className: string } {
  if (k.revokedAt) return { label: 'Revoked', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' };
  if (k.expiresAt && new Date(k.expiresAt) < new Date()) {
    return { label: 'Expired', className: 'bg-muted text-foreground' };
  }
  return { label: 'Active', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' };
}

export function ApiKeysManager() {
  const { toast } = useToast();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState<Set<Scope>>(new Set());
  const [newKeyExpiry, setNewKeyExpiry] = useState<string>('never');
  const [justCreated, setJustCreated] = useState<{ key: string; prefix: string } | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);
  const [revoking, setRevoking] = useState(false);

  async function fetchKeys() {
    setLoading(true);
    try {
      const res = await fetch('/api/api-keys');
      if (res.ok) {
        const data = await res.json();
        setKeys(data.apiKeys);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchKeys();
  }, []);

  function toggleScope(s: Scope) {
    setNewKeyScopes((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  function resetCreateForm() {
    setNewKeyName('');
    setNewKeyScopes(new Set());
    setNewKeyExpiry('never');
  }

  async function createKey() {
    if (!newKeyName.trim()) {
      toast({ title: 'Name required', variant: 'destructive' });
      return;
    }
    if (newKeyScopes.size === 0) {
      toast({ title: 'Select at least one scope', variant: 'destructive' });
      return;
    }

    setCreating(true);
    try {
      const expiresInDays =
        newKeyExpiry === 'never' ? null :
        newKeyExpiry === '30' ? 30 :
        newKeyExpiry === '90' ? 90 :
        newKeyExpiry === '365' ? 365 : null;

      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newKeyName.trim(),
          scopes: Array.from(newKeyScopes),
          expiresInDays,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setJustCreated({ key: data.key, prefix: data.keyPrefix });
        setCreateOpen(false);
        resetCreateForm();
        await fetchKeys();
        toast({ title: 'API key created' });
      } else {
        const err = await res.json();
        toast({ title: 'Error', description: err.error || 'Failed to create key', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to create key', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  }

  async function revokeKey(k: ApiKey) {
    setRevoking(true);
    try {
      const res = await fetch(`/api/api-keys/${k.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast({ title: 'API key revoked' });
        setRevokeTarget(null);
        await fetchKeys();
      } else {
        const err = await res.json();
        toast({ title: 'Error', description: err.error || 'Failed to revoke', variant: 'destructive' });
      }
    } finally {
      setRevoking(false);
    }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard' });
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Create API key
        </Button>
      </div>

      <Card className="p-6">
        {loading ? (
          <div className="flex justify-center py-8"><LoadingSpinner /></div>
        ) : keys.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <KeyRound className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>No API keys yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Prefix</th>
                  <th className="pb-2 font-medium">Scopes</th>
                  <th className="pb-2 font-medium">Last Used</th>
                  <th className="pb-2 font-medium">Created</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {keys.map((k) => {
                  const status = keyStatus(k);
                  return (
                    <tr key={k.id}>
                      <td className="py-3 font-medium">{k.name}</td>
                      <td className="py-3 font-mono text-xs">{k.keyPrefix}…</td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-1 max-w-md">
                          {k.scopes.slice(0, 3).map((s) => (
                            <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                          ))}
                          {k.scopes.length > 3 && (
                            <Badge variant="secondary" className="text-xs">+{k.scopes.length - 3}</Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {k.lastUsedAt ? format(new Date(k.lastUsedAt), 'MMM d, yyyy') : 'Never'}
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {format(new Date(k.createdAt), 'MMM d, yyyy')}
                      </td>
                      <td className="py-3">
                        <Badge variant="secondary" className={status.className}>
                          {status.label}
                        </Badge>
                      </td>
                      <td className="py-3 text-right">
                        {!k.revokedAt && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setRevokeTarget(k)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) { setCreateOpen(false); resetCreateForm(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API key</DialogTitle>
            <DialogDescription>
              Generate a new API key for M2M access. The raw key will be shown once.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="key-name">Name</Label>
              <Input
                id="key-name"
                placeholder="e.g., Production integration"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
              />
            </div>
            <div>
              <Label>Scopes</Label>
              <div className="grid grid-cols-2 gap-2 mt-2 max-h-64 overflow-y-auto border rounded p-3">
                {ALL_SCOPES.map((s) => (
                  <label key={s} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newKeyScopes.has(s)}
                      onChange={() => toggleScope(s)}
                      className="rounded"
                    />
                    <span className="font-mono text-xs">{s}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="key-expiry">Expires</Label>
              <select
                id="key-expiry"
                value={newKeyExpiry}
                onChange={(e) => setNewKeyExpiry(e.target.value)}
                className="w-full mt-1 border rounded-md px-3 py-2 text-sm bg-background"
              >
                <option value="never">Never</option>
                <option value="30">30 days</option>
                <option value="90">90 days</option>
                <option value="365">1 year</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setCreateOpen(false); resetCreateForm(); }} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={createKey} disabled={creating}>
              {creating ? 'Creating…' : 'Create key'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Newly created key display */}
      <Dialog open={!!justCreated} onOpenChange={(o) => { if (!o) setJustCreated(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API key created</DialogTitle>
            <DialogDescription>
              Save this key now — you will not be able to view it again.
            </DialogDescription>
          </DialogHeader>
          {justCreated && (
            <div className="space-y-3">
              <div className="border rounded p-3 bg-muted">
                <code className="text-xs font-mono break-all">{justCreated.key}</code>
              </div>
              <Button onClick={() => copy(justCreated.key)} variant="secondary" size="sm">
                <Copy className="h-4 w-4 mr-1" /> Copy key
              </Button>
              <p className="text-xs text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded">
                Treat this key like a password. Anyone with it can act on behalf of your TPA.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setJustCreated(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke confirmation */}
      <Dialog open={!!revokeTarget} onOpenChange={(o) => { if (!o) setRevokeTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke API key</DialogTitle>
            <DialogDescription>
              Revoking <span className="font-semibold">{revokeTarget?.name}</span> will immediately
              block all requests using it. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRevokeTarget(null)} disabled={revoking}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => revokeTarget && revokeKey(revokeTarget)}
              disabled={revoking}
            >
              {revoking ? 'Revoking…' : 'Revoke key'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
