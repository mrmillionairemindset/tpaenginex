'use client';

import { useEffect, useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, Plus } from 'lucide-react';
import { format } from 'date-fns';

interface Program {
  id: string;
  name: string;
  programType: string;
  drugTestRate: number;
  alcoholTestRate: number;
  periodType: string;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  clientOrg?: { id: string; name: string } | null;
}

interface Pool {
  id: string;
  periodStartsAt: string;
  periodEndsAt: string;
  status: 'open' | 'selected' | 'closed';
  totalEligible: number;
  totalSelectedDrug: number;
  totalSelectedAlcohol: number;
  selectedAt: string | null;
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

export function RandomProgramDetail({ programId }: { programId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [program, setProgram] = useState<Program | null>(null);
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPoolOpen, setNewPoolOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ periodStartsAt: '', periodEndsAt: '' });

  const load = async () => {
    try {
      const res = await fetch(`/api/random/programs/${programId}`);
      if (!res.ok) {
        setProgram(null);
        return;
      }
      const data = await res.json();
      setProgram(data.program);
      setPools(data.pools || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [programId]);

  const createPool = async () => {
    if (!form.periodStartsAt || !form.periodEndsAt) {
      toast({
        title: 'Both dates required',
        variant: 'destructive',
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/random/pools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          programId,
          periodStartsAt: new Date(form.periodStartsAt).toISOString(),
          periodEndsAt: new Date(form.periodEndsAt).toISOString(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create pool');
      }
      toast({ title: 'Pool created' });
      setNewPoolOpen(false);
      setForm({ periodStartsAt: '', periodEndsAt: '' });
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

  if (!program) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Program not found.</p>
        <Link href="/random/programs" className="text-sm underline">
          Back to programs
        </Link>
      </div>
    );
  }

  const poolColumns = [
    {
      header: 'Period',
      accessor: (p: Pool) =>
        `${format(new Date(p.periodStartsAt), 'MMM d, yyyy')} - ${format(new Date(p.periodEndsAt), 'MMM d, yyyy')}`,
    },
    { header: 'Status', accessor: (p: Pool) => poolStatusBadge(p.status) },
    { header: 'Eligible', accessor: (p: Pool) => String(p.totalEligible) },
    { header: 'Drug', accessor: (p: Pool) => String(p.totalSelectedDrug) },
    { header: 'Alcohol', accessor: (p: Pool) => String(p.totalSelectedAlcohol) },
    {
      header: 'Selected At',
      accessor: (p: Pool) =>
        p.selectedAt ? format(new Date(p.selectedAt), 'MMM d, yyyy') : '—',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/random/programs')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>

      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{program.name}</h1>
            <div className="mt-2 flex gap-2">
              <Badge className="border-transparent bg-blue-100 text-blue-800">
                {program.programType.toUpperCase()}
              </Badge>
              <Badge
                className={
                  program.isActive
                    ? 'border-transparent bg-green-100 text-green-800'
                    : 'border-transparent bg-gray-200 text-gray-600'
                }
              >
                {program.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-6 md:grid-cols-4">
          <div>
            <div className="text-xs text-muted-foreground">Drug Rate (Annual)</div>
            <div className="text-xl font-semibold">
              {(program.drugTestRate / 100).toFixed(2)}%
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Alcohol Rate (Annual)</div>
            <div className="text-xl font-semibold">
              {(program.alcoholTestRate / 100).toFixed(2)}%
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Period</div>
            <div className="text-xl font-semibold capitalize">{program.periodType}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Client</div>
            <div className="text-xl font-semibold">
              {program.clientOrg?.name || 'All'}
            </div>
          </div>
        </div>

        {program.notes && (
          <div className="mt-6">
            <div className="text-xs text-muted-foreground">Notes</div>
            <div className="text-sm mt-1">{program.notes}</div>
          </div>
        )}
      </Card>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Selection Pools</h2>
          <Button onClick={() => setNewPoolOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Pool
          </Button>
        </div>
        <DataTable
          data={pools}
          columns={poolColumns}
          emptyMessage="No pools yet. Create a pool to begin random selection for a period."
          onRowClick={(p) => router.push(`/random/pools/${p.id}`)}
        />
      </div>

      <Dialog open={newPoolOpen} onOpenChange={setNewPoolOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Pool Period</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="start">Period Starts</Label>
              <Input
                id="start"
                type="date"
                value={form.periodStartsAt}
                onChange={(e) =>
                  setForm({ ...form, periodStartsAt: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end">Period Ends</Label>
              <Input
                id="end"
                type="date"
                value={form.periodEndsAt}
                onChange={(e) => setForm({ ...form, periodEndsAt: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNewPoolOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={createPool} disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Pool'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
