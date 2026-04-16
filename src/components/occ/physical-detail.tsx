'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/components/ui/use-toast';
import { PageHeader } from '@/components/ui/page-header';
import { Download, Play, Trash2, CircleCheck, AlertCircle, RefreshCw, Clock } from 'lucide-react';

interface Props {
  examId: string;
  userRole: string;
  hasNrcme: boolean;
}

interface Exam {
  id: string;
  examType: string;
  status: string;
  certificationStatus: string | null;
  scheduledFor: string | null;
  examDate: string | null;
  mecIssuedAt: string | null;
  mecExpiresOn: string | null;
  certificateNumber: string | null;
  restrictions: string[] | null;
  fmcsaSubmissionStatus: string;
  fmcsaSubmittedAt: string | null;
  fmcsaErrorMessage: string | null;
  mecStorageKey: string | null;
  examinerNRCMENumber: string | null;
  notes: string | null;
  createdAt: string;
  person: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    dob: string;
  };
  clientOrg: { id: string; name: string } | null;
  examiner: { id: string; name: string | null; nrcmeNumber: string | null } | null;
  findings: Array<{ id: string; category: string; description: string; action: string | null }>;
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString();
}

export function PhysicalDetail({ examId, userRole, hasNrcme }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const fetchExam = useCallback(async () => {
    try {
      const res = await fetch(`/api/occ/physicals/${examId}`);
      if (res.ok) {
        const data = await res.json();
        setExam(data.exam);
      }
    } catch (err) {
      console.error('[physical-detail] fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    fetchExam();
  }, [fetchExam]);

  const handleStart = async () => {
    setWorking(true);
    try {
      const res = await fetch(`/api/occ/physicals/${examId}/start`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to start exam');
      }
      toast({ title: 'Exam started' });
      router.push(`/occ/physicals/${examId}/exam`);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setWorking(false);
    }
  };

  const handleAbandon = async () => {
    if (!confirm('Mark this scheduled exam as abandoned?')) return;
    setWorking(true);
    try {
      const res = await fetch(`/api/occ/physicals/${examId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      toast({ title: 'Exam abandoned' });
      fetchExam();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setWorking(false);
    }
  };

  const retryFmcsaSubmission = async () => {
    setWorking(true);
    try {
      const res = await fetch(`/api/occ/physicals/${examId}/fmcsa-submit`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        toast({
          title: 'Submitted to FMCSA',
          description: data.fmcsaSubmissionId
            ? `Submission ID: ${data.fmcsaSubmissionId}`
            : 'FMCSA accepted the submission.',
        });
      } else {
        toast({
          title: 'Submission failed',
          description: data.errorMessage || 'FMCSA rejected the submission.',
          variant: 'destructive',
        });
      }
      fetchExam();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setWorking(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><LoadingSpinner size="lg" /></div>;
  }
  if (!exam) return <div className="p-6">Exam not found</div>;

  const canManage = ['tpa_admin', 'tpa_staff', 'tpa_records', 'platform_admin'].includes(userRole);

  const driverName = `${exam.person.firstName} ${exam.person.lastName}`;

  return (
    <div>
      <PageHeader
        title={`Physical — ${driverName}`}
        description={`${exam.examType.toUpperCase().replace(/_/g, ' ')} exam · ${exam.status.replace(/_/g, ' ')}`}
      >
        <div className="flex gap-2">
          {exam.status === 'scheduled' && canManage && (
            <>
              <Button onClick={handleStart} disabled={working}>
                <Play className="mr-2 h-4 w-4" /> Start Exam
              </Button>
              <Button variant="outline" onClick={handleAbandon} disabled={working}>
                <Trash2 className="mr-2 h-4 w-4" /> Abandon
              </Button>
            </>
          )}
          {exam.status === 'in_progress' && canManage && (
            <Button onClick={() => router.push(`/occ/physicals/${examId}/exam`)}>
              Continue Exam
            </Button>
          )}
          {exam.status === 'completed' && exam.mecStorageKey && (
            <Button
              variant="outline"
              onClick={() => window.open(`/api/occ/physicals/${examId}/mec.pdf`, '_blank')}
            >
              <Download className="mr-2 h-4 w-4" /> Download MEC
            </Button>
          )}
        </div>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 mt-6">
        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-3">Driver</h3>
          <div className="space-y-2 text-sm">
            <div><span className="text-muted-foreground">Name:</span> {driverName}</div>
            <div><span className="text-muted-foreground">DOB:</span> {exam.person.dob}</div>
            <div><span className="text-muted-foreground">Email:</span> {exam.person.email}</div>
            <div><span className="text-muted-foreground">Phone:</span> {exam.person.phone}</div>
            {exam.clientOrg && (
              <div><span className="text-muted-foreground">Client:</span> {exam.clientOrg.name}</div>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-3">Exam</h3>
          <div className="space-y-2 text-sm">
            <div><span className="text-muted-foreground">Scheduled:</span> {formatDate(exam.scheduledFor)}</div>
            <div><span className="text-muted-foreground">Exam Date:</span> {formatDate(exam.examDate)}</div>
            <div><span className="text-muted-foreground">Examiner:</span> {exam.examiner?.name || '—'}{exam.examiner?.nrcmeNumber ? ` (NRCME ${exam.examiner.nrcmeNumber})` : ''}</div>
            {exam.notes && (
              <div><span className="text-muted-foreground">Notes:</span> {exam.notes}</div>
            )}
          </div>
        </Card>

        {exam.status === 'completed' && (
          <Card className="p-4 md:col-span-2">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <CircleCheck className="h-5 w-5 text-green-600" /> Medical Examiner's Certificate
            </h3>
            <div className="grid gap-3 md:grid-cols-2 text-sm">
              <div><span className="text-muted-foreground">Certificate #:</span> <span className="font-mono">{exam.certificateNumber || '—'}</span></div>
              <div><span className="text-muted-foreground">Issued:</span> {formatDate(exam.mecIssuedAt)}</div>
              <div><span className="text-muted-foreground">Expires:</span> {formatDate(exam.mecExpiresOn)}</div>
              <div>
                <span className="text-muted-foreground">Decision:</span>{' '}
                <Badge>{exam.certificationStatus?.replace(/_/g, ' ') || '—'}</Badge>
              </div>
              <div><span className="text-muted-foreground">Examiner NRCME #:</span> {exam.examinerNRCMENumber || '—'}</div>
              <div>
                <span className="text-muted-foreground">FMCSA Status:</span>{' '}
                <FmcsaStatusBadge status={exam.fmcsaSubmissionStatus} submittedAt={exam.fmcsaSubmittedAt} />
              </div>
            </div>
            {exam.restrictions && exam.restrictions.length > 0 && (
              <div className="mt-4">
                <div className="text-sm font-medium mb-1">Restrictions</div>
                <ul className="list-disc list-inside text-sm text-muted-foreground">
                  {exam.restrictions.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
            {exam.fmcsaErrorMessage && (
              <div className="mt-4 flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-semibold">FMCSA Submission Error</div>
                  <div className="mt-1">{exam.fmcsaErrorMessage}</div>
                </div>
              </div>
            )}
            {/* Manual retry — shown whenever the exam is DOT and has not yet been submitted */}
            {exam.examType === 'dot' &&
              exam.status === 'completed' &&
              ['pending', 'error'].includes(exam.fmcsaSubmissionStatus) && (
              <div className="mt-4 flex items-center justify-between rounded-md border bg-muted/40 p-3 text-sm">
                <div className="text-muted-foreground">
                  {exam.fmcsaSubmissionStatus === 'error'
                    ? 'Submission failed. Verify the examiner NRCME number is set, then retry.'
                    : 'Submission queued. Will auto-retry every 15 minutes.'}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={retryFmcsaSubmission}
                  disabled={working}
                >
                  <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${working ? 'animate-spin' : ''}`} />
                  Retry submission
                </Button>
              </div>
            )}
          </Card>
        )}

        {exam.findings.length > 0 && (
          <Card className="p-4 md:col-span-2">
            <h3 className="text-lg font-semibold mb-3">Findings</h3>
            <div className="space-y-2">
              {exam.findings.map((f) => (
                <div key={f.id} className="rounded-md border px-3 py-2 text-sm">
                  <div className="font-medium">{f.category.replace(/_/g, ' ')}</div>
                  <div className="text-muted-foreground">{f.description}</div>
                  {f.action && <div className="text-xs mt-1">Action: {f.action}</div>}
                </div>
              ))}
            </div>
          </Card>
        )}

        {!hasNrcme && exam.status === 'in_progress' && userRole !== 'platform_admin' && (
          <Card className="p-4 md:col-span-2 border-yellow-300 bg-yellow-50">
            <div className="flex items-start gap-2 text-sm text-yellow-800">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                This exam cannot be certified by your account because no NRCME number is set on your
                profile. A certified medical examiner must complete the Certify step.
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

/**
 * Shows a color-coded FMCSA submission status badge with an appropriate icon.
 */
function FmcsaStatusBadge({
  status,
  submittedAt,
}: {
  status: string;
  submittedAt: string | null;
}) {
  const label = status.replace(/_/g, ' ');
  switch (status) {
    case 'submitted':
    case 'accepted':
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100" title={submittedAt ? `Submitted ${formatDate(submittedAt)}` : undefined}>
          <CircleCheck className="h-3 w-3 mr-1" />
          {label}
        </Badge>
      );
    case 'pending':
      return (
        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
          <Clock className="h-3 w-3 mr-1" />
          pending
        </Badge>
      );
    case 'error':
    case 'rejected':
      return (
        <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
          <AlertCircle className="h-3 w-3 mr-1" />
          {label}
        </Badge>
      );
    case 'not_required':
      return (
        <Badge variant="outline" className="text-muted-foreground">
          not required
        </Badge>
      );
    default:
      return <Badge variant="outline">{label}</Badge>;
  }
}
