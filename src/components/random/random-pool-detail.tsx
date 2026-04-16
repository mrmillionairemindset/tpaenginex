'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { DataTable } from '@/components/ui/data-table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, Download, Shuffle, UserX, Mail, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface Pool {
  id: string;
  programId: string;
  periodStartsAt: string;
  periodEndsAt: string;
  status: 'open' | 'selected' | 'closed';
  totalEligible: number;
  totalSelectedDrug: number;
  totalSelectedAlcohol: number;
  selectedAt: string | null;
  selectionSeedHash: string | null;
  program: {
    id: string;
    name: string;
    programType: string;
    drugTestRate: number;
    alcoholTestRate: number;
    periodType: string;
  };
  selectedByUser?: { name: string | null; email: string } | null;
}

interface Member {
  id: string;
  personId: string;
  eligibilityStatus: 'active' | 'excluded';
  excludeReason: string | null;
  person: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface Selection {
  id: string;
  selectionType: 'drug' | 'alcohol' | 'both';
  notifiedAt: string | null;
  scheduledAt: string | null;
  completedAt: string | null;
  orderId: string | null;
  person: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

// periodsPerYear inline: avoid server import
function periodsPerYear(pt: string): number {
  return pt === 'monthly' ? 12 : pt === 'quarterly' ? 4 : pt === 'semiannual' ? 2 : 1;
}

function calcCount(poolSize: number, rateBp: number, ppy: number): number {
  if (poolSize <= 0 || rateBp <= 0) return 0;
  return Math.ceil((poolSize * rateBp) / (10000 * ppy));
}

const poolStatusBadge = (s: Pool['status']) => {
  const map: Record<string, { label: string; className: string }> = {
    open: { label: 'Open', className: 'border-transparent bg-blue-100 text-blue-800' },
    selected: {
      label: 'Selected',
      className: 'border-transparent bg-green-100 text-green-800',
    },
    closed: {
      label: 'Closed',
      className: 'border-transparent bg-gray-200 text-gray-700',
    },
  };
  const cfg = map[s];
  return <Badge className={cfg.className}>{cfg.label}</Badge>;
};

const selectionTypeBadge = (t: Selection['selectionType']) => {
  const map = {
    drug: { label: 'Drug', className: 'border-transparent bg-blue-100 text-blue-800' },
    alcohol: {
      label: 'Alcohol',
      className: 'border-transparent bg-orange-100 text-orange-800',
    },
    both: { label: 'Both', className: 'border-transparent bg-purple-100 text-purple-800' },
  };
  const cfg = map[t];
  return <Badge className={cfg.className}>{cfg.label}</Badge>;
};

export function RandomPoolDetail({ poolId }: { poolId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pool, setPool] = useState<Pool | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [selections, setSelections] = useState<Selection[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectOpen, setSelectOpen] = useState(false);
  const [excludeOpen, setExcludeOpen] = useState(false);
  const [excludeMember, setExcludeMember] = useState<Member | null>(null);
  const [excludeReason, setExcludeReason] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [addPersonIds, setAddPersonIds] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/random/pools/${poolId}`);
      if (!res.ok) {
        setPool(null);
        return;
      }
      const data = await res.json();
      setPool(data.pool);
      setMembers(data.members || []);
      setSelections(data.selections || []);
    } finally {
      setLoading(false);
    }
  }, [poolId]);

  useEffect(() => {
    load();
  }, [load]);

  const runSelection = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/random/pools/${poolId}/select`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Selection failed');
      }
      const data = await res.json();
      toast({
        title: 'Random selection complete',
        description: `${data.totalSelected} persons selected (${data.drugCount} drug, ${data.alcoholCount} alcohol).`,
      });
      setSelectOpen(false);
      load();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const doExclude = async () => {
    if (!excludeMember || !excludeReason.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/random/pools/${poolId}/exclude`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: excludeMember.id,
          reason: excludeReason.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed');
      }
      toast({ title: 'Member excluded' });
      setExcludeOpen(false);
      setExcludeMember(null);
      setExcludeReason('');
      load();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const doAddMembers = async () => {
    const ids = addPersonIds
      .split(/[\s,\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length === 0) {
      toast({ title: 'Provide at least one person ID', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/random/pools/${poolId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personIds: ids }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed');
      }
      const data = await res.json();
      toast({
        title: 'Members added',
        description: `${data.added} added, ${data.skipped} skipped.`,
      });
      setAddOpen(false);
      setAddPersonIds('');
      load();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const notifyAll = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/random/pools/${poolId}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportByDays: 3 }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed');
      }
      const data = await res.json();
      toast({
        title: 'Notifications sent',
        description: `${data.emailed} of ${data.notified} notified.`,
      });
      load();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!pool) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Pool not found.</p>
        <Link href="/random/pools" className="text-sm underline">
          Back to pools
        </Link>
      </div>
    );
  }

  const activeCount = members.filter((m) => m.eligibilityStatus === 'active').length;
  const ppy = periodsPerYear(pool.program.periodType);
  const projectedDrug = calcCount(activeCount, pool.program.drugTestRate, ppy);
  const projectedAlcohol = calcCount(activeCount, pool.program.alcoholTestRate, ppy);

  const memberColumns = [
    {
      header: 'Name',
      accessor: (m: Member) => (
        <span className="font-medium">
          {m.person.firstName} {m.person.lastName}
        </span>
      ),
    },
    { header: 'Email', accessor: (m: Member) => m.person.email || '—' },
    {
      header: 'Status',
      accessor: (m: Member) =>
        m.eligibilityStatus === 'active' ? (
          <Badge className="border-transparent bg-green-100 text-green-800">
            Eligible
          </Badge>
        ) : (
          <Badge className="border-transparent bg-gray-200 text-gray-700">
            Excluded
          </Badge>
        ),
    },
    {
      header: 'Reason',
      accessor: (m: Member) => m.excludeReason || '—',
    },
    {
      header: '',
      accessor: (m: Member) =>
        pool.status === 'open' && m.eligibilityStatus === 'active' ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setExcludeMember(m);
              setExcludeOpen(true);
            }}
          >
            <UserX className="h-4 w-4" />
          </Button>
        ) : null,
    },
  ];

  const selectionColumns = [
    {
      header: 'Person',
      accessor: (s: Selection) => (
        <span className="font-medium">
          {s.person.firstName} {s.person.lastName}
        </span>
      ),
    },
    { header: 'Type', accessor: (s: Selection) => selectionTypeBadge(s.selectionType) },
    {
      header: 'Notified',
      accessor: (s: Selection) =>
        s.notifiedAt ? format(new Date(s.notifiedAt), 'MMM d, h:mm a') : '—',
    },
    {
      header: 'Scheduled',
      accessor: (s: Selection) =>
        s.scheduledAt ? format(new Date(s.scheduledAt), 'MMM d, yyyy') : '—',
    },
    {
      header: 'Completed',
      accessor: (s: Selection) =>
        s.completedAt ? format(new Date(s.completedAt), 'MMM d, yyyy') : '—',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>

      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <Link
              href={`/random/programs/${pool.programId}`}
              className="text-sm text-muted-foreground hover:underline"
            >
              {pool.program.name}
            </Link>
            <h1 className="mt-1 text-2xl font-bold">
              {format(new Date(pool.periodStartsAt), 'MMM d, yyyy')} —{' '}
              {format(new Date(pool.periodEndsAt), 'MMM d, yyyy')}
            </h1>
            <div className="mt-2 flex gap-2">
              {poolStatusBadge(pool.status)}
              <Badge className="border-transparent bg-blue-100 text-blue-800">
                {pool.program.programType.toUpperCase()}
              </Badge>
              <Badge className="border-transparent bg-gray-100 text-gray-800 capitalize">
                {pool.program.periodType}
              </Badge>
            </div>
          </div>

          <div className="flex gap-2">
            {pool.status === 'open' && activeCount > 0 && (
              <Button onClick={() => setSelectOpen(true)}>
                <Shuffle className="mr-2 h-4 w-4" />
                Run Selection
              </Button>
            )}
            {pool.status !== 'open' && (
              <>
                <Button variant="outline" onClick={notifyAll} disabled={submitting}>
                  <Mail className="mr-2 h-4 w-4" />
                  Notify Selected
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    window.open(`/api/random/pools/${poolId}/report.pdf`, '_blank')
                  }
                >
                  <Download className="mr-2 h-4 w-4" />
                  Report
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-6 md:grid-cols-4">
          <div>
            <div className="text-xs text-muted-foreground">Eligible Members</div>
            <div className="text-2xl font-bold">{pool.totalEligible}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Drug Selected</div>
            <div className="text-2xl font-bold text-blue-700">
              {pool.totalSelectedDrug}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Alcohol Selected</div>
            <div className="text-2xl font-bold text-orange-700">
              {pool.totalSelectedAlcohol}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Rates (Annual)</div>
            <div className="text-sm font-medium">
              {(pool.program.drugTestRate / 100).toFixed(1)}% drug /{' '}
              {(pool.program.alcoholTestRate / 100).toFixed(1)}% alcohol
            </div>
          </div>
        </div>

        {pool.selectionSeedHash && (
          <div className="mt-6 rounded-md bg-muted p-3 text-xs">
            <div className="text-muted-foreground">Seed Hash (SHA-256 — audit evidence)</div>
            <div className="mt-1 font-mono break-all">{pool.selectionSeedHash}</div>
            {pool.selectedByUser && (
              <div className="mt-1 text-muted-foreground">
                Executed by {pool.selectedByUser.name || pool.selectedByUser.email}
                {pool.selectedAt && ` at ${format(new Date(pool.selectedAt), 'PPpp')}`}
              </div>
            )}
          </div>
        )}
      </Card>

      <Tabs defaultValue={pool.status === 'open' ? 'members' : 'selections'}>
        <TabsList>
          <TabsTrigger value="members">Members ({members.length})</TabsTrigger>
          <TabsTrigger value="selections">Selections ({selections.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="mt-4">
          {pool.status === 'open' && (
            <div className="mb-4 flex justify-end">
              <Button variant="outline" onClick={() => setAddOpen(true)}>
                Add Members
              </Button>
            </div>
          )}
          <DataTable
            data={members}
            columns={memberColumns}
            emptyMessage="No members in this pool yet."
          />
        </TabsContent>

        <TabsContent value="selections" className="mt-4">
          <DataTable
            data={selections}
            columns={selectionColumns}
            emptyMessage={
              pool.status === 'open'
                ? 'Selection has not been run for this pool.'
                : 'No selections recorded.'
            }
          />
        </TabsContent>
      </Tabs>

      {/* Run Selection Dialog */}
      <Dialog open={selectOpen} onOpenChange={setSelectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Random Selection</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3 text-sm">
            <p>
              This will run a cryptographically secure random selection on{' '}
              <strong>{activeCount}</strong> eligible members. The seed hash will be
              recorded for audit reproducibility.
            </p>
            <div className="rounded-md bg-muted p-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Drug tests:</span>
                <span className="font-semibold">{projectedDrug}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-muted-foreground">Alcohol tests:</span>
                <span className="font-semibold">{projectedAlcohol}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Once executed this cannot be undone. Selection count per period =
              ceil(poolSize × annualRate ÷ periodsPerYear).
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSelectOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={runSelection} disabled={submitting || activeCount === 0}>
              {submitting ? 'Running...' : 'Run Selection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Exclude Dialog */}
      <Dialog open={excludeOpen} onOpenChange={setExcludeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exclude Member</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3">
            {excludeMember && (
              <p className="text-sm">
                Excluding{' '}
                <strong>
                  {excludeMember.person.firstName} {excludeMember.person.lastName}
                </strong>
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="reason">Reason *</Label>
              <Textarea
                id="reason"
                value={excludeReason}
                onChange={(e) => setExcludeReason(e.target.value)}
                placeholder="E.g., Terminated, on FMLA leave, etc."
                maxLength={255}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setExcludeOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={doExclude}
              disabled={submitting || !excludeReason.trim()}
            >
              Exclude
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Members Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Members to Pool</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <Label htmlFor="personIds">Person IDs (one per line, or comma-separated)</Label>
            <Textarea
              id="personIds"
              value={addPersonIds}
              onChange={(e) => setAddPersonIds(e.target.value)}
              placeholder="UUIDs of persons in your TPA"
              rows={6}
            />
            <p className="text-xs text-muted-foreground">
              Duplicates are skipped. Only persons in your TPA will be added.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={doAddMembers} disabled={submitting}>
              {submitting ? 'Adding...' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
