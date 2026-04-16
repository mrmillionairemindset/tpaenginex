'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

interface Status {
  configured: boolean;
  hasApiKey: boolean;
  hasWebhookSecret: boolean;
  defaultNode: string | null;
}

export function CheckrSettingsForm() {
  const { toast } = useToast();
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ apiKey: '', webhookSecret: '', defaultNode: '' });

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/background/credentials');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        setForm((f) => ({ ...f, defaultNode: data.defaultNode ?? '' }));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleSave = async () => {
    if (!form.apiKey.trim() || !form.webhookSecret.trim()) {
      toast({ title: 'Validation error', description: 'API key and webhook secret are required.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/background/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: form.apiKey.trim(),
          webhookSecret: form.webhookSecret.trim(),
          defaultNode: form.defaultNode.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save');
      }
      toast({ title: 'Credentials saved' });
      setForm({ apiKey: '', webhookSecret: '', defaultNode: form.defaultNode });
      fetchStatus();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!confirm('Clear Checkr credentials? Existing background checks will not be affected, but new ones cannot be created until credentials are re-entered.')) return;
    setSaving(true);
    try {
      const res = await fetch('/api/background/credentials', { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to clear');
      toast({ title: 'Credentials cleared' });
      fetchStatus();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="max-w-2xl p-6">
      <h2 className="mb-2 text-lg font-semibold">Checkr Credentials</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Configure your Checkr API key and webhook signing secret. Credentials are encrypted at rest and never leave this server in their plaintext form.
      </p>

      <div className="mb-4 flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Status:</span>
        {loading ? (
          <Badge variant="secondary">Loading…</Badge>
        ) : status?.configured ? (
          <Badge className="bg-green-100 text-green-800">Configured</Badge>
        ) : (
          <Badge className="bg-amber-100 text-amber-800">Not configured</Badge>
        )}
        {status?.hasApiKey && <Badge variant="secondary">API key stored</Badge>}
        {status?.hasWebhookSecret && <Badge variant="secondary">Webhook secret stored</Badge>}
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="apiKey">API Key {status?.hasApiKey && <span className="text-xs text-muted-foreground">(stored — enter to replace)</span>}</Label>
          <Input
            id="apiKey"
            type="password"
            autoComplete="off"
            value={form.apiKey}
            onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
            placeholder={status?.hasApiKey ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' : 'Checkr API key'}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="webhookSecret">Webhook Secret {status?.hasWebhookSecret && <span className="text-xs text-muted-foreground">(stored — enter to replace)</span>}</Label>
          <Input
            id="webhookSecret"
            type="password"
            autoComplete="off"
            value={form.webhookSecret}
            onChange={(e) => setForm({ ...form, webhookSecret: e.target.value })}
            placeholder={status?.hasWebhookSecret ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' : 'Checkr webhook signing secret'}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="defaultNode">Default Node (optional — for multi-location Checkr accounts)</Label>
          <Input
            id="defaultNode"
            value={form.defaultNode}
            onChange={(e) => setForm({ ...form, defaultNode: e.target.value })}
          />
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : status?.configured ? 'Update Credentials' : 'Save Credentials'}
          </Button>
          {status?.configured && (
            <Button variant="outline" onClick={handleClear} disabled={saving}>
              Clear Credentials
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
