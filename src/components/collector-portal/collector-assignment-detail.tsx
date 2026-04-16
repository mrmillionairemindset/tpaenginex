'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  User,
  Phone,
  Building2,
  MapPin,
  Clock,
  Shield,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Upload,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';

interface Assignment {
  id: string;
  orderNumber: string;
  testType: string;
  serviceType: string;
  isDOT: boolean;
  priority: string;
  status: string;
  ccfNumber: string | null;
  jobsiteLocation: string;
  scheduledFor: string | null;
  notes: string | null;
  person: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
  } | null;
  clientOrg: {
    id: string;
    name: string;
  } | null;
  event: {
    id: string;
    eventNumber: string;
    serviceType: string;
    scheduledDate: string;
    totalOrdered: number;
  } | null;
  documents: {
    id: string;
    kind: string;
    fileName: string;
    createdAt: string;
  }[];
}

interface Document {
  id: string;
  kind: string;
  fileName: string;
  storageUrl: string;
  fileSize: number | null;
  mimeType: string | null;
  createdAt: string;
  uploadedByUser: {
    id: string;
    name: string | null;
  } | null;
}

function statusColor(status: string) {
  switch (status) {
    case 'new':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    case 'scheduled':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
    case 'in_progress':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    case 'results_uploaded':
    case 'pending_review':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
    case 'complete':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
  }
}

