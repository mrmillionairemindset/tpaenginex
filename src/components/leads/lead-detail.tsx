'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Link from 'next/link';

type LeadStage =
  | 'new_lead'
  | 'outreach_sent'
  | 'proposal_sent'
  | 'follow_up'
  | 'contract_sent'
  | 'closed_won'
  | 'closed_lost';

const stageOptions: { value: LeadStage; label: string }[] = [
  { value: 'new_lead', label: 'New Lead' },
  { value: 'outreach_sent', label: 'Outreach Sent' },
  { value: 'proposal_sent', label: 'Proposal Sent' },
  { value: 'follow_up', label: 'Follow Up' },
  { value: 'contract_sent', label: 'Contract Sent' },
  { value: 'closed_won', label: 'Closed Won' },
  { value: 'closed_lost', label: 'Closed Lost' },
];

const stageStyles: Record<LeadStage, string> = {
  new_lead: 'bg-muted text-foreground',
  outreach_sent: 'bg-primary/10 text-primary',
  proposal_sent: 'bg-accent/10 text-accent',
  follow_up: 'bg-amber-100 text-amber-800',
  contract_sent: 'bg-cyan-100 text-cyan-800',
  closed_won: 'bg-green-100 text-green-800',
  closed_lost: 'bg-red-100 text-red-800',
};

interface Lead {
  id: string;
  companyName: string;
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  stage: LeadStage;
  estimatedValueCents: number;
  notes: string | null;
  owner: string | null;
  convertedToOrgId: string | null;
  lastContactedAt: string | null;
  nextFollowUpAt: string | null;
}

interface LeadDetailProps {
  leadId: string;
  userRole: string;
}

export function LeadDetail({ leadId, userRole }: LeadDetailProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [formData, setFormData] = useState({
    companyName: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    estimatedValueCents: '',
    notes: '',
    owner: '',
    nextFollowUpAt: '',
  });

  useEffect(() => {
    async function fetchLead() {
      try {
        const response = await fetch(`/api/leads/${leadId}`);
        if (response.ok) {
          const data = await response.json();
          const leadData = data.lead;
          setLead(leadData);
          setFormData({
            companyName: leadData.companyName || '',
            contactName: leadData.contactName || '',
            contactEmail: leadData.contactEmail || '',
            contactPhone: leadData.contactPhone || '',
            estimatedValueCents: leadData.estimatedValueCents
              ? (leadData.estimatedValueCents / 100).toFixed(2)
              : '',
            notes: leadData.notes || '',
            owner: leadData.owner || '',
            nextFollowUpAt: leadData.nextFollowUpAt
              ? leadData.nextFollowUpAt.split('T')[0]
              : '',
          });
        } else {
          toast({
            title: 'Error',
            description: 'Failed to load lead details',
            variant: 'destructive',
          });
        }
      } catch (error) {
        console.error('Failed to fetch lead:', error);
        toast({
          title: 'Error',
          description: 'An unexpected error occurred',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }

    fetchLead();
  }, [leadId, toast]);

  const handleSave = async () => {
    setSaving(true);

    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: formData.companyName,
          contactName: formData.contactName,
          contactEmail: formData.contactEmail || null,
          contactPhone: formData.contactPhone || null,
          estimatedValueCents: formData.estimatedValueCents
            ? Math.round(parseFloat(formData.estimatedValueCents) * 100)
            : 0,
          notes: formData.notes || null,
          owner: formData.owner || null,
          nextFollowUpAt: formData.nextFollowUpAt || null,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setLead(data.lead);
        toast({
          title: 'Lead Updated',
          description: 'Lead details have been saved',
        });
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to update lead',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleStageChange = async (newStage: LeadStage) => {
    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage }),
      });

      if (response.ok) {
        const data = await response.json();
        setLead(data.lead);
        toast({
          title: 'Stage Updated',
          description: `Lead moved to ${stageOptions.find((s) => s.value === newStage)?.label}`,
        });
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to update stage',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    }
  };

  const handleConvert = async () => {
    setConverting(true);

    try {
      const response = await fetch(`/api/leads/${leadId}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        setLead((prev) =>
          prev
            ? { ...prev, convertedToOrgId: data.orgId, stage: 'closed_won' as LeadStage }
            : null
        );
        toast({
          title: 'Lead Converted',
          description: 'Lead has been converted to a client organization',
        });
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to convert lead',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setConverting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="text-center py-12 text-muted-foreground">Lead not found.</div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold">{lead.companyName}</h2>
            <Badge
              className={`${stageStyles[lead.stage]} font-medium`}
              variant="secondary"
            >
              {stageOptions.find((s) => s.value === lead.stage)?.label}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {lead.stage !== 'closed_won' && !lead.convertedToOrgId && (
              <Button onClick={handleConvert} disabled={converting}>
                {converting ? 'Converting...' : 'Convert to Client'}
              </Button>
            )}
            {lead.convertedToOrgId && (
              <Link href={`/organizations/${lead.convertedToOrgId}`}>
                <Button variant="outline">View Client Org</Button>
              </Link>
            )}
          </div>
        </div>

        <div className="mb-6">
          <Label>Stage</Label>
          <Select value={lead.stage} onValueChange={(val) => handleStageChange(val as LeadStage)}>
            <SelectTrigger className="w-[240px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {stageOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="companyName">Company Name</Label>
            <Input
              id="companyName"
              value={formData.companyName}
              onChange={(e) =>
                setFormData({ ...formData, companyName: e.target.value })
              }
            />
          </div>
          <div>
            <Label htmlFor="contactName">Contact Name</Label>
            <Input
              id="contactName"
              value={formData.contactName}
              onChange={(e) =>
                setFormData({ ...formData, contactName: e.target.value })
              }
            />
          </div>
          <div>
            <Label htmlFor="contactEmail">Contact Email</Label>
            <Input
              id="contactEmail"
              type="email"
              value={formData.contactEmail}
              onChange={(e) =>
                setFormData({ ...formData, contactEmail: e.target.value })
              }
            />
          </div>
          <div>
            <Label htmlFor="contactPhone">Contact Phone</Label>
            <Input
              id="contactPhone"
              type="tel"
              value={formData.contactPhone}
              onChange={(e) =>
                setFormData({ ...formData, contactPhone: e.target.value })
              }
            />
          </div>
          <div>
            <Label htmlFor="estimatedValue">Estimated Value ($)</Label>
            <Input
              id="estimatedValue"
              type="number"
              step="0.01"
              min="0"
              value={formData.estimatedValueCents}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  estimatedValueCents: e.target.value,
                })
              }
            />
          </div>
          <div>
            <Label htmlFor="owner">Owner</Label>
            <Input
              id="owner"
              value={formData.owner}
              onChange={(e) =>
                setFormData({ ...formData, owner: e.target.value })
              }
            />
          </div>
          <div>
            <Label htmlFor="nextFollowUp">Next Follow-up</Label>
            <Input
              id="nextFollowUp"
              type="date"
              value={formData.nextFollowUpAt}
              onChange={(e) =>
                setFormData({ ...formData, nextFollowUpAt: e.target.value })
              }
            />
          </div>
        </div>

        <div className="mt-4">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            rows={4}
            value={formData.notes}
            onChange={(e) =>
              setFormData({ ...formData, notes: e.target.value })
            }
            placeholder="Add notes about this lead..."
          />
        </div>

        <div className="mt-6 flex gap-3">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
          <Button variant="outline" onClick={() => router.push('/leads')}>
            Back to Leads
          </Button>
        </div>
      </Card>
    </div>
  );
}
