'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface BackgroundCheck {
  id: string;
  status: string;
  externalId: string | null;
  externalCandidateId: string | null;
  candidateInviteUrl: string | null;
  hostedReportUrl: string | null;
  summaryJson: { consideredScreens?: string[]; adjudication?: string } | null;
  submittedAt: string | null;
  completedAt: string | null;
  canceledAt: string | null;
  notes: string | null;
  internalNotes?: string | null;
  person?: { id: string; firstName: string; lastName: string; email: string; phone?: string };
  clientOrg?: { id: string; name: string } | null;
  package?: { id: string; name: string; providerPackageSlug: string; retailPriceCents: number; description?: string | null };
  charges?: Array<{ id: string; amountCents: number; lineItemDescription: string; invoiceId: string | null }>;
}

const STATUS_COLORS: Record<string, string> = {
  clear: 'bg-green-100 text-green-800',
  consider: 'bg-amber-100 text-amber-800',
  suspended: 'bg-red-100 text-red-800',
  dispute: 'bg-red-100 text-red-800',
  pending: 'bg-blue-100 text-blue-800',
  processing: 'bg-blue-100 text-blue-800',
  canceled: 'bg-gray-100 text-gray-800',
  expired: 'bg-gray-100 text-gray-800',
};

function formatDateTime(d: string | null | undefined): string {
  if (!d) return '-';
  try {
    return new Date(d).toLocaleString();
  } catch {
    return '-';
  }
}

export interface CheckDetailProps {
  checkId: string;
  userRole: string;
  basePath?: string;
}