function formatStatus(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function CollectorAssignmentDetail({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Complete collection state
  const [ccfNumber, setCcfNumber] = useState('');
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  // Shy bladder wait time state
  const [waitHours, setWaitHours] = useState('');
  const [addingWait, setAddingWait] = useState(false);
  const [waitAdded, setWaitAdded] = useState(false);

  // Document upload state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedKind, setSelectedKind] = useState<string>('chain_of_custody');

  const fetchAssignment = useCallback(async () => {
    try {
      // Fetch from assignments endpoint and filter by ID
      const res = await fetch('/api/collector-portal/assignments');
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch assignment');
      }
      const data = await res.json();
      const found = data.assignments.find(
        (a: Assignment) => a.id === orderId
      );
      if (!found) {
        throw new Error('Assignment not found');
      }
      setAssignment(found);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to fetch assignment'
      );
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/collector-portal/assignments/${orderId}/documents`
      );
      if (!res.ok) return;
      const data = await res.json();
      setDocuments(data.documents);
    } catch {
      // Non-critical — documents section just won't load
    }
  }, [orderId]);

  useEffect(() => {
    fetchAssignment();
    fetchDocuments();
  }, [fetchAssignment, fetchDocuments]);

  const handleComplete = async () => {
    setCompleting(true);
    setCompleteError(null);

    try {
      const body: { ccfNumber?: string } = {};
      if (ccfNumber.trim()) {
        body.ccfNumber = ccfNumber.trim();
      }

      const res = await fetch(
        `/api/collector-portal/assignments/${orderId}/complete`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to mark complete');
      }

      // Refresh the assignment
      await fetchAssignment();
    } catch (err) {
      setCompleteError(
        err instanceof Error ? err.message : 'Failed to mark complete'
      );
    } finally {
      setCompleting(false);
    }
  };

  const handleAddWaitTime = async () => {
    const hours = parseFloat(waitHours);
    if (!hours || hours <= 0) return;

    setAddingWait(true);
    try {
      const res = await fetch(
        `/api/collector-portal/assignments/${orderId}/wait-time`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hours }),
        }
      );

      if (res.ok) {
        setWaitAdded(true);
        setWaitHours('');
      }
    } catch {
      // silently fail
    } finally {
      setAddingWait(false);
    }
  };

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('kind', selectedKind);

      const res = await fetch(
        `/api/collector-portal/assignments/${orderId}/documents`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to upload document');
      }

      // Reset file input and refresh documents
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      await fetchDocuments();
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Failed to upload document'
      );
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-6 w-1/3 rounded bg-muted" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-4 w-full rounded bg-muted" />
          <div className="h-4 w-2/3 rounded bg-muted" />
          <div className="h-4 w-1/2 rounded bg-muted" />
        </CardContent>
      </Card>
    );
  }

  if (error || !assignment) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-destructive">{error || 'Assignment not found'}</p>
          <Link href="/collector-portal">
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Assignments
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const canComplete =
    assignment.status === 'new' ||
    assignment.status === 'scheduled' ||
    assignment.status === 'needs_site';

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/collector-portal"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to Assignments
      </Link>

      {/* Order header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl">
                Order {assignment.orderNumber}
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {assignment.testType}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className={statusColor(assignment.status)}>
                {formatStatus(assignment.status)}
              </Badge>
              {assignment.isDOT && (
                <Badge
                  variant="outline"
                  className="border-amber-500 text-amber-600 dark:text-amber-400"
                >
                  <Shield className="mr-1 h-3 w-3" />
                  DOT
                </Badge>
              )}
              {assignment.priority === 'urgent' && (
                <Badge variant="destructive">
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  Urgent
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Person info */}
            {assignment.person && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">
                  Person
                </h4>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>
                    {assignment.person.firstName}{' '}
                    {assignment.person.lastName}
                  </span>
                </div>
                {assignment.person.phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <a
                      href={`tel:${assignment.person.phone}`}
                      className="hover:underline"
                    >
                      {assignment.person.phone}
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Client info */}
            {assignment.clientOrg && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">
                  Client
                </h4>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  <span>{assignment.clientOrg.name}</span>
                </div>
              </div>
            )}

            {/* Location */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground">
                Location
              </h4>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{assignment.jobsiteLocation}</span>
              </div>
            </div>

            {/* Scheduled time */}
            {assignment.scheduledFor && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-foreground">
                  Scheduled
                </h4>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>
                    {format(
                      new Date(assignment.scheduledFor),
                      'EEEE, MMM d, yyyy h:mm a'
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Service details */}
          <div className="rounded-md border p-4">
            <h4 className="mb-2 text-sm font-semibold text-foreground">
              Service Details
            </h4>
            <div className="grid gap-2 text-sm sm:grid-cols-3">
              <div>
                <span className="text-muted-foreground">Service Type:</span>{' '}
                <span className="font-medium">
                  {formatStatus(assignment.serviceType)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Priority:</span>{' '}
                <span className="font-medium">
                  {formatStatus(assignment.priority)}
                </span>
              </div>
              {assignment.ccfNumber && (
                <div>
                  <span className="text-muted-foreground">CCF #:</span>{' '}
                  <span className="font-medium">{assignment.ccfNumber}</span>
                </div>
              )}
            </div>
          </div>

          {/* Event info */}
          {assignment.event && (
            <div className="rounded-md border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950">
              <h4 className="mb-2 text-sm font-semibold text-foreground">
                Part of Event
              </h4>
              <div className="grid gap-2 text-sm sm:grid-cols-3">
                <div>
                  <span className="text-muted-foreground">Event #:</span>{' '}
                  <span className="font-medium">
                    {assignment.event.eventNumber}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Type:</span>{' '}
                  <span className="font-medium">
                    {formatStatus(assignment.event.serviceType)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Ordered:</span>{' '}
                  <span className="font-medium">
                    {assignment.event.totalOrdered}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          {assignment.notes && (
            <div className="rounded-md bg-muted/50 p-4">
              <h4 className="mb-1 text-sm font-semibold text-foreground">
                Notes
              </h4>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {assignment.notes}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mark collection complete */}
      {canComplete && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Mark Collection Complete
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ccfNumber">
                CCF Number (Chain of Custody Form)
              </Label>
              <Input
                id="ccfNumber"
                placeholder="Enter CCF number..."
                value={ccfNumber}
                onChange={(e) => setCcfNumber(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Optional. You can add this later if needed.
              </p>
            </div>

            {completeError && (
              <p className="text-sm text-destructive">{completeError}</p>
            )}

            <Button onClick={handleComplete} disabled={completing}>
              {completing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Mark as In Progress
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Shy Bladder / Extended Wait */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-amber-500" />
            Extended Wait Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          {waitAdded ? (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              Wait time logged successfully
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                If the donor required additional time to provide a specimen, log the wait time here.
              </p>
              <div className="flex items-center gap-3">
                <div className="w-24">
                  <Input
                    type="number"
                    step="0.5"
                    min="0.5"
                    placeholder="Hours"
                    value={waitHours}
                    onChange={(e) => setWaitHours(e.target.value)}
                  />
                </div>
                <span className="text-sm text-muted-foreground">hour(s)</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddWaitTime}
                  disabled={addingWait || !waitHours || parseFloat(waitHours) <= 0}
                >
                  {addingWait ? 'Adding...' : 'Log Wait Time'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Document upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Upload className="h-5 w-5" />
            Upload Document
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="docKind">Document Type</Label>
              <select
                id="docKind"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={selectedKind}
                onChange={(e) => setSelectedKind(e.target.value)}
              >
                <option value="chain_of_custody">Chain of Custody</option>
                <option value="result">Result</option>
                <option value="consent">Consent Form</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="docFile">File</Label>
              <Input
                id="docFile"
                type="file"
                ref={fileInputRef}
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              />
            </div>
          </div>

          {uploadError && (
            <p className="text-sm text-destructive">{uploadError}</p>
          )}

          <Button
            onClick={handleUpload}
            disabled={uploading}
            variant="outline"
          >
            {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Upload className="mr-2 h-4 w-4" />
            Upload
          </Button>
        </CardContent>
      </Card>

      {/* Documents list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5" />
            Documents ({documents.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No documents uploaded yet.
            </p>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between rounded-md border px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{doc.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatStatus(doc.kind)}
                        {doc.fileSize
                          ? ` - ${(doc.fileSize / 1024).toFixed(1)} KB`
                          : ''}
                        {' - '}
                        {format(new Date(doc.createdAt), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                  </div>
                  {doc.uploadedByUser && (
                    <span className="text-xs text-muted-foreground">
                      by {doc.uploadedByUser.name || 'Unknown'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
