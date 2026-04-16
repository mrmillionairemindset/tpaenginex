'use client';

import { useCallback, useEffect, useState } from 'react';
import { DataTable } from '@/components/ui/data-table';
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
import { useToast } from '@/components/ui/use-toast';
import { Plus } from 'lucide-react';

interface Vaccination {
  id: string;
  vaccineType: string;
  manufacturer: string | null;
  lotNumber: string | null;
  administeredAt: string;
  doseNumber: number | null;
  expiresAt: string | null;
  person?: { id: string; firstName: string; lastName: string };
}

export function VaccinationsTable() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Vaccination[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    personId: '',
    vaccineType: '',
    manufacturer: '',
    lotNumber: '',
    doseNumber: '',
    expiresAt: '',
  });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/occ/vaccinations');
      if (res.ok) {
        const data = await res.json();
        setRows(data.vaccinations || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const submit = async () => {
    if (!form.personId.trim() || !form.vaccineType.trim()) {
      toast({ title: 'Person ID and vaccine type are required', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        personId: form.personId.trim(),
        vaccineType: form.vaccineType.trim(),
      };
      if (form.manufacturer.trim()) body.manufacturer = form.manufacturer.trim();
      if (form.lotNumber.trim()) body.lotNumber = form.lotNumber.trim();
      if (form.doseNumber.trim()) body.doseNumber = Number(form.doseNumber);
      if (form.expiresAt) body.expiresAt = new Date(form.expiresAt).toISOString();

      const res = await fetch('/api/occ/vaccinations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed');
      }
      toast({ title: 'Vaccination recorded' });
      setDialogOpen(false);
      setForm({ personId: '', vaccineType: '', manufacturer: '', lotNumber: '', doseNumber: '', expiresAt: '' });
      fetchData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { header: 'Administered', accessor: (r: Vaccination) => new Date(r.administeredAt).toLocaleDateString() },
    { header: 'Person', accessor: (r: Vaccination) => r.person ? `${r.person.firstName} ${r.person.lastName}` : '—' },
    { header: 'Vaccine', accessor: (r: Vaccination) => r.vaccineType },
    { header: 'Manufacturer', accessor: (r: Vaccination) => r.manufacturer || '—' },
    { header: 'Lot #', accessor: (r: Vaccination) => r.lotNumber || '—' },
    { header: 'Dose #', accessor: (r: Vaccination) => r.doseNumber ? String(r.doseNumber) : '—' },
    { header: 'Expires', accessor: (r: Vaccination) => r.expiresAt ? new Date(r.expiresAt).toLocaleDateString() : '—' },
  ];

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Record Vaccination
        </Button>
      </div>

      <DataTable
        data={rows}
        columns={columns}
        loading={loading}
        emptyMessage="No vaccinations recorded yet."
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Record Vaccination</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Person ID</Label>
              <Input value={form.personId} onChange={(e) => setForm({ ...form, personId: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Vaccine Type</Label>
              <Input placeholder="hepatitis_b_1 / tdap / mmr / etc." value={form.vaccineType} onChange={(e) => setForm({ ...form, vaccineType: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Manufacturer</Label>
                <Input value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Lot Number</Label>
                <Input value={form.lotNumber} onChange={(e) => setForm({ ...form, lotNumber: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Dose Number</Label>
                <Input type="number" min={1} max={20} value={form.doseNumber} onChange={(e) => setForm({ ...form, doseNumber: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Expires (optional)</Label>
                <Input type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
              </div>
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
