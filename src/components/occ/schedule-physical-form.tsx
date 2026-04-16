'use client';

import { useState } from 'react';
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

export function SchedulePhysicalForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [personMode, setPersonMode] = useState<'existing' | 'new'>('new');

  const [form, setForm] = useState({
    personId: '',
    firstName: '',
    lastName: '',
    dob: '',
    email: '',
    phone: '',
    examType: 'dot',
    scheduledFor: '',
    clientOrgId: '',
    notes: '',
  });

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (personMode === 'existing' && !form.personId.trim()) {
      toast({
        title: 'Validation error',
        description: 'Person ID is required when selecting an existing person.',
        variant: 'destructive',
      });
      return;
    }
    if (personMode === 'new' && (!form.firstName.trim() || !form.lastName.trim())) {
      toast({
        title: 'Validation error',
        description: 'First name and last name are required.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        examType: form.examType,
      };
      if (form.scheduledFor) body.scheduledFor = new Date(form.scheduledFor).toISOString();
      if (form.clientOrgId.trim()) body.clientOrgId = form.clientOrgId.trim();
      if (form.notes.trim()) body.notes = form.notes.trim();

      if (personMode === 'existing') {
        body.personId = form.personId.trim();
      } else {
        body.person = {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          dob: form.dob.trim() || undefined,
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
        };
      }

      const res = await fetch('/api/occ/physicals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to schedule exam');
      }
      const data = await res.json();
      toast({ title: 'Physical exam scheduled', description: 'Exam created.' });
      router.push(`/occ/physicals/${data.exam.id}`);
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to schedule exam',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="max-w-2xl p-6">
      <div className="space-y-4">
        <div>
          <Label>Patient</Label>
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
            <Input
              id="personId"
              value={form.personId}
              onChange={(e) => handleChange('personId', e.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
            />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input id="firstName" value={form.firstName} onChange={(e) => handleChange('firstName', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input id="lastName" value={form.lastName} onChange={(e) => handleChange('lastName', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dob">Date of Birth</Label>
                <Input id="dob" placeholder="MM/DD/YYYY" value={form.dob} onChange={(e) => handleChange('dob', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={form.email} onChange={(e) => handleChange('email', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={form.phone} onChange={(e) => handleChange('phone', e.target.value)} />
              </div>
            </div>
          </>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="examType">Exam Type</Label>
            <Select value={form.examType} onValueChange={(v) => handleChange('examType', v)}>
              <SelectTrigger id="examType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dot">DOT</SelectItem>
                <SelectItem value="non_dot">Non-DOT</SelectItem>
                <SelectItem value="pre_employment">Pre-Employment</SelectItem>
                <SelectItem value="return_to_duty">Return to Duty</SelectItem>
                <SelectItem value="follow_up">Follow-Up</SelectItem>
                <SelectItem value="annual">Annual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="scheduledFor">Scheduled Date</Label>
            <Input
              id="scheduledFor"
              type="datetime-local"
              value={form.scheduledFor}
              onChange={(e) => handleChange('scheduledFor', e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="clientOrgId">Client Org ID (optional)</Label>
          <Input
            id="clientOrgId"
            value={form.clientOrgId}
            onChange={(e) => handleChange('clientOrgId', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={form.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            rows={3}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => router.back()} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Scheduling...' : 'Schedule Exam'}
          </Button>
        </div>
      </div>
    </Card>
  );
}
