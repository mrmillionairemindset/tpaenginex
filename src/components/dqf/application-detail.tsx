'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { DataTable } from '@/components/ui/data-table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import {
  ArrowLeft,
  User,
  FileText,
  Building2,
  AlertCircle,
  Plus,
  CheckCircle2,
  Clock,
  Truck,
} from 'lucide-react';
import Link from 'next/link';

// ============================================================================
// Types
// ============================================================================

interface Person {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
}

interface Investigation {
  id: string;
  employerName: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  contactDate: string | null;
  datesOfEmployment: string | null;
  positionHeld: string | null;
  reasonForLeaving: string | null;
  safetyViolations: boolean;
  drugAlcoholViolations: boolean;
  notes: string | null;
}

interface ApplicationData {
  id: string;
  status: string;
  position: string | null;
  cdlNumber: string | null;
  cdlState: string | null;
  cdlClass: string | null;
  endorsements: string[] | null;
  applicationDate: string;
  previousEmployerContact: unknown;
  notes: string | null;
  person?: Person;
  clientOrg?: { id: string; name: string } | null;
  investigations?: Investigation[];
}

interface ApplicationDetailProps {
  applicationId: string;
  userRole: string;
}

// ============================================================================
// Badge Helpers
// ============================================================================

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

// ============================================================================
// Investigation Form
// ============================================================================

interface InvestigationForm {
  employerName: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  datesOfEmployment: string;
  positionHeld: string;
  reasonForLeaving: string;
  safetyViolations: boolean;
  drugAlcoholViolations: boolean;
  notes: string;
}

const emptyInvForm: InvestigationForm = {
  employerName: '',
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  datesOfEmployment: '',
  positionHeld: '',
  reasonForLeaving: '',
  safetyViolations: false,
  drugAlcoholViolations: false,
  notes: '',
};

// ============================================================================
// Component
// ============================================================================

