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

export function ReportIncidentForm() {
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
    clientOrgId: '',
    incidentDate: '',
    location: '',
    jobAtIncident: '',
    bodyPartsAffected: '', // comma-separated
    injuryType: 'sprain',
    severity: 'medical',
    description: '',
    workersCompClaimNumber: '',
    workersCompCarrier: '',
    notes: '',
    internalNotes: '',
  });

  const change = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.incidentDate) {
      toast({ title: 'Incident date is required', variant: 'destructive' });
      return;
    }
    if (!form.location.trim()) {
      toast({ title: 'Location is required', variant: 'destructive' });
      return;
    }
    if (!form.description.trim()) {
      toast({ title: 'Description is required', variant: 'destructive' });
      return;
    }
    if (personMode === 'existing' && !form.personId.trim()) {
      toast({ title: 'Person ID required', variant: 'destructive' });
      return;
    }
    if (personMode === 'new' && (!form.firstName.trim() || !form.lastName.trim())) {
      toast({ title: 'First and last name are required', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        incidentDate: new Date(form.incidentDate).toISOString(),
        location: form.location.trim(),
        jobAtIncident: form.jobAtIncident.trim() || undefined,
        bodyPartsAffected: form.bodyPartsAffected
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        injuryType: form.injuryType,
        severity: form.severity,
        description: form.description.trim(),
        workersCompClaimNumber: form.workersCompClaimNumber.trim() || undefined,
        workersCompCarrier: form.workersCompCarrier.trim() || undefined,
        notes: form.notes.trim() || undefined,
        internalNotes: form.internalNotes.trim() || undefined,
      };
      if (form.clientOrgId.trim()) body.clientOrgId = form.clientOrgId.trim();

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

      const res = await fetch('/api/injury/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to record incident');
      }
      const data = await res.json();
      toast({ title: 'Incident recorded', description: data.incident?.incidentNumber });
      router.push(`/injury/incidents/${data.incident.id}`);
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to record incident',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="max-w-3xl p-6">
      <div className="space-y-4">
        <div>
          <Label>Injured Worker</Label>
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
              onChange={(e) => change('personId', e.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
            />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={form.firstName}
                  onChange={(e) => change('firstName', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={form.lastName}
                  onChange={(e) => change('lastName', e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dob">Date of Birth</Label>
                <Input
                  id="dob"
                  placeholder="MM/DD/YYYY"
                  value={form.dob}
                  onChange={(e) => change('dob', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => change('email', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => change('phone', e.target.value)}
                />
              </div>
            </div>
          </>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="incidentDate">Incident Date & Time *</Label>
            <Input
              id="incidentDate"
              type="datetime-local"
              value={form.incidentDate}
              onChange={(e) => change('incidentDate', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clientOrgId">Client Org ID (optional)</Label>
            <Input
              id="clientOrgId"
              value={form.clientOrgId}
              onChange={(e) => change('clientOrgId', e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="location">Where did it happen? *</Label>
          <Input
            id="location"
            value={form.location}
            onChange={(e) => change('location', e.target.value)}
            placeholder="123 Main Street warehouse — Bay 4"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="jobAtIncident">Job at time of incident</Label>
            <Input
              id="jobAtIncident"
              value={form.jobAtIncident}
              onChange={(e) => change('jobAtIncident', e.target.value)}
              placeholder="Forklift operator"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bodyParts">Body parts affected</Label>
            <Input
              id="bodyParts"
              value={form.bodyPartsAffected}
              onChange={(e) => change('bodyPartsAffected', e.target.value)}
              placeholder="back, right shoulder (comma separated)"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="injuryType">Injury Type</Label>
            <Select value={form.injuryType} onValueChange={(v) => change('injuryType', v)}>
              <SelectTrigger id="injuryType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sprain">Sprain / Strain</SelectItem>
                <SelectItem value="laceration">Laceration</SelectItem>
                <SelectItem value="burn">Burn</SelectItem>
                <SelectItem value="fracture">Fracture</SelectItem>
                <SelectItem value="concussion">Concussion</SelectItem>
                <SelectItem value="amputation">Amputation</SelectItem>
                <SelectItem value="repetitive_strain">Repetitive Strain</SelectItem>
                <SelectItem value="puncture">Puncture</SelectItem>
                <SelectItem value="crush">Crush</SelectItem>
                <SelectItem value="chemical_exposure">Chemical Exposure</SelectItem>
                <SelectItem value="hearing_loss">Hearing Loss</SelectItem>
                <SelectItem value="skin_disorder">Skin Disorder</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="severity">Severity</Label>
            <Select value={form.severity} onValueChange={(v) => change('severity', v)}>
              <SelectTrigger id="severity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="first_aid">First Aid (not OSHA recordable)</SelectItem>
                <SelectItem value="medical">Medical Treatment</SelectItem>
                <SelectItem value="lost_time">Lost Time / Days Away</SelectItem>
                <SelectItem value="restricted_duty">Restricted Duty / Transfer</SelectItem>
                <SelectItem value="fatality">Fatality</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description of injury *</Label>
          <Textarea
            id="description"
            rows={4}
            value={form.description}
            onChange={(e) => change('description', e.target.value)}
            placeholder="Describe what happened, how the injury occurred, and what the worker was doing at the time."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="wcClaim">Workers Comp Claim #</Label>
            <Input
              id="wcClaim"
              value={form.workersCompClaimNumber}
              onChange={(e) => change('workersCompClaimNumber', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wcCarrier">Workers Comp Carrier</Label>
            <Input
              id="wcCarrier"
              value={form.workersCompCarrier}
              onChange={(e) => change('workersCompCarrier', e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes (visible to client)</Label>
          <Textarea
            id="notes"
            rows={2}
            value={form.notes}
            onChange={(e) => change('notes', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="internalNotes">Internal Notes (TPA only)</Label>
          <Textarea
            id="internalNotes"
            rows={2}
            value={form.internalNotes}
            onChange={(e) => change('internalNotes', e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => router.back()} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Recording...' : 'Record Incident'}
          </Button>
        </div>
      </div>
    </Card>
  );
}
