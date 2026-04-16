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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import {
  ArrowLeft,
  User,
  Shield,
  FileText,
  Calendar,
  Phone,
  Mail,
  AlertCircle,
  Plus,
  CheckCircle2,
  Clock,
  Building2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// ============================================================================
// Types
// ============================================================================

interface Person {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  dob: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}

interface Qualification {
  id: string;
  qualificationType: string;
  status: string;
  issuedAt: string | null;
  expiresAt: string | null;
  referenceNumber: string | null;
  issuingAuthority: string | null;
  notes: string | null;
}

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

interface ComplianceScore {
  id: string;
  score: number;
  calculatedAt: string;
  breakdown: Record<string, unknown> | null;
}

interface Investigation {
  id: string;
  employerName: string;
  contactName: string | null;
  contactPhone: string | null;
  contactDate: string | null;
  safetyViolations: boolean;
  drugAlcoholViolations: boolean;
  datesOfEmployment: string | null;
  positionHeld: string | null;
}

interface DriverDetailProps {
  driverId: string;
  userRole: string;
}

// ============================================================================
// Badge Helpers
// ============================================================================

const qualificationStatusConfig: Record<string, { label: string; className: string }> = {
  active: {
    label: 'Active',
    className: 'border-transparent bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  },
  expiring_soon: {
    label: 'Expiring Soon',
    className: 'border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  },
  expired: {
    label: 'Expired',
    className: 'border-transparent bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  },
  pending_verification: {
    label: 'Pending Verification',
    className: 'border-transparent bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  },
  revoked: {
    label: 'Revoked',
    className: 'border-transparent bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  },
};

const applicationStatusConfig: Record<string, { label: string; className: string }> = {
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

function getQualStatusBadge(status: string) {
  const config = qualificationStatusConfig[status] || { label: status, className: '' };
  return <Badge className={config.className}>{config.label}</Badge>;
}

function getAppStatusBadge(status: string) {
  const config = applicationStatusConfig[status] || { label: status, className: '' };
  return <Badge className={config.className}>{config.label}</Badge>;
}

function getComplianceBadge(score: number | null) {
  if (score === null) {
    return <Badge variant="outline">N/A</Badge>;
  }
  if (score >= 80) {
    return (
      <Badge className="border-transparent bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
        {score}%
      </Badge>
    );
  }
  if (score >= 60) {
    return (
      <Badge className="border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
        {score}%
      </Badge>
    );
  }
  return (
    <Badge className="border-transparent bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
      {score}%
    </Badge>
  );
}

// ============================================================================
// Add Qualification Form
// ============================================================================

interface QualificationForm {
  qualificationType: string;
  issuedAt: string;
  expiresAt: string;
  referenceNumber: string;
  issuingAuthority: string;
  status: string;
}

const emptyQualForm: QualificationForm = {
  qualificationType: '',
  issuedAt: '',
  expiresAt: '',
  referenceNumber: '',
  issuingAuthority: '',
  status: 'active',
};

const qualificationTypes = [
  { value: 'cdl', label: 'CDL' },
  { value: 'medical_card', label: 'Medical Card' },
  { value: 'hazmat', label: 'HazMat Endorsement' },
  { value: 'tanker', label: 'Tanker Endorsement' },
  { value: 'doubles_triples', label: 'Doubles/Triples' },
  { value: 'passenger', label: 'Passenger Endorsement' },
  { value: 'mvr', label: 'MVR Report' },
  { value: 'road_test', label: 'Road Test Certificate' },
  { value: 'other', label: 'Other' },
];

// ============================================================================
// Component
// ============================================================================

export function DriverDetail({ driverId, userRole }: DriverDetailProps) {
  const { toast } = useToast();
  const router = useRouter();

  const [person, setPerson] = useState<Person | null>(null);
  const [qualifications, setQualifications] = useState<Qualification[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [complianceScore, setComplianceScore] = useState<number | null>(null);
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add qualification dialog state
  const [qualDialogOpen, setQualDialogOpen] = useState(false);
  const [qualForm, setQualForm] = useState<QualificationForm>(emptyQualForm);
  const [qualSubmitting, setQualSubmitting] = useState(false);

  // Fetch all data on mount
  useEffect(() => {
    async function fetchData() {
      try {
        const [personRes, qualsRes, appsRes, compRes, invRes] = await Promise.all([
          fetch(`/api/candidates/${driverId}`),
          fetch(`/api/dqf/qualifications?personId=${driverId}`),
          fetch(`/api/dqf/applications?personId=${driverId}`),
          fetch(`/api/dqf/compliance?personId=${driverId}`),
          fetch(`/api/dqf/investigations?personId=${driverId}`),
        ]);

        if (!personRes.ok) {
          setError('Driver not found');
          return;
        }

        const personData = await personRes.json();
        setPerson(personData.person || personData.candidate);

        if (qualsRes.ok) {
          const qualsData = await qualsRes.json();
          setQualifications(qualsData.qualifications || []);
        }

        if (appsRes.ok) {
          const appsData = await appsRes.json();
          setApplications(appsData.applications || []);
        }

        if (compRes.ok) {
          const compData = await compRes.json();
          const scores = compData.scores || [];
          if (scores.length > 0) {
            setComplianceScore(scores[0].score);
          }
        }

        if (invRes.ok) {
          const invData = await invRes.json();
          setInvestigations(invData.investigations || []);
        }
      } catch (err) {
        setError('Failed to load driver data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [driverId]);

  // Add Qualification handler
  const handleAddQualification = async () => {
    if (!qualForm.qualificationType) {
      toast({
        title: 'Validation Error',
        description: 'Qualification type is required.',
        variant: 'destructive',
      });
      return;
    }

    setQualSubmitting(true);
    try {
      const response = await fetch('/api/dqf/qualifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personId: driverId,
          qualificationType: qualForm.qualificationType,
          issuedAt: qualForm.issuedAt ? new Date(qualForm.issuedAt).toISOString() : undefined,
          expiresAt: qualForm.expiresAt ? new Date(qualForm.expiresAt).toISOString() : undefined,
          referenceNumber: qualForm.referenceNumber || undefined,
          issuingAuthority: qualForm.issuingAuthority || undefined,
          status: qualForm.status || 'active',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setQualifications((prev) => [data.qualification, ...prev]);
        setQualDialogOpen(false);
        setQualForm(emptyQualForm);
        toast({
          title: 'Qualification Added',
          description: 'The qualification has been added successfully.',
        });
      } else {
        const errorData = await response.json().catch(() => null);
        toast({
          title: 'Error',
          description: errorData?.error || 'Failed to add qualification.',
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
      setQualSubmitting(false);
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

  if (error || !person) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Driver Not Found"
        description={error || 'The driver you are looking for does not exist.'}
      />
    );
  }

  const canEdit = ['tpa_admin', 'tpa_staff', 'tpa_records', 'platform_admin'].includes(userRole);

  // ============================================================================
  // Column Definitions
  // ============================================================================

  const qualificationColumns = [
    {
      header: 'Type',
      accessor: (q: Qualification) => {
        const typeLabel = qualificationTypes.find((t) => t.value === q.qualificationType)?.label || q.qualificationType;
        return <span className="font-medium capitalize">{typeLabel}</span>;
      },
    },
    {
      header: 'Status',
      accessor: (q: Qualification) => getQualStatusBadge(q.status),
    },
    {
      header: 'Issued',
      accessor: (q: Qualification) =>
        q.issuedAt ? format(new Date(q.issuedAt), 'PP') : '-',
    },
    {
      header: 'Expires',
      accessor: (q: Qualification) =>
        q.expiresAt ? format(new Date(q.expiresAt), 'PP') : '-',
    },
    {
      header: 'Reference #',
      accessor: (q: Qualification) => q.referenceNumber || '-',
    },
  ];

  const applicationColumns = [
    {
      header: 'Date',
      accessor: (a: Application) => format(new Date(a.applicationDate), 'PP'),
    },
    {
      header: 'Position',
      accessor: (a: Application) => a.position || '-',
    },
    {
      header: 'CDL',
      accessor: (a: Application) => {
        if (!a.cdlClass && !a.cdlState) return '-';
        const parts = [a.cdlClass, a.cdlState].filter(Boolean);
        return parts.join(' / ');
      },
    },
    {
      header: 'Status',
      accessor: (a: Application) => getAppStatusBadge(a.status),
    },
  ];

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

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link
        href="/dqf/drivers"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to Drivers
      </Link>

      {/* Header Card */}
      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <User className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">
                {person.firstName} {person.lastName}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                {person.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" />
                    {person.email}
                  </span>
                )}
                {person.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" />
                    {person.phone}
                  </span>
                )}
                {person.dob && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    DOB: {format(new Date(person.dob), 'PP')}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getComplianceBadge(complianceScore)}
          </div>
        </div>
      </Card>

      {/* Qualifications Section */}
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Qualifications</h2>
          </div>
          {canEdit && (
            <Button size="sm" onClick={() => setQualDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Qualification
            </Button>
          )}
        </div>
        <DataTable
          data={qualifications}
          columns={qualificationColumns}
          emptyMessage="No qualifications on file."
        />
      </Card>

      {/* Applications Section */}
      <Card className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Applications</h2>
        </div>
        <DataTable
          data={applications}
          columns={applicationColumns}
          emptyMessage="No applications found."
          onRowClick={(app) => router.push(`/dqf/applications/${app.id}`)}
        />
      </Card>

      {/* Employer Investigations Section */}
      <Card className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Employer Investigations</h2>
        </div>
        <DataTable
          data={investigations}
          columns={investigationColumns}
          emptyMessage="No employer investigations on record."
        />
      </Card>

      {/* Add Qualification Dialog */}
      <Dialog open={qualDialogOpen} onOpenChange={setQualDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Qualification</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="qualificationType">Type *</Label>
              <Select
                value={qualForm.qualificationType}
                onValueChange={(value) =>
                  setQualForm((prev) => ({ ...prev, qualificationType: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {qualificationTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="qualStatus">Status</Label>
              <Select
                value={qualForm.status}
                onValueChange={(value) =>
                  setQualForm((prev) => ({ ...prev, status: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expiring_soon">Expiring Soon</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="pending_verification">Pending Verification</SelectItem>
                  <SelectItem value="revoked">Revoked</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="issuedAt">Issued Date</Label>
                <Input
                  id="issuedAt"
                  type="date"
                  value={qualForm.issuedAt}
                  onChange={(e) =>
                    setQualForm((prev) => ({ ...prev, issuedAt: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiresAt">Expiration Date</Label>
                <Input
                  id="expiresAt"
                  type="date"
                  value={qualForm.expiresAt}
                  onChange={(e) =>
                    setQualForm((prev) => ({ ...prev, expiresAt: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="referenceNumber">Reference Number</Label>
              <Input
                id="referenceNumber"
                value={qualForm.referenceNumber}
                onChange={(e) =>
                  setQualForm((prev) => ({ ...prev, referenceNumber: e.target.value }))
                }
                placeholder="License #, cert #, etc."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="issuingAuthority">Issuing Authority</Label>
              <Input
                id="issuingAuthority"
                value={qualForm.issuingAuthority}
                onChange={(e) =>
                  setQualForm((prev) => ({ ...prev, issuingAuthority: e.target.value }))
                }
                placeholder="State, FMCSA, etc."
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setQualDialogOpen(false)}
              disabled={qualSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleAddQualification} disabled={qualSubmitting}>
              {qualSubmitting ? 'Adding...' : 'Add Qualification'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
