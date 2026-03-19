'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { format } from 'date-fns';

type LeadStage =
  | 'new_lead'
  | 'outreach_sent'
  | 'proposal_sent'
  | 'follow_up'
  | 'contract_sent'
  | 'closed_won'
  | 'closed_lost';

interface Lead {
  id: string;
  companyName: string;
  contactName: string;
  stage: LeadStage;
  estimatedValueCents: number;
  lastContactedAt: string | null;
  nextFollowUpAt: string | null;
  owner: string | null;
}

const stageStyles: Record<LeadStage, { className: string; label: string }> = {
  new_lead: { className: 'bg-muted text-foreground', label: 'New Lead' },
  outreach_sent: { className: 'bg-primary/10 text-primary', label: 'Outreach Sent' },
  proposal_sent: { className: 'bg-accent/10 text-accent', label: 'Proposal Sent' },
  follow_up: { className: 'bg-amber-100 text-amber-800', label: 'Follow Up' },
  contract_sent: { className: 'bg-cyan-100 text-cyan-800', label: 'Contract Sent' },
  closed_won: { className: 'bg-green-100 text-green-800', label: 'Closed Won' },
  closed_lost: { className: 'bg-red-100 text-red-800', label: 'Closed Lost' },
};

function formatCentsToDollars(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

export function LeadsTable() {
  const router = useRouter();
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    companyName: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    estimatedValueCents: '',
  });

  const fetchLeads = async () => {
    try {
      const response = await fetch('/api/leads');
      if (response.ok) {
        const data = await response.json();
        setLeads(data.leads || []);
      }
    } catch (error) {
      console.error('Failed to fetch leads:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: formData.companyName,
          contactName: formData.contactName,
          contactEmail: formData.contactEmail || undefined,
          contactPhone: formData.contactPhone || undefined,
          estimatedValueCents: formData.estimatedValueCents
            ? Math.round(parseFloat(formData.estimatedValueCents) * 100)
            : undefined,
        }),
      });

      if (response.ok) {
        toast({
          title: 'Lead Created',
          description: `${formData.companyName} has been added to the pipeline`,
        });
        setShowAddDialog(false);
        setFormData({
          companyName: '',
          contactName: '',
          contactEmail: '',
          contactPhone: '',
          estimatedValueCents: '',
        });
        fetchLeads();
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to create lead',
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
      setSubmitting(false);
    }
  };

  const columns = [
    {
      header: 'Company',
      accessor: 'companyName' as const,
    },
    {
      header: 'Contact',
      accessor: 'contactName' as const,
    },
    {
      header: 'Stage',
      accessor: (lead: Lead) => {
        const style = stageStyles[lead.stage];
        return (
          <Badge className={`${style.className} font-medium`} variant="secondary">
            {style.label}
          </Badge>
        );
      },
    },
    {
      header: 'Est. Value',
      accessor: (lead: Lead) =>
        lead.estimatedValueCents
          ? formatCentsToDollars(lead.estimatedValueCents)
          : '-',
    },
    {
      header: 'Last Contacted',
      accessor: (lead: Lead) =>
        lead.lastContactedAt
          ? format(new Date(lead.lastContactedAt), 'MMM d, yyyy')
          : '-',
    },
    {
      header: 'Next Follow-up',
      accessor: (lead: Lead) =>
        lead.nextFollowUpAt
          ? format(new Date(lead.nextFollowUpAt), 'MMM d, yyyy')
          : '-',
    },
    {
      header: 'Owner',
      accessor: (lead: Lead) => lead.owner || '-',
    },
  ];

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Lead
        </Button>
      </div>

      <DataTable
        data={leads}
        columns={columns}
        loading={loading}
        emptyMessage="No leads found. Add your first lead to get started."
        onRowClick={(lead) => router.push(`/leads/${lead.id}`)}
      />

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Lead</DialogTitle>
            <DialogDescription>
              Enter the details for the new prospective client.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddLead}>
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="companyName">
                  Company Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="companyName"
                  required
                  value={formData.companyName}
                  onChange={(e) =>
                    setFormData({ ...formData, companyName: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="contactName">
                  Contact Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="contactName"
                  required
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
                  placeholder="0.00"
                  value={formData.estimatedValueCents}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      estimatedValueCents: e.target.value,
                    })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddDialog(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Creating...' : 'Add Lead'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