export function ApplicationDetail({ applicationId, userRole }: ApplicationDetailProps) {
  const { toast } = useToast();

  const [application, setApplication] = useState<ApplicationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  // Investigation dialog state
  const [invDialogOpen, setInvDialogOpen] = useState(false);
  const [invForm, setInvForm] = useState<InvestigationForm>(emptyInvForm);
  const [invSubmitting, setInvSubmitting] = useState(false);

  // Fetch application
  useEffect(() => {
    async function fetchApplication() {
      try {
        const response = await fetch(`/api/dqf/applications/${applicationId}`);
        if (response.ok) {
          const data = await response.json();
          setApplication(data.application);
        } else {
          setError('Application not found');
        }
      } catch (err) {
        setError('Failed to load application');
      } finally {
        setLoading(false);
      }
    }

    fetchApplication();
  }, [applicationId]);

  // Status update handler
  const handleStatusChange = async (newStatus: string) => {
    setUpdating(true);
    try {
      const response = await fetch(`/api/dqf/applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        const data = await response.json();
        setApplication(data.application);
        toast({
          title: 'Status Updated',
          description: `Application has been marked as ${statusConfig[newStatus]?.label || newStatus}.`,
        });
      } else {
        const errorData = await response.json().catch(() => null);
        toast({
          title: 'Error',
          description: errorData?.error || 'Failed to update status.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setUpdating(false);
    }
  };

  // Add investigation handler
  const handleAddInvestigation = async () => {
    if (!invForm.employerName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Employer name is required.',
        variant: 'destructive',
      });
      return;
    }

    setInvSubmitting(true);
    try {
      const response = await fetch('/api/dqf/investigations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personId: application!.person!.id,
          applicationId: applicationId,
          employerName: invForm.employerName.trim(),
          contactName: invForm.contactName.trim() || undefined,
          contactPhone: invForm.contactPhone.trim() || undefined,
          contactEmail: invForm.contactEmail.trim() || undefined,
          datesOfEmployment: invForm.datesOfEmployment.trim() || undefined,
          positionHeld: invForm.positionHeld.trim() || undefined,
          reasonForLeaving: invForm.reasonForLeaving.trim() || undefined,
          safetyViolations: invForm.safetyViolations,
          drugAlcoholViolations: invForm.drugAlcoholViolations,
          notes: invForm.notes.trim() || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setApplication((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            investigations: [data.investigation, ...(prev.investigations || [])],
          };
        });
        setInvDialogOpen(false);
        setInvForm(emptyInvForm);
        toast({
          title: 'Investigation Added',
          description: 'Employer investigation has been recorded.',
        });
      } else {
        const errorData = await response.json().catch(() => null);
        toast({
          title: 'Error',
          description: errorData?.error || 'Failed to add investigation.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setInvSubmitting(false);
    }
  };

  // ============================================================================
  // Loading / Error States
  // ============================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !application) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Application Not Found"
        description={error || 'The application you are looking for does not exist.'}
      />
    );
  }

  const canEdit = ['tpa_admin', 'tpa_staff', 'platform_admin'].includes(userRole);
  const personName = application.person
    ? `${application.person.firstName} ${application.person.lastName}`
    : 'Unknown';

  // Status action buttons
  const statusActions: { label: string; status: string; variant: 'default' | 'destructive' | 'outline' }[] = [];
  if (canEdit) {
    if (application.status === 'submitted') {
      statusActions.push({ label: 'Mark Under Review', status: 'under_review', variant: 'outline' });
      statusActions.push({ label: 'Approve', status: 'approved', variant: 'default' });
      statusActions.push({ label: 'Reject', status: 'rejected', variant: 'destructive' });
    } else if (application.status === 'under_review') {
      statusActions.push({ label: 'Approve', status: 'approved', variant: 'default' });
      statusActions.push({ label: 'Reject', status: 'rejected', variant: 'destructive' });
    } else if (application.status === 'approved' || application.status === 'rejected') {
      statusActions.push({ label: 'Reopen as Under Review', status: 'under_review', variant: 'outline' });
    }
  }

  // Investigation columns
  const investigationColumns = [
    {
      header: 'Employer',
      accessor: (inv: Investigation) => (
        <span className="font-medium">{inv.employerName}</span>
      ),
    },
    {
      header: 'Contact',
      accessor: (inv: Investigation) => inv.contactName || '-',
    },
    {
      header: 'Date',
      accessor: (inv: Investigation) =>
        inv.contactDate ? format(new Date(inv.contactDate), 'PP') : '-',
    },
    {
      header: 'Safety Violations',
      accessor: (inv: Investigation) =>
        inv.safetyViolations ? (
          <Badge className="border-transparent bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Yes</Badge>
        ) : (
          <Badge className="border-transparent bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">No</Badge>
        ),
    },
    {
      header: 'D&A Violations',
      accessor: (inv: Investigation) =>
        inv.drugAlcoholViolations ? (
          <Badge className="border-transparent bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Yes</Badge>
        ) : (
          <Badge className="border-transparent bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">No</Badge>
        ),
    },
  ];

  // Previous employer contact from jsonb
  const prevEmployer = application.previousEmployerContact as Record<string, string> | null;

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link
        href="/dqf/applications"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to Applications
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <User className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{personName}</h1>
            <p className="text-sm text-muted-foreground">
              {application.clientOrg?.name ? `${application.clientOrg.name} — ` : ''}
              Applied {format(new Date(application.applicationDate), 'PPP')}
            </p>
          </div>
          <div className="ml-2">{getStatusBadge(application.status)}</div>
        </div>
        <div className="flex items-center gap-2">
          {statusActions.map((action) => (
            <Button
              key={action.status}
              variant={action.variant}
              size="sm"
              onClick={() => handleStatusChange(action.status)}
              disabled={updating}
            >
              {action.status === 'approved' && <CheckCircle2 className="mr-1.5 h-4 w-4" />}
              {action.status === 'under_review' && <Clock className="mr-1.5 h-4 w-4" />}
              {action.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Application Info */}
      <Card className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Application Details</h2>
        </div>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted-foreground">Position</dt>
            <dd className="font-medium">{application.position || '-'}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Client</dt>
            <dd className="font-medium">{application.clientOrg?.name || '-'}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">CDL Number</dt>
            <dd className="font-medium">{application.cdlNumber || '-'}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">CDL State</dt>
            <dd className="font-medium">{application.cdlState || '-'}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">CDL Class</dt>
            <dd className="font-medium">{application.cdlClass || '-'}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Endorsements</dt>
            <dd className="font-medium">
              {application.endorsements && application.endorsements.length > 0
                ? application.endorsements.join(', ')
                : '-'}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Application Date</dt>
            <dd className="font-medium">{format(new Date(application.applicationDate), 'PPP')}</dd>
          </div>
          {application.notes && (
            <div className="sm:col-span-2">
              <dt className="text-sm text-muted-foreground">Notes</dt>
              <dd className="font-medium">{application.notes}</dd>
            </div>
          )}
        </dl>

        {/* Previous Employer Contact from jsonb */}
        {prevEmployer && Object.keys(prevEmployer).length > 0 && (
          <div className="mt-6 border-t pt-4">
            <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Previous Employer Contact
            </h3>
            <dl className="grid gap-3 sm:grid-cols-2">
              {Object.entries(prevEmployer).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-sm text-muted-foreground capitalize">
                    {key.replace(/_/g, ' ')}
                  </dt>
                  <dd className="font-medium">{value || '-'}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </Card>

      {/* Employer Investigations */}
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Employer Investigations</h2>
          </div>
          {canEdit && (
            <Button size="sm" onClick={() => setInvDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Investigation
            </Button>
          )}
        </div>
        <DataTable
          data={application.investigations || []}
          columns={investigationColumns}
          emptyMessage="No employer investigations on record."
        />
      </Card>

      {/* Add Investigation Dialog */}
      <Dialog open={invDialogOpen} onOpenChange={setInvDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Add Employer Investigation</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="employerName">Employer Name *</Label>
              <Input
                id="employerName"
                value={invForm.employerName}
                onChange={(e) =>
                  setInvForm((prev) => ({ ...prev, employerName: e.target.value }))
                }
                placeholder="ABC Trucking Co."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invContactName">Contact Name</Label>
                <Input
                  id="invContactName"
                  value={invForm.contactName}
                  onChange={(e) =>
                    setInvForm((prev) => ({ ...prev, contactName: e.target.value }))
                  }
                  placeholder="Jane Smith"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invContactPhone">Contact Phone</Label>
                <Input
                  id="invContactPhone"
                  value={invForm.contactPhone}
                  onChange={(e) =>
                    setInvForm((prev) => ({ ...prev, contactPhone: e.target.value }))
                  }
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invContactEmail">Contact Email</Label>
              <Input
                id="invContactEmail"
                type="email"
                value={invForm.contactEmail}
                onChange={(e) =>
                  setInvForm((prev) => ({ ...prev, contactEmail: e.target.value }))
                }
                placeholder="jane@abctrucking.com"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="datesOfEmployment">Dates of Employment</Label>
                <Input
                  id="datesOfEmployment"
                  value={invForm.datesOfEmployment}
                  onChange={(e) =>
                    setInvForm((prev) => ({ ...prev, datesOfEmployment: e.target.value }))
                  }
                  placeholder="Jan 2020 - Dec 2023"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="positionHeld">Position Held</Label>
                <Input
                  id="positionHeld"
                  value={invForm.positionHeld}
                  onChange={(e) =>
                    setInvForm((prev) => ({ ...prev, positionHeld: e.target.value }))
                  }
                  placeholder="OTR Driver"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reasonForLeaving">Reason for Leaving</Label>
              <Input
                id="reasonForLeaving"
                value={invForm.reasonForLeaving}
                onChange={(e) =>
                  setInvForm((prev) => ({ ...prev, reasonForLeaving: e.target.value }))
                }
                placeholder="Voluntary resignation"
              />
            </div>

            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={invForm.safetyViolations}
                  onChange={(e) =>
                    setInvForm((prev) => ({ ...prev, safetyViolations: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
                Safety Violations
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={invForm.drugAlcoholViolations}
                  onChange={(e) =>
                    setInvForm((prev) => ({ ...prev, drugAlcoholViolations: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
                Drug & Alcohol Violations
              </label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invNotes">Notes</Label>
              <Input
                id="invNotes"
                value={invForm.notes}
                onChange={(e) =>
                  setInvForm((prev) => ({ ...prev, notes: e.target.value }))
                }
                placeholder="Additional details..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setInvDialogOpen(false)}
              disabled={invSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleAddInvestigation} disabled={invSubmitting}>
              {invSubmitting ? 'Adding...' : 'Add Investigation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
