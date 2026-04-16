'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

interface PublicFormRendererProps {
  formId: string;
  tpaOrgId: string;
}

interface ApplicationForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dob: string;
  ssnLast4: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  position: string;
  cdlNumber: string;
  cdlState: string;
  cdlClass: string;
  notes: string;
}

const emptyForm: ApplicationForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  dob: '',
  ssnLast4: '',
  address: '',
  city: '',
  state: '',
  zip: '',
  position: '',
  cdlNumber: '',
  cdlState: '',
  cdlClass: '',
  notes: '',
};

export function PublicFormRenderer({ formId, tpaOrgId }: PublicFormRendererProps) {
  const { toast } = useToast();
  const [form, setForm] = useState<ApplicationForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (field: keyof ApplicationForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'First name and last name are required.',
        variant: 'destructive',
      });
      return;
    }

    if (!form.email.trim() || !form.phone.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Email and phone number are required.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/dqf/tickets/public/${formId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tpaOrgId,
          person: {
            firstName: form.firstName,
            lastName: form.lastName,
            email: form.email,
            phone: form.phone,
            dob: form.dob || undefined,
            ssnLast4: form.ssnLast4 || undefined,
          },
          address: form.address || undefined,
          city: form.city || undefined,
          state: form.state || undefined,
          zip: form.zip || undefined,
          position: form.position || undefined,
          cdlNumber: form.cdlNumber || undefined,
          cdlState: form.cdlState || undefined,
          cdlClass: form.cdlClass || undefined,
          notes: form.notes || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to submit application');
      }

      setSubmitted(true);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to submit application',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <Card className="p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <svg
            className="h-6 w-6 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold mb-2">Application Submitted Successfully</h3>
        <p className="text-muted-foreground">
          Thank you for your application. You will be contacted shortly.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Personal Information */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Personal Information</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                value={form.firstName}
                onChange={(e) => handleChange('firstName', e.target.value)}
                placeholder="First name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                value={form.lastName}
                onChange={(e) => handleChange('lastName', e.target.value)}
                placeholder="Last name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="driver@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone *</Label>
              <Input
                id="phone"
                type="tel"
                value={form.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="(555) 555-5555"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dob">Date of Birth</Label>
              <Input
                id="dob"
                type="date"
                value={form.dob}
                onChange={(e) => handleChange('dob', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ssnLast4">SSN (Last 4)</Label>
              <Input
                id="ssnLast4"
                value={form.ssnLast4}
                onChange={(e) => handleChange('ssnLast4', e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="1234"
                maxLength={4}
              />
            </div>
          </div>
        </div>

        {/* Address */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Address</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="address">Street Address</Label>
              <Input
                id="address"
                value={form.address}
                onChange={(e) => handleChange('address', e.target.value)}
                placeholder="123 Main St"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={form.city}
                onChange={(e) => handleChange('city', e.target.value)}
                placeholder="City"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                value={form.state}
                onChange={(e) => handleChange('state', e.target.value.toUpperCase().slice(0, 2))}
                placeholder="TX"
                maxLength={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zip">ZIP Code</Label>
              <Input
                id="zip"
                value={form.zip}
                onChange={(e) => handleChange('zip', e.target.value.replace(/\D/g, '').slice(0, 5))}
                placeholder="75001"
                maxLength={5}
              />
            </div>
          </div>
        </div>

        {/* Position & CDL Information */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Position &amp; CDL Information</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="position">Position</Label>
              <Input
                id="position"
                value={form.position}
                onChange={(e) => handleChange('position', e.target.value)}
                placeholder="e.g. OTR Driver, Local Delivery"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cdlNumber">CDL Number</Label>
              <Input
                id="cdlNumber"
                value={form.cdlNumber}
                onChange={(e) => handleChange('cdlNumber', e.target.value)}
                placeholder="CDL number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cdlState">CDL State</Label>
              <Input
                id="cdlState"
                value={form.cdlState}
                onChange={(e) => handleChange('cdlState', e.target.value.toUpperCase().slice(0, 2))}
                placeholder="TX"
                maxLength={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cdlClass">CDL Class</Label>
              <Input
                id="cdlClass"
                value={form.cdlClass}
                onChange={(e) => handleChange('cdlClass', e.target.value.toUpperCase())}
                placeholder="A, B, or C"
              />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">Additional Notes</Label>
          <textarea
            id="notes"
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            value={form.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            placeholder="Any additional information..."
          />
        </div>

        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Application'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
