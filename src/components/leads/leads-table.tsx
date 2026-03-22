'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { usePolling } from '@/hooks/use-polling';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  city: string | null;
  state: string | null;
  need: string | null;
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

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
  'DC',
];

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
    source: '',
    need: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    employeeCount: '',
  });

  const fetchLeads = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  usePolling(fetchLeads);

  const resetForm = () => {
    setFormData({
      companyName: '',
      contactName: '',
      contactEmail: '',
      contactPhone: '',
      source: '',
      need: '',
      address: '',
      city: '',
      state: '',
      zip: '',
      employeeCount: '',
    });
  };

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: formData.companyName,
          contactName: formData.contactName || undefined,
          contactEmail: formData.contactEmail || undefined,
          contactPhone: formData.contactPhone || undefined,
          source: formData.source || undefined,
          need: formData.need || undefined,
          address: formData.address || undefined,
          city: formData.city || undefined,
          state: formData.state || undefined,
          zip: formData.zip || undefined,
          employeeCount: formData.employeeCount
            ? parseInt(formData.employeeCount, 10)
            : undefined,
        }),
      });

      if (response.ok) {
        toast({
          title: 'Lead Created',
          description: `${formData.companyName} has been added to the pipeline`,
        });
        setShowAddDialog(false);
        resetForm();
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
      header: 'City / State',
      accessor: (lead: Lead) => {
        if (lead.city && lead.state) return `${lead.city}, ${lead.state}`;
        if (lead.city) return lead.city;
        if (lead.state) return lead.state;
        return '-';
      },
    },
    {
      header: 'Need',
      accessor: (lead: Lead) =>
        lead.need
          ? lead.need.length > 50
            ? lead.need.substring(0, 50) + '...'
            : lead.need
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
                <Label htmlFor="source">Source</Label>
                <Select
                  value={formData.source}
                  onValueChange={(val) =>
                    setFormData({ ...formData, source: val })
                  }
                >
                  <SelectTrigger id="source">
                    <SelectValue placeholder="Select source..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Referral">Referral</SelectItem>
                    <SelectItem value="Website">Website</SelectItem>
                    <SelectItem value="Cold Call">Cold Call</SelectItem>
                    <SelectItem value="Trade Show">Trade Show</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="need">Need</Label>
                <Textarea
                  id="need"
                  rows={3}
                  placeholder="e.g., Random drug testing program for 50 employees"
                  value={formData.need}
                  onChange={(e) =>
                    setFormData({ ...formData, need: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) =>
                      setFormData({ ...formData, city: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="state">State</Label>
                  <Select
                    value={formData.state}
                    onValueChange={(val) =>
                      setFormData({ ...formData, state: val })
                    }
                  >
                    <SelectTrigger id="state">
                      <SelectValue placeholder="ST" />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map((st) => (
                        <SelectItem key={st} value={st}>
                          {st}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="zip">ZIP</Label>
                  <Input
                    id="zip"
                    value={formData.zip}
                    onChange={(e) =>
                      setFormData({ ...formData, zip: e.target.value })
                    }
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="employeeCount">Employee Count</Label>
                <Input
                  id="employeeCount"
                  type="number"
                  min="0"
                  placeholder="Number of employees"
                  value={formData.employeeCount}
                  onChange={(e) =>
                    setFormData({ ...formData, employeeCount: e.target.value })
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
