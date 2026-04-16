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
import { Copy, Plus, Trash2, Shield, CheckCircle2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface SsoConnection {
  id: string;
  name: string;
  provider: string;
  jitProvisioningEnabled: boolean;
  defaultRoleForJit: string | null;
  allowedEmailDomains: string[];
  defaultRedirectUrl: string | null;
  isActive: boolean;
  lastVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  acsUrl: string;
  spEntityId: string;
  loginUrl: string;
}

const ROLES: Array<{ value: string; label: string }> = [
  { value: 'tpa_staff', label: 'TPA Staff' },
  { value: 'tpa_records', label: 'TPA Records' },
  { value: 'tpa_admin', label: 'TPA Admin' },
  { value: 'tpa_billing', label: 'TPA Billing' },
  { value: 'client_admin', label: 'Client Admin' },
];

function CopyField({ label, value }: { label: string; value: string }) {
  const { toast } = useToast();
  return (
    <div>
      <Label className="text-xs text-muted-foreground uppercase tracking-wide">{label}</Label>
      <div className="mt-1 flex items-center gap-2">
        <code className="flex-1 overflow-x-auto rounded bg-muted px-2 py-1.5 text-xs font-mono">
          {value}
        </code>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            navigator.clipboard.writeText(value);
            toast({ title: 'Copied' });
          }}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function SsoSettings() {
  const { toast } = useToast();
  const [connections, setConnections] = useState<SsoConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Create form state
  const [formName, setFormName] = useState('');
  const [formMetaXml, setFormMetaXml] = useState('');
  const [formMetaUrl, setFormMetaUrl] = useState('');
  const [formJit, setFormJit] = useState(true);
  const [formJitRole, setFormJitRole] = useState('tpa_staff');
  const [formDomains, setFormDomains] = useState('');
  const [formRedirect, setFormRedirect] = useState('');
  const [formActive, setFormActive] = useState(true);

  async function fetchConnections() {
    setLoading(true);
    try {
      const res = await fetch('/api/sso/connections');
      if (res.ok) {
        const data = await res.json();
        setConnections(data.connections);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchConnections();
  }, []);

  function resetForm() {
    setFormName('');
    setFormMetaXml('');
    setFormMetaUrl('');
    setFormJit(true);
    setFormJitRole('tpa_staff');
    setFormDomains('');
    setFormRedirect('');
    setFormActive(true);
  }

  async function handleMetaFile(file: File) {
    const text = await file.text();
    setFormMetaXml(text);
  }

  async function createConnection() {
    if (!formName.trim()) {
      toast({ title: 'Connection name required', variant: 'destructive' });
      return;
    }
    if (!formMetaXml.trim() && !formMetaUrl.trim()) {
      toast({ title: 'IdP metadata XML or URL required', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      const domains = formDomains
        .split(',')
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean);
      const body: Record<string, unknown> = {
        name: formName.trim(),
        provider: 'saml',
        jitProvisioningEnabled: formJit,
        defaultRoleForJit: formJitRole,
        allowedEmailDomains: domains,
        isActive: formActive,
      };
      if (formMetaXml.trim()) body.idpMetadataXml = formMetaXml.trim();
      if (formMetaUrl.trim()) body.idpMetadataUrl = formMetaUrl.trim();
      if (formRedirect.trim()) body.defaultRedirectUrl = formRedirect.trim();

      const res = await fetch('/api/sso/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast({ title: 'SSO connection created' });
        setCreateOpen(false);
        resetForm();
        await fetchConnections();
      } else {
        const err = await res.json().catch(() => ({}));
        toast({
          title: 'Failed to create connection',
          description: err.detail || err.error || 'Unknown error',
          variant: 'destructive',
        });
      }
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(c: SsoConnection) {
    const res = await fetch(`/api/sso/connections/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !c.isActive }),
    });
    if (res.ok) await fetchConnections();
  }

  async function testConnection(c: SsoConnection) {
    const res = await fetch(`/api/sso/connections/${c.id}/test`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      toast({ title: 'Connection verified', description: 'Metadata is valid and registered.' });
      await fetchConnections();
    } else {
      toast({
        title: 'Test failed',
        description: data.error || 'Unknown error',
        variant: 'destructive',
      });
    }
  }

  async function deleteConnection(c: SsoConnection) {
    if (!confirm(`Delete SSO connection "${c.name}"? Users will no longer be able to sign in through this IdP.`)) {
      return;
    }
    const res = await fetch(`/api/sso/connections/${c.id}`, { method: 'DELETE' });
    if (res.ok) {
      toast({ title: 'Connection deleted' });
      await fetchConnections();
    }
  }

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {connections.length} SSO connection{connections.length === 1 ? '' : 's'} configured
        </p>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add SSO Connection
        </Button>
      </div>

      {connections.length === 0 ? (
        <Card className="p-8 text-center">
          <Shield className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <h3 className="mb-1 text-lg font-semibold">No SSO connections yet</h3>
          <p className="text-sm text-muted-foreground">
            Add a SAML 2.0 connection to let your users sign in through Okta, Azure AD, Google Workspace, or any other IdP.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {connections.map((c) => (
            <Card key={c.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">{c.name}</h3>
                    <Badge variant="secondary" className="uppercase text-xs">{c.provider}</Badge>
                    {c.isActive ? (
                      <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        <CheckCircle2 className="mr-1 h-3 w-3" /> Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                        Inactive
                      </Badge>
                    )}
                    {c.lastVerifiedAt ? (
                      <span className="text-xs text-muted-foreground">
                        Verified {format(new Date(c.lastVerifiedAt), 'MMM d, yyyy')}
                      </span>
                    ) : (
                      <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> Never tested
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    JIT: {c.jitProvisioningEnabled ? `enabled → ${c.defaultRoleForJit}` : 'disabled'}
                    {c.allowedEmailDomains.length > 0 && (
                      <> · Domains: {c.allowedEmailDomains.join(', ')}</>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="outline" onClick={() => testConnection(c)}>
                    Test
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => toggleActive(c)}>
                    {c.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => deleteConnection(c)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="mt-4 space-y-3 border-t pt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Service Provider coordinates (give these to your IdP admin)
                </p>
                <CopyField label="ACS (Reply) URL" value={c.acsUrl} />
                <CopyField label="SP Entity ID / Audience" value={c.spEntityId} />
                <CopyField label="Direct login URL" value={c.loginUrl} />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ==================== Create Dialog ==================== */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add SSO Connection</DialogTitle>
            <DialogDescription>
              Register a SAML 2.0 identity provider for your organization.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="sso-name">Connection name</Label>
              <Input
                id="sso-name"
                placeholder="e.g. Okta Production"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="sso-meta-file">IdP metadata XML</Label>
              <input
                id="sso-meta-file"
                type="file"
                accept=".xml,text/xml,application/xml"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleMetaFile(f);
                }}
                className="mt-1 block w-full text-sm file:mr-3 file:rounded file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-muted"
              />
              <Textarea
                className="mt-2 font-mono text-xs"
                rows={4}
                placeholder="<?xml version=&quot;1.0&quot;?><EntityDescriptor ..."
                value={formMetaXml}
                onChange={(e) => setFormMetaXml(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Or provide a metadata URL below — one of these two is required.
              </p>
            </div>

            <div>
              <Label htmlFor="sso-meta-url">IdP metadata URL (alternative)</Label>
              <Input
                id="sso-meta-url"
                type="url"
                placeholder="https://idp.example.com/metadata.xml"
                value={formMetaUrl}
                onChange={(e) => setFormMetaUrl(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="sso-jit">JIT Provisioning</Label>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    id="sso-jit"
                    type="checkbox"
                    checked={formJit}
                    onChange={(e) => setFormJit(e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                  <label htmlFor="sso-jit" className="text-sm">
                    Auto-create users on first login
                  </label>
                </div>
              </div>
              <div>
                <Label htmlFor="sso-jit-role">Default role for new users</Label>
                <select
                  id="sso-jit-role"
                  value={formJitRole}
                  onChange={(e) => setFormJitRole(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  disabled={!formJit}
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="sso-domains">Allowed email domains (comma-separated)</Label>
              <Input
                id="sso-domains"
                placeholder="company.com, company.co"
                value={formDomains}
                onChange={(e) => setFormDomains(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Only users with an email at these domains can sign in. Leave blank to accept any email from the IdP.
              </p>
            </div>

            <div>
              <Label htmlFor="sso-redirect">Default redirect URL after sign-in (optional)</Label>
              <Input
                id="sso-redirect"
                type="url"
                placeholder="https://app.example.com/dashboard"
                value={formRedirect}
                onChange={(e) => setFormRedirect(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="sso-active"
                type="checkbox"
                checked={formActive}
                onChange={(e) => setFormActive(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <label htmlFor="sso-active" className="text-sm">
                Activate immediately
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createConnection} disabled={creating}>
              {creating ? 'Creating…' : 'Create Connection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
