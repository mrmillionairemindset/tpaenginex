'use client';

import { useCallback, useEffect, useState } from 'react';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Plus } from 'lucide-react';

interface FitTest {
  id: string;
  testType: string;
  passed: boolean;
  testedAt: string;
  respiratorMake: string | null;
  respiratorModel: string | null;
  respiratorSize: string | null;
  fitFactor: number | null;
  nextTestDueBy: string | null;
  person?: { id: string; firstName: string; lastName: string };
}

export function FitTestsTable() {
  const { toast } = useToast();
  const [rows, setRows] = useState<FitTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    personId: '',
    testType: 'qualitative',
    respiratorMake: '',
    respiratorModel: '',
    respiratorSize: 'M',
    fitFactor: '',
    passed: true,
    nextTestDueBy: '',
  });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/occ/fit-tests');
      if (res.ok) {
        const data = await res.json();
        setRows(data.fitTests || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const submit = async () => {
    if (!form.personId.trim()) {
      toast({ title: 'Person ID required', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        personId: form.personId.trim(),
        testType: form.testType,
        passed: form.passed,
      };
      if (form.respiratorMake.trim()) body.respiratorMake = form.respiratorMake.trim();
      if (form.respiratorModel.trim()) body.respiratorModel = form.respiratorModel.trim();
      if (form.respiratorSize.trim()) body.respiratorSize = form.respiratorSize.trim();
      if (form.fitFactor.trim()) body.fitFactor = Number(form.fitFactor);
      if (form.nextTestDueBy) body.nextTestDueBy = new Date(form.nextTestDueBy).toISOString();

      const res = await fetch('/api/occ/fit-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed');
      }
      toast({ title: 'Fit test recorded' });
      setDialogOpen(false);
      setForm({ personId: '', testType: 'qualitative', respiratorMake: '', respiratorModel: '', respiratorSize: 'M', fitFactor: '', passed: true, nextTestDueBy: '' });
      fetchData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { header: 'Tested', accessor: (r: FitTest) => new Date(r.testedAt).toLocaleDateString() },
    { header: 'Person', accessor: (r: FitTest) => r.person ? `${r.person.firstName} ${r.person.lastName}` : '—' },
    { header: 'Type', accessor: (r: FitTest) => r.testType },
    { header: 'Respirator', accessor: (r: FitTest) => [r.respiratorMake, r.respiratorModel, r.respiratorSize].filter(Boolean).join(' ') || '—' },
    { header: 'Fit Factor', accessor: (r: FitTest) => r.fitFactor != null ? String(r.fitFactor) : '—' },
    { header: 'Result', accessor: (r: FitTest) => <Badge className={r.passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>{r.passed ? 'Pass' : 'Fail'}</Badge> },
    { header: 'Next Due', accessor: (r: FitTest) => r.nextTestDueBy ? new Date(r.nextTestDueBy).toLocaleDateString() : '—' },
  ];

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Record Fit Test
        </Button>
      </div>

      <DataTable
        data={rows}
        columns={columns}
        loading={loading}
        emptyMessage="No fit tests recorded yet."
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Record Fit Test</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Person ID</Label>
              <Input value={form.personId} onChange={(e) => setForm({ ...form, personId: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Test Type</Label>
                <Select value={form.testType} onValueChange={(v) => setForm({ ...form, testType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="qualitative">Qualitative</SelectItem>
                    <SelectItem value="quantitative">Quantitative</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Respirator Size</Label>
                <Select value={form.respiratorSize} onValueChange={(v) => setForm({ ...form, respiratorSize: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="S">Small</SelectItem>
                    <SelectItem value="M">Medium</SelectItem>
                    <SelectItem value="L">Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Make</Label>
                <Input value={form.respiratorMake} onChange={(e) => setForm({ ...form, respiratorMake: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Model</Label>
                <Input value={form.respiratorModel} onChange={(e) => setForm({ ...form, respiratorModel: e.target.value })} />
              </div>
            </div>
            {form.testType === 'quantitative' && (
              <div className="space-y-1">
                <Label>Fit Factor</Label>
                <Input type="number" value={form.fitFactor} onChange={(e) => setForm({ ...form, fitFactor: e.target.value })} />
              </div>
            )}
            <div className="space-y-1">
              <Label>Next Test Due</Label>
              <Input type="date" value={form.nextTestDueBy} onChange={(e) => setForm({ ...form, nextTestDueBy: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.passed} onChange={(e) => setForm({ ...form, passed: e.target.checked })} />
              Test passed
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={submit} disabled={submitting}>{submitting ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
