'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';

interface Package {
  id: string;
  name: string;
  providerPackageSlug: string;
  retailPriceCents: number;
  isActive: boolean;
}

interface Client {
  id: string;
  name: string;
}

export function CreateCheckForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [personMode, setPersonMode] = useState<'existing' | 'new'>('new');

  const [packages, setPackages] = useState<Package[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  const [form, setForm] = useState({
    personId: '',
    firstName: '',
    lastName: '',
    middleName: '',
    dob: '',
    email: '',
    phone: '',
    zipcode: '',
    driverLicenseNumber: '',
    driverLicenseState: '',
    ssn: '',
    packageId: '',
    clientOrgId: '',
    notes: '',
  });

  useEffect(() => {
    (async () => {
      try {
        const [pkgRes, clientRes] = await Promise.all([
          fetch('/api/background/packages'),
          fetch('/api/clients'),
        ]);
        if (pkgRes.ok) {
          const data = await pkgRes.json();
          setPackages(data.packages || []);
        }
        if (clientRes.ok) {
          const data = await clientRes.json();
          setClients(data.clients || []);
        }
      } catch (err) {
        console.error('[create-check-form] fetch refs failed:', err);
      }
    })();
  }, []);

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!form.packageId) {
      toast({ title: 'Validation error', description: 'Package is required.', variant: 'destructive' });
      return;
    }
    if (personMode === 'existing' && !form.personId.trim()) {
      toast({ title: 'Validation error', description: 'Person ID required.', variant: 'destructive' });
      return;
    }
    if (personMode === 'new') {
      if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim() || !form.dob.trim()) {
        toast({
          title: 'Validation error',
          description: 'First name, last name, DOB (YYYY-MM-DD), and email are required.',
          variant: 'destructive',
        });
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(form.dob.trim())) {
        toast({ title: 'Validation error', description: 'DOB must be YYYY-MM-DD.', variant: 'destructive' });
        return;
      }
    }

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        packageId: form.packageId,
      };
      if (form.clientOrgId) body.clientOrgId = form.clientOrgId;
      if (form.notes.trim()) body.notes = form.notes.trim();

      if (personMode === 'existing') {
        body.personId = form.personId.trim();
      } else {
        body.person = {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          middleName: form.middleName.trim() || undefined,
          dob: form.dob.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          ssn: form.ssn.trim() || undefined,
          zipcode: form.zipcode.trim() || undefined,
          driverLicenseNumber: form.driverLicenseNumber.trim() || undefined,
          driverLicenseState: form.driverLicenseState.trim().toUpperCase() || undefined,
        };
      }

      const res = await fetch('/api/background/checks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.errorMessage || err.error || 'Failed to create check');
      }
      const data = await res.json();
      toast({ title: 'Background check created', description: 'Candidate invite sent.' });
      router.push(`/background/checks/${data.check.id}`);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to create check', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="max-w-2xl p-6">
      <div className="space-y-4">
        <div>
          <Label>Candidate</Label>
          <div className="mt-1 flex gap-2">
            <Button
              type="button"
              variant={personMode === 'new' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPersonMode('new')}
            >
              New Person
            </Button>
            <Button
              type="button"
              variant={personMode === 'existing' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPersonMode('existing')}
            >
              Existing Person
            </Button>
          </div>
        </div>

        {personMode === 'existing' ? (
          <div className="space-y-2">
            <Label htmlFor="personId">Person ID (UUID)</Label>
            <Input id="personId" value={form.personId} onChange={(e) => handleChange('personId', e.target.value)} />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input id="firstName" value={form.firstName} onChange={(e) => handleChange('firstName', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="middleName">Middle Name</Label>
                <Input id="middleName" value={form.middleName} onChange={(e) => handleChange('middleName', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input id="lastName" value={form.lastName} onChange={(e) => handleChange('lastName', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dob">DOB (YYYY-MM-DD) *</Label>
                <Input id="dob" placeholder="1985-01-15" value={form.dob} onChange={(e) => handleChange('dob', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" value={form.email} onChange={(e) => handleChange('email', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={form.phone} onChange={(e) => handleChange('phone', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="zipcode">Zipcode</Label>
                <Input id="zipcode" value={form.zipcode} onChange={(e) => handleChange('zipcode', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="driverLicenseNumber">DL Number</Label>
                <Input id="driverLicenseNumber" value={form.driverLicenseNumber} onChange={(e) => handleChange('driverLicenseNumber', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="driverLicenseState">DL State</Label>
                <Input id="driverLicenseState" maxLength={2} value={form.driverLicenseState} onChange={(e) => handleChange('driverLicenseState', e.target.value.toUpperCase())} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ssn">SSN (optional — used by Checkr if provided)</Label>
              <Input id="ssn" value={form.ssn} onChange={(e) => handleChange('ssn', e.target.value)} />
            </div>
          </>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="packageId">Package *</Label>
            <Select value={form.packageId} onValueChange={(v) => handleChange('packageId', v)}>
              <SelectTrigger id="packageId">
                <SelectValue placeholder="Select a package" />
              </SelectTrigger>
              <SelectContent>
                {packages.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — ${(p.retailPriceCents / 100).toFixed(2)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="clientOrgId">Client (optional)</Label>
            <Select
              value={form.clientOrgId || '__none__'}
              onValueChange={(v) => handleChange('clientOrgId', v === '__none__' ? '' : v)}
            >
              <SelectTrigger id="clientOrgId">
                <SelectValue placeholder="No client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No client</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" value={form.notes} onChange={(e) => handleChange('notes', e.target.value)} rows={3} />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => router.back()} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Check'}
          </Button>
        </div>
      </div>
    </Card>
  );
}
