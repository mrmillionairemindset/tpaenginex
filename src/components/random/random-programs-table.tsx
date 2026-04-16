'use client';

import { useEffect, useState, useCallback } from 'react';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/use-toast';
import { Plus } from 'lucide-react';

interface Program {
  id: string;
  name: string;
  programType: 'dot' | 'non_dot' | 'consortium';
  drugTestRate: number; // basis points
  alcoholTestRate: number;
  periodType: 'monthly' | 'quarterly' | 'semiannual' | 'annual';
  isActive: boolean;
  poolCount: number;
  clientOrg?: { id: string; name: string } | null;
}

const typeBadge = (t: Program['programType']) => {
  const map = {
    dot: { label: 'DOT', className: 'border-transparent bg-blue-100 text-blue-800' },
    non_dot: { label: 'Non-DOT', className: 'border-transparent bg-gray-100 text-gray-800' },
    consortium: { label: 'Consortium', className: 'border-transparent bg-purple-100 text-purple-800' },
  };
  const cfg = map[t];
  return <Badge className={cfg.className}>{cfg.label}</Badge>;
};

interface FormState {
  name: string;
  programType: 'dot' | 'non_dot' | 'consortium';
  clientOrgId: string;
  drugRatePercent: string;
  alcoholRatePercent: string;
  periodType: 'monthly' | 'quarterly' | 'semiannual' | 'annual';
  notes: string;
}

const emptyForm: FormState = {
  name: '',
  programType: 'dot',
  clientOrgId: '',
  drugRatePercent: '50',
  alcoholRatePercent: '10',
  periodType: 'quarterly',
  notes: '',
};

export function RandomProgramsTable() {
  const router = useRouter();
  const { toast } = useToast();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const fetchPrograms = useCallback(async () => {
    try {
      const res = await fetch('/api/random/programs');
      if (res.ok) {
        const data = await res.json();
        setPrograms(data.programs || []);
      }
    } catch (err) {
      console.error('Failed to load programs', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrograms();
  }, [fetchPrograms]);

  const submit = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    const drug = parseFloat(form.drugRatePercent);
    const alcohol = parseFloat(form.alcoholRatePercent);
    if (Number.isNaN(drug) || Number.isNaN(alcohol)) {
      toast({ title: 'Rates must be numbers', variant: 'destructive' });
      return;
    }
    if (drug < 0 || drug > 200 || alcohol < 0 || alcohol > 200) {
      toast({ title: 'Rates must be 0-200%', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/random/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          programType: form.programType,
          clientOrgId: form.clientOrgId.trim() || undefined,
          drugTestRateBp: Math.round(drug * 100),
          alcoholTestRateBp: Math.round(alcohol * 100),
          periodType: form.periodType,
          notes: form.notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create program');
      }
      toast({ title: 'Program created' });
      setDialogOpen(false);
      setForm(emptyForm);
      fetchPrograms();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to create program',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (program: Program) => {
    try {
      const res = await fetch(`/api/random/programs/${program.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !program.isActive }),
      });
      if (!res.ok) throw new Error('Failed');
      fetchPrograms();
    } catch {
      toast({ title: 'Failed to toggle', variant: 'destructive' });
    }
  };

  const columns = [
    {
      header: 'Name',
      accessor: (p: Program) => <span className="font-medium">{p.name}</span>,
    },
    { header: 'Type', accessor: (p: Program) => typeBadge(p.programType) },
    { header: 'Client', accessor: (p: Program) => p.clientOrg?.name || 'All' },
    {
      header: 'Drug Rate',
      accessor: (p: Program) => `${(p.drugTestRate / 100).toFixed(1)}%`,
    },
    {
      header: 'Alcohol Rate',
      accessor: (p: Program) => `${(p.alcoholTestRate / 100).toFixed(1)}%`,
    },
    {
      header: 'Period',
      accessor: (p: Program) =>
        p.periodType.charAt(0).toUpperCase() + p.periodType.slice(1),
    },
    { header: 'Pools', accessor: (p: Program) => String(p.poolCount) },
    {
      header: 'Status',
      accessor: (p: Program) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleActive(p);
          }}
          className="cursor-pointer"
        >
          <Badge
            className={
              p.isActive
                ? 'border-transparent bg-green-100 text-green-800'
                : 'border-transparent bg-gray-200 text-gray-600'
            }
          >
            {p.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </button>
      ),
    },
  ];

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Program
        </Button>
      </div>

      <DataTable
        data={programs}
        columns={columns}
        loading={loading}
        emptyMessage="No random programs yet. Click 'New Program' to create one."
        onRowClick={(p) => router.push(`/random/programs/${p.id}`)}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>New Random Program</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Program Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="ACME Corp — DOT Random Pool"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Program Type *</Label>
                <Select
                  value={form.programType}
                  onValueChange={(v: any) => setForm({ ...form, programType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dot">DOT (FMCSA)</SelectItem>
                    <SelectItem value="non_dot">Non-DOT</SelectItem>
                    <SelectItem value="consortium">Consortium</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Period Type *</Label>
                <Select
                  value={form.periodType}
                  onValueChange={(v: any) => setForm({ ...form, periodType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="semiannual">Semiannual</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="drug">Annual Drug Rate (%)</Label>
                <Input
                  id="drug"
                  type="number"
                  min="0"
                  max="200"
                  step="0.01"
                  value={form.drugRatePercent}
                  onChange={(e) =>
                    setForm({ ...form, drugRatePercent: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  DOT FMCSA minimum: 50%
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="alcohol">Annual Alcohol Rate (%)</Label>
                <Input
                  id="alcohol"
                  type="number"
                  min="0"
                  max="200"
                  step="0.01"
                  value={form.alcoholRatePercent}
                  onChange={(e) =>
                    setForm({ ...form, alcoholRatePercent: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  DOT FMCSA minimum: 10%
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="clientOrgId">Client Org ID (optional)</Label>
              <Input
                id="clientOrgId"
                value={form.clientOrgId}
                onChange={(e) => setForm({ ...form, clientOrgId: e.target.value })}
                placeholder="Leave blank for consortium / multi-client"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Optional"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Program'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
