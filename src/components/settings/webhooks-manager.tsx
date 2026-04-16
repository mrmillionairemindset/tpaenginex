'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Copy, Plus, Trash2, RotateCcw, Webhook as WebhookIcon, ChevronRight, KeyRound, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

interface Webhook {
  id: string;
  url: string;
  events: string[];
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  secretRotatedAt: string | null;
  previousSecretExpiresAt: string | null;
  stats: {
    total: number;
    succeeded: number;
    failed: number;
    lastAttemptAt: string | null;
  };
}

function rotationRemainingHours(expiresAtIso: string | null | undefined): number | null {
  if (!expiresAtIso) return null;
  const ms = new Date(expiresAtIso).getTime() - Date.now();
  if (ms <= 0) return null;
  return Math.max(1, Math.ceil(ms / (60 * 60 * 1000)));
}

interface Delivery {
  id: string;
  event: string;
  status: 'pending' | 'success' | 'failed' | 'dead_letter';
  attempts: number;
  maxAttempts: number;
  responseStatus: number | null;
  responseBody: string | null;
  errorMessage: string | null;
  nextAttemptAt: string | null;
  lastAttemptAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function statusBadge(status: string) {
  switch (status) {
    case 'success':
      return <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Success</Badge>;
    case 'pending':
      return <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">Pending</Badge>;
    case 'failed':
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">Failed</Badge>;
    case 'dead_letter':
      return <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">Dead-letter</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export function WebhooksManager() {
  const { toast } = useToast();
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [availableEvents, setAvailableEvents] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formUrl, setFormUrl] = useState('');
  const [formEvents, setFormEvents] = useState<Set<string>>(new Set());
  const [formDescription, setFormDescription] = useState('');
  const [justCreated, setJustCreated] = useState<{ secret: string } | null>(null);
  const [rotateTarget, setRotateTarget] = useState<Webhook | null>(null);
  const [rotating, setRotating] = useState(false);
  const [rotatedSecret, setRotatedSecret] = useState<{ secret: string; previousSecretExpiresAt: string } | null>(null);
  const [selected, setSelected] = useState<Webhook | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);

