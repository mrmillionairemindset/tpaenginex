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

interface BatTest {
  id: string;
  testDate: string;
  status: string;
  screeningResult: string | null;
  confirmationResult: string | null;
  deviceMake: string | null;
  deviceSerial: string | null;
  reasonForTest: string | null;
  person?: { id: string; firstName: string; lastName: string };
}

const statusColors: Record<string, string> = {
  negative: 'bg-green-100 text-green-800',
  positive: 'bg-red-100 text-red-800',
  refused: 'bg-red-100 text-red-800',
  invalid: 'bg-gray-100 text-gray-800',
  pending: 'bg-yellow-100 text-yellow-800',
};

export function BatTestsTable() {
  const { toast } = useToast();
  const [rows, setRows] = useState<BatTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    personId: '',
    deviceMake: '',
    deviceSerial: '',
    screeningResult: '',
    status: 'pending',
    reasonForTest: 'random',
  });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/occ/bat-tests');
      if (res.ok) {
        const data = await res.json();
        setRows(data.batTests || []);
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
      const res = await fetch('/api/occ/bat-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personId: form.personId.trim(),
          deviceMake: form.deviceMake.trim() || undefined,
          deviceSerial: form.deviceSerial.trim() || undefined,
          screeningResult: form.screeningResult.trim() || undefined,
          status: form.status,
          reasonForTest: form.reasonForTest,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed');
      }
      toast({ title: 'BAT test recorded' });
      setDialogOpen(false);
      setForm({ personId: '', deviceMake: '', deviceSerial: '', screeningResult: '', status: 'pending', reasonForTest: 'random' });
      fetchData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      header: 'Tested',
      accessor: (r: BatTest) => new Date(r.testDate).toLocaleDateString(),
    },
    {
      header: 'Person',
      accessor: (r: BatTest) => r.person ? `${r.person.firstName} ${r.person.lastName}` : '—',
    },
    {
      header: 'Reason',
      accessor: (r: BatTest) => r.reasonForTest || '—',
    },
    {
      header: 'Screening',
      accessor: (r: BatTest) => r.screeningResult || '—',
    },
    {
      header: 'Confirmation',
      accessor: (r: BatTest) => r.confirmationResult || '—',
    },
    {
      header: 'Device',
      accessor: (r: BatTest) => [r.deviceMake, r.deviceSerial].filter(Boolean).join(' ') || '—',
    },
    {
      header: 'Status',
      accessor: (r: BatTest) => <Badge className={statusColors[r.status] ?? ''}>{r.status}</Badge>,
    },
  ];

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Record BAT Test
        </Button>
      </div>

      <DataTable
        data={rows}
        columns={columns}
        loading={loading}
        emptyMessage="No BAT tests recorded yet."
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Record BAT Test</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Person ID</Label>
              <Input value={form.personId} onChange={(e) => setForm({ ...form, personId: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Device Make</Label>
                <Input value={form.deviceMake} onChange={(e) => setForm({ ...form, deviceMake: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Device Serial</Label>
                <Input value={form.deviceSerial} onChange={(e) => setForm({ ...form, deviceSerial: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Screening Result</Label>
                <Input placeholder="0.020" value={form.screeningResult} onChange={(e) => setForm({ ...form, screeningResult: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="negative">Negative</SelectItem>
                    <SelectItem value="positive">Positive</SelectItem>
                    <SelectItem value="refused">Refused</SelectItem>
                    <SelectItem value="invalid">Invalid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Reason</Label>
              <Select value={form.reasonForTest} onValueChange={(v) => setForm({ ...form, reasonForTest: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pre_employment">Pre-Employment</SelectItem>
                  <SelectItem value="random">Random</SelectItem>
                  <SelectItem value="post_accident">Post-Accident</SelectItem>
                  <SelectItem value="reasonable_suspicion">Reasonable Suspicion</SelectItem>
                  <SelectItem value="return_to_duty">Return to Duty</SelectItem>
                  <SelectItem value="follow_up">Follow-Up</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
