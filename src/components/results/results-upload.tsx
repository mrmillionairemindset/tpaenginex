'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '@/components/ui/status-badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/use-toast';
import { AlertCircle, Upload, FileText, User, Trash2, CheckCircle, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

interface ResultsUploadProps {
  orderId: string;
}

export function ResultsUpload({ orderId }: ResultsUploadProps) {
  const { toast } = useToast();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  const fetchOrder = async () => {
    try {
      const response = await fetch(`/api/orders/${orderId}`);
      if (response.ok) {
        const data = await response.json();
        setOrder(data.order);
      } else {
        setError('Order not found');
      }
    } catch (err) {
      setError('Failed to load order');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleDownload = async (documentId: string, filename: string) => {
    try {
      const response = await fetch(`/api/files/${documentId}`);
      if (!response.ok) {
        throw new Error('Failed to get download URL');
      }

      const { url } = await response.json();
      window.open(url, '_blank');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to download file',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) {
      return;
    }

    setDeleting(documentId);
    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete document');
      }

      toast({
        title: 'Success',
        description: 'Document deleted successfully',
      });

      await fetchOrder();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete document',
        variant: 'destructive',
      });
    } finally {
      setDeleting(null);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      toast({
        title: 'Error',
        description: 'Please select a file to upload',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);

    try {
      // Step 1: Get signed upload URL
      const signResponse = await fetch('/api/files/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          kind: 'result',
          filename: file.name,
          contentType: file.type,
          fileSize: file.size,
        }),
      });

      if (!signResponse.ok) {
        const error = await signResponse.json();
        throw new Error(error.error || 'Failed to get upload URL');
      }

      const { uploadUrl, documentId } = await signResponse.json();

      // Step 2: Upload file directly to storage using signed URL
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file to storage');
      }

      // Step 3: Update document with notes if provided
      if (notes) {
        await fetch(`/api/orders/${orderId}/documents/${documentId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes }),
        });
      }

      // Step 4: Update order status to results_uploaded (NOT complete)
      await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'results_uploaded' }),
      });

      toast({
        title: 'Success',
        description: 'File uploaded successfully. Review and submit when ready.',
      });

      // Refresh order data
      await fetchOrder();

      // Reset form
      setFile(null);
      setNotes('');
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmitResults = async () => {
    if (!verified) {
      toast({
        title: 'Verification Required',
        description: 'Please verify that all documents are correct before submitting',
        variant: 'destructive',
      });
      return;
    }

    if (!resultDocuments || resultDocuments.length === 0) {
      toast({
        title: 'No Documents',
        description: 'Please upload at least one result document before submitting',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'pending_review' }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit results');
      }

      toast({
        title: 'Results Submitted',
        description: 'Results have been submitted and are awaiting employer approval',
      });

      await fetchOrder();
      setVerified(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit results',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Order Not Found"
        description={error || 'The order you are looking for does not exist'}
      />
    );
  }

  const resultDocuments = order.documents?.filter((doc: any) => doc.kind === 'result') || [];
  const canSubmit = order.status === 'results_uploaded' || order.status === 'in_progress' || order.status === 'needs_correction';
  const isComplete = order.status === 'complete';
  const isPendingReview = order.status === 'pending_review';
  const needsCorrection = order.status === 'needs_correction';
  const latestReview = order.reviews && order.reviews.length > 0 ? order.reviews[0] : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Upload Results</h1>
        <p className="text-muted-foreground mt-1">Order {order.orderNumber}</p>
      </div>

      {/* Status Alert */}
      {isComplete && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <div>
            <p className="font-medium text-green-900">Order Complete</p>
            <p className="text-sm text-green-700">These results have been approved by the employer.</p>
          </div>
        </div>
      )}

      {isPendingReview && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-primary" />
          <div>
            <p className="font-medium text-primary">Awaiting Employer Approval</p>
            <p className="text-sm text-primary">
              Results have been submitted and are currently being reviewed by the employer.
            </p>
          </div>
        </div>
      )}

      {needsCorrection && latestReview && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-red-900">Results Rejected - Correction Required</p>
              <p className="text-sm text-red-700 mt-1">
                The employer has reviewed the results and requested corrections.
              </p>
              {latestReview.feedback && (
                <div className="mt-3 p-3 bg-card border border-red-200 rounded">
                  <p className="text-xs font-medium text-red-900 mb-1">Employer Feedback:</p>
                  <p className="text-sm text-foreground">{latestReview.feedback}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Reviewed by {latestReview.reviewer?.name || latestReview.reviewer?.email || 'Employer'} on{' '}
                    {format(new Date(latestReview.createdAt), 'PPp')}
                  </p>
                </div>
              )}
              <p className="text-sm text-red-700 mt-3">
                Please review the feedback, delete the incorrect documents, and upload corrected results.
              </p>
            </div>
          </div>
        </div>
      )}

      {resultDocuments.length > 0 && !isComplete && !isPendingReview && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
          <div>
            <p className="font-medium text-yellow-900">Review Required</p>
            <p className="text-sm text-yellow-700">
              Please review all uploaded documents and click "Submit Results" when ready.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Order Information */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <User className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Order Information</h2>
          </div>
          <dl className="space-y-2">
            <div>
              <dt className="text-sm text-muted-foreground">Candidate</dt>
              <dd className="font-medium">
                {order.candidate.firstName} {order.candidate.lastName}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Employer</dt>
              <dd className="font-medium">{order.organization.name}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Test Type</dt>
              <dd className="font-medium">{order.testType}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Status</dt>
              <dd>
                <StatusBadge status={order.status} />
              </dd>
            </div>
            {order.appointments && order.appointments.length > 0 && (
              <div>
                <dt className="text-sm text-muted-foreground">Site</dt>
                <dd className="font-medium">{order.appointments[0].site.name}</dd>
              </div>
            )}
          </dl>
        </Card>

        {/* Upload Form */}
        {!isComplete && !isPendingReview && (
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Upload className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Upload Results</h2>
            </div>
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <Label htmlFor="file-upload">
                  Result Document <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="file-upload"
                  type="file"
                  onChange={handleFileChange}
                  accept=".pdf,.jpg,.jpeg,.png"
                  required
                />
                <p className="text-sm text-muted-foreground mt-1">
                  PDF, JPG, or PNG files accepted
                </p>
              </div>

              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional notes about this document"
                  rows={3}
                />
              </div>

              <Button type="submit" disabled={uploading} className="w-full">
                {uploading ? 'Uploading...' : 'Upload Document'}
              </Button>
            </form>
          </Card>
        )}
      </div>

      {/* Uploaded Results */}
      {resultDocuments.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Uploaded Results</h2>
            </div>
            {!isComplete && resultDocuments.length > 0 && (
              <span className="text-sm text-muted-foreground">
                {resultDocuments.length} document{resultDocuments.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="space-y-2">
            {resultDocuments.map((doc: any) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div>
                  <p className="font-medium">{doc.fileName}</p>
                  <p className="text-sm text-muted-foreground">
                    Uploaded {doc.uploadedAt ? format(new Date(doc.uploadedAt), 'PPP') : 'Recently'}
                  </p>
                  {doc.notes && (
                    <p className="text-sm text-muted-foreground mt-1">{doc.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownload(doc.id, doc.fileName)}
                  >
                    Download
                  </Button>
                  {!isComplete && !isPendingReview && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(doc.id)}
                      disabled={deleting === doc.id}
                    >
                      {deleting === doc.id ? (
                        'Deleting...'
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4" />
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Submit Results Section */}
          {!isComplete && !isPendingReview && resultDocuments.length > 0 && (
            <div className="mt-6 pt-6 border-t space-y-4">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="verify"
                  checked={verified}
                  onChange={(e) => setVerified(e.target.checked)}
                  className="mt-1"
                />
                <label htmlFor="verify" className="text-sm">
                  <span className="font-medium">I verify that:</span>
                  <ul className="list-disc list-inside mt-1 text-muted-foreground">
                    <li>All uploaded documents are correct and complete</li>
                    <li>The results match the candidate and test type</li>
                    <li>I have reviewed all information for accuracy</li>
                  </ul>
                </label>
              </div>

              <Button
                onClick={handleSubmitResults}
                disabled={!verified || submitting}
                size="lg"
                className="w-full"
              >
                {submitting ? 'Submitting...' : 'Submit Results to Employer'}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                Once submitted, these results will be sent to the employer and cannot be modified.
              </p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