export function CheckDetail({ checkId, userRole, basePath = '/api/background/checks' }: CheckDetailProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [check, setCheck] = useState<BackgroundCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');

  const isTpaUser = userRole.startsWith('tpa_') || userRole === 'platform_admin';
  const canManage = isTpaUser && userRole !== 'tpa_records' && userRole !== 'tpa_billing';

  const fetchCheck = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${basePath}/${checkId}`);
      if (!res.ok) {
        setCheck(null);
        return;
      }
      const data = await res.json();
      setCheck(data.check);
      setNotes(data.check.notes ?? '');
      setInternalNotes(data.check.internalNotes ?? '');
    } finally {
      setLoading(false);
    }
  }, [checkId, basePath]);

  useEffect(() => {
    fetchCheck();
  }, [fetchCheck]);

  const handleCancel = async () => {
    if (!confirm('Cancel this background check? It cannot be undone.')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/background/checks/${checkId}/cancel`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.errorMessage || err.error || 'Failed to cancel');
      }
      toast({ title: 'Check canceled' });
      fetchCheck();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const handleRefresh = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/background/checks/${checkId}/refresh`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.errorMessage || err.error || 'Failed to refresh');
      }
      const data = await res.json();
      toast({ title: data.changed ? 'Status updated' : 'No change' });
      fetchCheck();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const handleSaveNotes = async () => {
    setBusy(true);
    try {
      const body: Record<string, unknown> = { notes };
      if (isTpaUser) body.internalNotes = internalNotes;
      const res = await fetch(`/api/background/checks/${checkId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save');
      }
      toast({ title: 'Notes saved' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const copyInvite = () => {
    if (!check?.candidateInviteUrl) return;
    navigator.clipboard.writeText(check.candidateInviteUrl);
    toast({ title: 'Candidate URL copied' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }
  if (!check) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground">Background check not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          Back
        </Button>
      </Card>
    );
  }

  const isPending = check.status === 'pending';
  const isProcessing = check.status === 'processing';
  const isTerminal = ['canceled', 'expired'].includes(check.status);
  const isCompleted = ['clear', 'consider', 'suspended', 'dispute'].includes(check.status);

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold">
              {check.person ? `${check.person.firstName} ${check.person.lastName}` : 'Unknown candidate'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {check.person?.email}
              {check.person?.phone ? ` \u00b7 ${check.person.phone}` : ''}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Badge className={STATUS_COLORS[check.status] ?? ''}>
                {check.status.replace(/_/g, ' ')}
              </Badge>
              {check.package && <span className="text-sm text-muted-foreground">{check.package.name}</span>}
              {check.clientOrg && <span className="text-sm text-muted-foreground">\u00b7 {check.clientOrg.name}</span>}
            </div>
          </div>
          <div className="flex gap-2">
            {canManage && !isTerminal && !isCompleted && (
              <Button variant="outline" onClick={handleRefresh} disabled={busy}>
                Refresh Status
              </Button>
            )}
            {canManage && !isTerminal && !isCompleted && (
              <Button variant="destructive" onClick={handleCancel} disabled={busy}>
                Cancel Check
              </Button>
            )}
            {canManage && isCompleted && (
              <Button variant="outline" onClick={handleRefresh} disabled={busy}>
                Refresh
              </Button>
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <h3 className="mb-3 font-semibold">Report Details</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">External Report ID</dt>
              <dd className="font-mono">{check.externalId ?? '-'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Candidate ID</dt>
              <dd className="font-mono">{check.externalCandidateId ?? '-'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Submitted</dt>
              <dd>{formatDateTime(check.submittedAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Completed</dt>
              <dd>{formatDateTime(check.completedAt)}</dd>
            </div>
            {check.canceledAt && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Canceled</dt>
                <dd>{formatDateTime(check.canceledAt)}</dd>
              </div>
            )}
          </dl>
        </Card>

        <Card className="p-6">
          <h3 className="mb-3 font-semibold">Package</h3>
          {check.package ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Name</dt>
                <dd>{check.package.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Slug</dt>
                <dd className="font-mono">{check.package.providerPackageSlug}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Price</dt>
                <dd>${(check.package.retailPriceCents / 100).toFixed(2)}</dd>
              </div>
              {check.package.description && (
                <div className="pt-2 text-muted-foreground">{check.package.description}</div>
              )}
            </dl>
          ) : (
            <p className="text-muted-foreground">No package info</p>
          )}
        </Card>
      </div>

      {isPending && check.candidateInviteUrl && (
        <Card className="p-6">
          <h3 className="mb-2 font-semibold">Candidate Invitation</h3>
          <p className="mb-3 text-sm text-muted-foreground">
            The candidate has been invited to complete their background check via Checkr\u2019s hosted form.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-xs">{check.candidateInviteUrl}</code>
            <Button variant="outline" size="sm" onClick={copyInvite}>
              Copy URL
            </Button>
            <a href={check.candidateInviteUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">Open</Button>
            </a>
          </div>
        </Card>
      )}

      {isProcessing && (
        <Card className="p-6">
          <div className="flex items-center gap-2">
            <LoadingSpinner size="sm" />
            <p className="text-sm text-muted-foreground">Checkr is running the report. We will receive an update automatically.</p>
          </div>
        </Card>
      )}

      {isCompleted && check.hostedReportUrl && (
        <Card className="p-6">
          <h3 className="mb-3 font-semibold">Checkr Report</h3>
          {check.summaryJson && (
            <div className="mb-3 space-y-1 text-sm">
              {check.summaryJson.consideredScreens && check.summaryJson.consideredScreens.length > 0 && (
                <p>
                  <strong>Considered screens:</strong>{' '}
                  {check.summaryJson.consideredScreens.join(', ')}
                </p>
              )}
              {check.summaryJson.adjudication && (
                <p>
                  <strong>Adjudication:</strong> {check.summaryJson.adjudication.replace(/_/g, ' ')}
                </p>
              )}
            </div>
          )}
          <div className="rounded-lg border bg-muted/40">
            <iframe
              src={check.hostedReportUrl}
              className="h-[600px] w-full rounded-lg"
              title="Checkr Report"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            />
          </div>
        </Card>
      )}

      {isTerminal && (
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">
            This check is {check.status}. It is read-only.
          </p>
        </Card>
      )}

      <Card className="p-6">
        <h3 className="mb-3 font-semibold">Notes</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {isTpaUser && (
            <div className="space-y-2">
              <Label htmlFor="internalNotes">Internal Notes (never shown to clients)</Label>
              <Textarea
                id="internalNotes"
                rows={3}
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
              />
            </div>
          )}
          <Button onClick={handleSaveNotes} disabled={busy}>
            Save Notes
          </Button>
        </div>
      </Card>

      {isTpaUser && check.charges && check.charges.length > 0 && (
        <Card className="p-6">
          <h3 className="mb-3 font-semibold">Charges</h3>
          <ul className="space-y-2 text-sm">
            {check.charges.map((c) => (
              <li key={c.id} className="flex items-center justify-between">
                <span>{c.lineItemDescription}</span>
                <span className="font-mono">
                  ${(c.amountCents / 100).toFixed(2)} {c.invoiceId ? '(billed)' : '(pending)'}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
