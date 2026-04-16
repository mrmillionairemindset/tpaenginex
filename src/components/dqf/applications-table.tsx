'use client';

import { useEffect, useState, useCallback } from 'react';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useRouter } from 'next/navigation';
import { usePolling } from '@/hooks/use-polling';
import { useToast } from '@/components/ui/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Download, Loader2 } from 'lucide-react';

interface Application {
  id: string;
  status: string;
  position: string | null;
  cdlClass: string | null;
  cdlState: string | null;
  applicationDate: string;
  person?: { id: string; firstName: string; lastName: string };
  clientOrg?: { id: string; name: string } | null;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  submitted: {
    label: 'Submitted',
    className: 'border-transparent bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  },
  under_review: {
    label: 'Under Review',
    className: 'border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  },
  approved: {
    label: 'Approved',
    className: 'border-transparent bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  },
  rejected: {
    label: 'Rejected',
    className: 'border-transparent bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  },
  withdrawn: {
    label: 'Withdrawn',
    className: 'border-transparent bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  },
};

function getStatusBadge(status: string) {
  const config = statusConfig[status] || { label: status, className: '' };
  return <Badge className={config.className}>{config.label}</Badge>;
}

interface NewApplicationForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  clientOrgId: string;
  position: string;
  cdlNumber: string;
  cdlState: string;
  cdlClass: string;
}

const emptyForm: NewApplicationForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  clientOrgId: '',
  position: '',
  cdlNumber: '',
  cdlState: '',
  cdlClass: '',
};

const BULK_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'withdrawn', label: 'Withdrawn' },
];

interface ApplicationsTableProps {
  userRole?: string;
}

export function ApplicationsTable({ userRole }: ApplicationsTableProps = {}) {
  const router = useRouter();
  const { toast } = useToast();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<NewApplicationForm>(emptyForm);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<string>('');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  const canBulkUpdate =
    userRole === 'tpa_admin' ||
    userRole === 'tpa_staff' ||
    userRole === 'platform_admin' ||
    userRole === undefined;

  const handleBulkStatusUpdate = async () => {
    if (!bulkStatus || selectedIds.length === 0) return;
    setBulkSubmitting(true);
    try {
      const res = await fetch('/api/dqf/applications/bulk-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationIds: selectedIds,
          status: bulkStatus,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update applications');
      }
      const data = await res.json();
      toast({
        title: 'Applications updated',
        description: `${data.updated} application(s) updated.`,
      });
      setSelectedIds([]);
      setBulkStatus('');
      await fetchApplications();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to update applications',
        variant: 'destructive',
      });
    } finally {
      setBulkSubmitting(false);
    }
  };

  const fetchApplications = useCallback(async () => {
    try {
      const response = await fetch('/api/dqf/applications');
      if (response.ok) {
        const data = await response.json();
        setApplications(data.applications || []);
      }
    } catch (error) {
      console.error('Failed to fetch applications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  usePolling(fetchApplications);

  const handleChange = (field: keyof NewApplicationForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'First name and last name are required.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/dqf/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person: {
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            email: form.email.trim() || undefined,
            phone: form.phone.trim() || undefined,
          },
          clientOrgId: form.clientOrgId.trim() || undefined,
          position: form.position.trim() || undefined,
          cdlNumber: form.cdlNumber.trim() || undefined,
          cdlState: form.cdlState.trim() || undefined,
          cdlClass: form.cdlClass.trim() || undefined,
        }),
      });

      if (response.ok) {
        toast({
          title: 'Application Created',
          description: `Application for ${form.firstName} ${form.lastName} has been submitted.`,
        });
        setDialogOpen(false);
        setForm(emptyForm);
        fetchApplications();
      } else {
        const errorData = await response.json().catch(() => null);
        toast({
          title: 'Error',
          description: errorData?.error || 'Failed to create application.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to create application:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      header: 'Applicant',
      accessor: (app: Application) => (
        <span className="font-medium">
          {app.person ? `${app.person.firstName} ${app.person.lastName}` : 'Unknown'}
        </span>
      ),
    },
    {
      header: 'Client',
      accessor: (app: Application) => app.clientOrg?.name || '-',
    },
    {
      header: 'Position',
      accessor: (app: Application) => app.position || '-',
    },
    {
      header: 'CDL',
      accessor: (app: Application) => {
        if (!app.cdlClass && !app.cdlState) return '-';
        const parts = [app.cdlClass, app.cdlState].filter(Boolean);
        return parts.join(' / ');
      },
    },
    {
      header: 'Status',
      accessor: (app: Application) => getStatusBadge(app.status),
    },
    {
      header: 'Applied',
      accessor: (app: Application) =>
        new Date(app.applicationDate).toLocaleDateString(),
    },
  ];

  return (
    <>
      <div className="mb-4 flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => (window.location.href = '/api/dqf/applications/export')}
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Application
        </Button>
      </div>

      {canBulkUpdate && selectedIds.length > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-md border bg-muted/40 px-4 py-2">
          <span className="text-sm font-medium">
            ({selectedIds.length} selected)
          </span>
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
            Clear
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <Select value={bulkStatus} onValueChange={setBulkStatus}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Change status..." />
              </SelectTrigger>
              <SelectContent>
                {BULK_STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={handleBulkStatusUpdate}
              disabled={!bulkStatus || bulkSubmitting}
            >
              {bulkSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Apply
            </Button>
          </div>
        </div>
      )}

      <DataTable
        data={applications}
        columns={columns}
        loading={loading}
        emptyMessage="No applications yet. Click 'Add Application' to create one."
        onRowClick={(app) => router.push(`/dqf/applications/${app.id}`)}
        selectable={canBulkUpdate}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>New Driver Application</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={form.firstName}
                  onChange={(e) => handleChange('firstName', e.target.value)}
                  placeholder="John"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={form.lastName}
                  onChange={(e) => handleChange('lastName', e.target.value)}
                  placeholder="Doe"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="john@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="clientOrgId">Client Org ID</Label>
              <Input
                id="clientOrgId"
                value={form.clientOrgId}
                onChange={(e) => handleChange('clientOrgId', e.target.value)}
                placeholder="Optional"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="position">Position</Label>
              <Input
                id="position"
                value={form.position}
                onChange={(e) => handleChange('position', e.target.value)}
                placeholder="CDL Driver, Heavy Equipment Operator..."
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cdlNumber">CDL Number</Label>
                <Input
                  id="cdlNumber"
                  value={form.cdlNumber}
                  onChange={(e) => handleChange('cdlNumber', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cdlState">CDL State</Label>
                <Input
                  id="cdlState"
                  value={form.cdlState}
                  onChange={(e) => handleChange('cdlState', e.target.value)}
                  placeholder="TX"
                  maxLength={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cdlClass">CDL Class</Label>
                <Input
                  id="cdlClass"
                  value={form.cdlClass}
                  onChange={(e) => handleChange('cdlClass', e.target.value)}
                  placeholder="A, B, C"
                  maxLength={1}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Application'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