  async function fetchWebhooks() {
    setLoading(true);
    try {
      const res = await fetch('/api/webhooks');
      if (res.ok) {
        const data = await res.json();
        setWebhooks(data.webhooks);
        setAvailableEvents(data.availableEvents);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchWebhooks();
  }, []);

  async function fetchDeliveries(webhookId: string) {
    setLoadingDeliveries(true);
    try {
      const res = await fetch(`/api/webhooks/${webhookId}/deliveries`);
      if (res.ok) {
        const data = await res.json();
        setDeliveries(data.deliveries);
      }
    } finally {
      setLoadingDeliveries(false);
    }
  }

  async function openDetail(w: Webhook) {
    setSelected(w);
    await fetchDeliveries(w.id);
  }

  function resetForm() {
    setFormUrl('');
    setFormEvents(new Set());
    setFormDescription('');
  }

  function toggleFormEvent(e: string) {
    setFormEvents((prev) => {
      const next = new Set(prev);
      if (next.has(e)) next.delete(e);
      else next.add(e);
      return next;
    });
  }

  async function createWebhook() {
    if (!formUrl.trim() || formEvents.size === 0) {
      toast({ title: 'URL and at least one event required', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: formUrl.trim(),
          events: Array.from(formEvents),
          description: formDescription.trim() || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setJustCreated({ secret: data.secret });
        setCreateOpen(false);
        resetForm();
        await fetchWebhooks();
        toast({ title: 'Webhook created' });
      } else {
        const err = await res.json();
        toast({ title: 'Error', description: err.error || 'Failed to create', variant: 'destructive' });
      }
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(w: Webhook) {
    const res = await fetch(`/api/webhooks/${w.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !w.isActive }),
    });
    if (res.ok) {
      await fetchWebhooks();
      if (selected?.id === w.id) {
        setSelected((s) => s ? { ...s, isActive: !s.isActive } : s);
      }
      toast({ title: `Webhook ${!w.isActive ? 'enabled' : 'disabled'}` });
    }
  }

  async function deleteWebhook(w: Webhook) {
    if (!confirm(`Delete webhook ${w.url}? This cannot be undone.`)) return;
    const res = await fetch(`/api/webhooks/${w.id}`, { method: 'DELETE' });
    if (res.ok) {
      toast({ title: 'Webhook deleted' });
      if (selected?.id === w.id) setSelected(null);
      await fetchWebhooks();
    }
  }

  async function rotateSecret(w: Webhook) {
    setRotating(true);
    try {
      const res = await fetch(`/api/webhooks/${w.id}/rotate-secret`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setRotatedSecret({
          secret: data.secret,
          previousSecretExpiresAt: data.previousSecretExpiresAt,
        });
        setRotateTarget(null);
        await fetchWebhooks();
        if (selected?.id === w.id) {
          setSelected((s) =>
            s
              ? {
                  ...s,
                  secretRotatedAt: data.secretRotatedAt,
                  previousSecretExpiresAt: data.previousSecretExpiresAt,
                }
              : s,
          );
        }
        toast({ title: 'Secret rotated' });
      } else {
        const err = await res.json();
        toast({ title: 'Error', description: err.error || 'Failed to rotate', variant: 'destructive' });
      }
    } finally {
      setRotating(false);
    }
  }

  async function redeliver(deliveryId: string) {
    if (!selected) return;
    const res = await fetch(`/api/webhooks/${selected.id}/redeliver`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deliveryId }),
    });
    if (res.ok) {
      toast({ title: 'Delivery re-queued' });
      await fetchDeliveries(selected.id);
    } else {
      const err = await res.json();
      toast({ title: 'Error', description: err.error || 'Failed', variant: 'destructive' });
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
          <Plus className="h-4 w-4 mr-1" /> Create webhook
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="p-6 lg:col-span-2">
          <h3 className="font-semibold mb-4">Subscriptions</h3>
          {loading ? (
            <div className="flex justify-center py-8"><LoadingSpinner /></div>
          ) : webhooks.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <WebhookIcon className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No webhooks yet.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {webhooks.map((w) => (
                <li
                  key={w.id}
                  className={`border rounded p-3 cursor-pointer hover:bg-muted ${selected?.id === w.id ? 'bg-muted border-primary' : ''}`}
                  onClick={() => openDetail(w)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-xs truncate" title={w.url}>{truncate(w.url, 60)}</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {w.events.slice(0, 2).map((e) => (
                          <Badge key={e} variant="secondary" className="text-xs">{e}</Badge>
                        ))}
                        {w.events.length > 2 && (
                          <Badge variant="secondary" className="text-xs">+{w.events.length - 2}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span>{w.stats.total} delivered</span>
                        {w.stats.failed > 0 && <span className="text-yellow-700 dark:text-yellow-500">{w.stats.failed} failed</span>}
                        {!w.isActive && <Badge variant="secondary" className="bg-muted">Disabled</Badge>}
                      </div>
                      {(() => {
                        const hrs = rotationRemainingHours(w.previousSecretExpiresAt);
                        return hrs !== null ? (
                          <div className="mt-2 flex items-start gap-1.5 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                            <span>Rolling rotation in progress — old secret expires in {hrs} hour{hrs === 1 ? '' : 's'}</span>
                          </div>
                        ) : null;
                      })()}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-6 lg:col-span-3">
          {!selected ? (
            <p className="text-muted-foreground text-sm text-center py-12">
              Select a webhook to view deliveries.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold break-all">{selected.url}</h3>
                  {selected.description && (
                    <p className="text-sm text-muted-foreground mt-1">{selected.description}</p>
                  )}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {selected.events.map((e) => (
                      <Badge key={e} variant="secondary" className="text-xs">{e}</Badge>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button size="sm" variant="outline" onClick={() => setRotateTarget(selected)}>
                    <KeyRound className="h-4 w-4 mr-1" /> Rotate secret
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => toggleActive(selected)}>
                    {selected.isActive ? 'Disable' : 'Enable'}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-600" onClick={() => deleteWebhook(selected)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {(() => {
                const hrs = rotationRemainingHours(selected.previousSecretExpiresAt);
                return hrs !== null ? (
                  <div className="flex items-start gap-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium">Rolling rotation in progress</div>
                      <div className="text-xs mt-0.5">
                        The previous signing secret is still accepted. It expires in {hrs} hour{hrs === 1 ? '' : 's'}. Update your subscriber to the new secret before then.
                      </div>
                    </div>
                  </div>
                ) : null;
              })()}

              <div>
                <h4 className="text-sm font-medium mb-2">Recent deliveries</h4>
                {loadingDeliveries ? (
                  <div className="flex justify-center py-6"><LoadingSpinner /></div>
                ) : deliveries.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">No deliveries yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-2 font-medium">Event</th>
                          <th className="pb-2 font-medium">Status</th>
                          <th className="pb-2 font-medium">Attempts</th>
                          <th className="pb-2 font-medium">Response</th>
                          <th className="pb-2 font-medium">When</th>
                          <th className="pb-2 font-medium"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {deliveries.map((d) => (
                          <tr key={d.id}>
                            <td className="py-2 font-mono text-xs">{d.event}</td>
                            <td className="py-2">{statusBadge(d.status)}</td>
                            <td className="py-2 text-muted-foreground">
                              {d.attempts}/{d.maxAttempts}
                            </td>
                            <td className="py-2 text-muted-foreground">
                              {d.responseStatus ? `HTTP ${d.responseStatus}` : (d.errorMessage ? truncate(d.errorMessage, 40) : '-')}
                            </td>
                            <td className="py-2 text-muted-foreground">
                              {d.lastAttemptAt ? format(new Date(d.lastAttemptAt), 'MMM d HH:mm') : format(new Date(d.createdAt), 'MMM d HH:mm')}
                            </td>
                            <td className="py-2 text-right">
                              {(d.status === 'failed' || d.status === 'dead_letter' || d.status === 'success') && (
                                <Button size="sm" variant="ghost" onClick={() => redeliver(d.id)} title="Re-deliver">
                                  <RotateCcw className="h-3 w-3" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) { setCreateOpen(false); resetForm(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create webhook</DialogTitle>
            <DialogDescription>
              Events will be POSTed to your URL with an HMAC signature.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="wh-url">URL</Label>
              <Input
                id="wh-url"
                type="url"
                placeholder="https://example.com/webhooks/tpa"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
              />
            </div>
            <div>
              <Label>Events</Label>
              <div className="grid grid-cols-1 gap-2 mt-2 max-h-64 overflow-y-auto border rounded p-3">
                {availableEvents.map((ev) => (
                  <label key={ev} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formEvents.has(ev)}
                      onChange={() => toggleFormEvent(ev)}
                      className="rounded"
                    />
                    <span className="font-mono text-xs">{ev}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="wh-desc">Description (optional)</Label>
              <Textarea
                id="wh-desc"
                rows={2}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setCreateOpen(false); resetForm(); }} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={createWebhook} disabled={creating}>
              {creating ? 'Creating…' : 'Create webhook'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Secret display */}
      <Dialog open={!!justCreated} onOpenChange={(o) => { if (!o) setJustCreated(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Webhook created</DialogTitle>
            <DialogDescription>
              Save this signing secret now — you will not be able to view it again.
              Use it to verify the <code>X-Webhook-Signature</code> header (HMAC-SHA256).
            </DialogDescription>
          </DialogHeader>
          {justCreated && (
            <div className="space-y-3">
              <div className="border rounded p-3 bg-muted">
                <code className="text-xs font-mono break-all">{justCreated.secret}</code>
              </div>
              <Button onClick={() => copy(justCreated.secret)} variant="secondary" size="sm">
                <Copy className="h-4 w-4 mr-1" /> Copy secret
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setJustCreated(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rotate-secret confirmation dialog */}
      <Dialog open={!!rotateTarget} onOpenChange={(o) => { if (!o && !rotating) setRotateTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rotate signing secret</DialogTitle>
            <DialogDescription>
              A new signing secret will be generated. The old secret will be accepted for 24 hours.
              Update your subscriber before that expires, or deliveries will start failing signature verification.
            </DialogDescription>
          </DialogHeader>
          {rotateTarget && (
            <div className="space-y-2 text-sm">
              <div className="font-mono text-xs break-all text-muted-foreground">{rotateTarget.url}</div>
              <div className="flex items-start gap-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>During the 24-hour grace window, deliveries will include both <code>X-Webhook-Signature</code> (new) and <code>X-Webhook-Signature-Previous</code> (old).</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRotateTarget(null)} disabled={rotating}>
              Cancel
            </Button>
            <Button onClick={() => rotateTarget && rotateSecret(rotateTarget)} disabled={rotating}>
              {rotating ? 'Rotating…' : 'Rotate secret'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rotated secret display */}
      <Dialog open={!!rotatedSecret} onOpenChange={(o) => { if (!o) setRotatedSecret(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New signing secret</DialogTitle>
            <DialogDescription>
              Copy this now — you will not see it again. The previous secret remains valid until
              {rotatedSecret && (
                <> {' '}<strong>{format(new Date(rotatedSecret.previousSecretExpiresAt), 'PPpp')}</strong></>
              )}.
            </DialogDescription>
          </DialogHeader>
          {rotatedSecret && (
            <div className="space-y-3">
              <div className="border rounded p-3 bg-muted">
                <code className="text-xs font-mono break-all">{rotatedSecret.secret}</code>
              </div>
              <Button onClick={() => copy(rotatedSecret.secret)} variant="secondary" size="sm">
                <Copy className="h-4 w-4 mr-1" /> Copy secret
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setRotatedSecret(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
