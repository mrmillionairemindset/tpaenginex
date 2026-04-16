'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';

interface Package {
  id: string;
  name: string;
  description: string | null;
  providerPackageSlug: string;
  includesMvr: boolean;
  includesDrugTest: boolean;
  includesEmploymentVerification: boolean;
  includesEducationVerification: boolean;
  retailPriceCents: number;
  isActive: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  pkg: Package | null;
  onSaved: () => void;
}

const BLANK = {
  name: '',
  description: '',
  providerPackageSlug: '',
  includesMvr: false,
  includesDrugTest: false,
  includesEmploymentVerification: false,
  includesEducationVerification: false,
  retailPriceDollars: '',
};

export function PackageFormDialog({ open, onOpenChange, pkg, onSaved }: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState(BLANK);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (pkg) {
      setForm({
        name: pkg.name,
        description: pkg.description ?? '',
        providerPackageSlug: pkg.providerPackageSlug,
        includesMvr: pkg.includesMvr,
        includesDrugTest: pkg.includesDrugTest,
        includesEmploymentVerification: pkg.includesEmploymentVerification,
        includesEducationVerification: pkg.includesEducationVerification,
        retailPriceDollars: (pkg.retailPriceCents / 100).toFixed(2),
      });
    } else {
      setForm(BLANK);
    }
  }, [pkg, open]);

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.providerPackageSlug.trim()) {
      toast({ title: 'Validation error', description: 'Name and Checkr package slug required.', variant: 'destructive' });
      return;
    }
    const price = parseFloat(form.retailPriceDollars);
    if (!Number.isFinite(price) || price < 0) {
      toast({ title: 'Validation error', description: 'Price must be a non-negative number.', variant: 'destructive' });
      return;
    }
    const body = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      providerPackageSlug: form.providerPackageSlug.trim(),
      includesMvr: form.includesMvr,
      includesDrugTest: form.includesDrugTest,
      includesEmploymentVerification: form.includesEmploymentVerification,
      includesEducationVerification: form.includesEducationVerification,
      retailPriceCents: Math.round(price * 100),
    };
    setSubmitting(true);
    try {
      const url = pkg ? `/api/background/packages/${pkg.id}` : '/api/background/packages';
      const method = pkg ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save');
      }
      toast({ title: pkg ? 'Package updated' : 'Package created' });
      onSaved();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{pkg ? 'Edit Package' : 'New Package'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pkg-name">Name *</Label>
            <Input id="pkg-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pkg-desc">Description</Label>
            <Textarea
              id="pkg-desc"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pkg-slug">Checkr Package Slug *</Label>
              <Input
                id="pkg-slug"
                value={form.providerPackageSlug}
                onChange={(e) => setForm({ ...form, providerPackageSlug: e.target.value })}
                placeholder="tasker_standard"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pkg-price">Retail Price (USD) *</Label>
              <Input
                id="pkg-price"
                type="number"
                step="0.01"
                min="0"
                value={form.retailPriceDollars}
                onChange={(e) => setForm({ ...form, retailPriceDollars: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Includes</Label>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.includesMvr} onChange={(e) => setForm({ ...form, includesMvr: e.target.checked })} />
                MVR
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.includesDrugTest} onChange={(e) => setForm({ ...form, includesDrugTest: e.target.checked })} />
                Drug Test
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.includesEmploymentVerification} onChange={(e) => setForm({ ...form, includesEmploymentVerification: e.target.checked })} />
                Employment Verification
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.includesEducationVerification} onChange={(e) => setForm({ ...form, includesEducationVerification: e.target.checked })} />
                Education Verification
              </label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
