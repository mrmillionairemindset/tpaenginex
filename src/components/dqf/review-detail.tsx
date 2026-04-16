'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { ArrowLeft, Calendar, CheckCircle2, Clock, User, Shield, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface ReviewDetailProps {
  reviewId: string;
  userRole: string;
}

interface Review {
  id: string;
  scheduledDate: string;
  reviewDate: string | null;
  status: string;
  notes: string | null;
  findings: string | null;
  signedOffBy: string | null;
  signedOffAt: string | null;
  person?: { id: string; firstName: string; lastName: string };
  clientOrg?: { id: string; name: string } | null;
}

const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  in_progress: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  overdue: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
};

export function ReviewDetail({ reviewId, userRole }: ReviewDetailProps) {
  const { toast } = useToast();
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [completeFindings, setCompleteFindings] = useState('');
  const [completeNotes, setCompleteNotes] = useState('');

  useEffect(() => {
    async function fetchReview() {
      try {
        const response = await fetch(`/api/dqf/reviews/${reviewId}`);
        if (response.ok) {
          const data = await response.json();
          const r = data.review;
          setReview(r);
          setNotes(r.notes || '');
        } else {
          setError('Review not found');
        }
      } catch {
        setError('Failed to load review');
      } finally {
        setLoading(false);
      }
    }

    fetchReview();
  }, [reviewId]);

  const patchReview = async (body: Record<string, unknown>) => {
    const response = await fetch(`/api/dqf/reviews/${reviewId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to update review');
    }
    const data = await response.json();
    return data.review;
  };

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      const updated = await patchReview({ notes });
      setReview(updated);
      toast({ title: 'Saved', description: 'Notes updated successfully' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSavingNotes(false);
    }
  };

  const handleStartReview = async () => {
    setUpdatingStatus(true);
    try {
      const updated = await patchReview({ status: 'in_progress' });
      setReview(updated);
      toast({ title: 'Review Started', description: 'Review is now in progress' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleCompleteReview = async () => {
    setUpdatingStatus(true);
    try {
      const updated = await patchReview({
        status: 'completed',
        findings: completeFindings,
        notes: completeNotes || notes,
      });
      setReview(updated);
      setNotes(updated.notes || '');
      setCompleteDialogOpen(false);
      toast({ title: 'Review Completed', description: 'Review has been signed off' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !review) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Review Not Found"
        description={error || 'The review you are looking for does not exist'}
      />
    );
  }

  const canEdit = userRole === 'tpa_admin' || userRole === 'tpa_staff' || userRole === 'tpa_records' || userRole === 'platform_admin';
  const canChangeStatus = userRole === 'tpa_admin' || userRole === 'tpa_staff' || userRole === 'platform_admin';

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link
        href="/dqf/reviews"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Reviews
      </Link>

      {/* Header card */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <User className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-2xl font-bold">
                {review.person ? `${review.person.firstName} ${review.person.lastName}` : 'Unknown Driver'}
              </h1>
            </div>
            <p className="text-muted-foreground">
              {review.clientOrg?.name || 'No Client'}
            </p>
          </div>
          <Badge className={statusColors[review.status] || statusColors.scheduled}>
            {review.status.replace(/_/g, ' ')}
          </Badge>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Scheduled:</span>
            <span className="font-medium">{format(new Date(review.scheduledDate), 'PPP')}</span>
          </div>
          {review.reviewDate && (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-muted-foreground">Completed:</span>
              <span className="font-medium">{format(new Date(review.reviewDate), 'PPP')}</span>
            </div>
          )}
        </div>
      </Card>

      {/* Status & Actions */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Status & Actions</h2>
        </div>

        {review.status === 'scheduled' && canChangeStatus && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">This review is scheduled. Start it when ready.</p>
            <Button onClick={handleStartReview} disabled={updatingStatus}>
              <Clock className="mr-2 h-4 w-4" />
              {updatingStatus ? 'Starting...' : 'Start Review'}
            </Button>
          </div>
        )}

        {review.status === 'overdue' && canChangeStatus && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-4 w-4" />
              <p className="text-sm font-medium">This review is overdue.</p>
            </div>
            <Button onClick={handleStartReview} disabled={updatingStatus}>
              <Clock className="mr-2 h-4 w-4" />
              {updatingStatus ? 'Starting...' : 'Start Review'}
            </Button>
          </div>
        )}

        {review.status === 'in_progress' && canChangeStatus && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Review is in progress. Complete it when finished.</p>
            <Button onClick={() => {
              setCompleteFindings(review.findings || '');
              setCompleteNotes(notes);
              setCompleteDialogOpen(true);
            }} disabled={updatingStatus}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {updatingStatus ? 'Completing...' : 'Complete Review'}
            </Button>
          </div>
        )}

        {review.status === 'completed' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <p className="text-sm font-medium">Review completed</p>
            </div>
            {review.signedOffBy && (
              <p className="text-sm text-muted-foreground">
                Signed off by: {review.signedOffBy}
                {review.signedOffAt && ` on ${format(new Date(review.signedOffAt), 'PPp')}`}
              </p>
            )}
          </div>
        )}

        {review.status === 'cancelled' && (
          <p className="text-sm text-muted-foreground">This review has been cancelled.</p>
        )}

        {!canChangeStatus && review.status !== 'completed' && review.status !== 'cancelled' && (
          <p className="text-sm text-muted-foreground">You do not have permission to change the review status.</p>
        )}
      </Card>

      {/* Findings section */}
      {(review.status === 'completed' || review.status === 'in_progress') && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Findings</h2>
          {review.findings ? (
            <p className="text-sm whitespace-pre-wrap">{review.findings}</p>
          ) : (
            <p className="text-sm text-muted-foreground">No findings recorded.</p>
          )}
        </Card>
      )}

      {/* Notes section */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Notes</h2>
        {canEdit ? (
          <div className="space-y-3">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this review..."
              rows={4}
            />
            <Button
              variant="outline"
              onClick={handleSaveNotes}
              disabled={savingNotes || notes === (review.notes || '')}
            >
              {savingNotes ? 'Saving...' : 'Save Notes'}
            </Button>
          </div>
        ) : (
          <p className="text-sm whitespace-pre-wrap">{review.notes || 'No notes.'}</p>
        )}
      </Card>

      {/* Complete Review Dialog */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Review</DialogTitle>
            <DialogDescription>
              Enter findings and any final notes before completing this review.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Findings</label>
              <Textarea
                value={completeFindings}
                onChange={(e) => setCompleteFindings(e.target.value)}
                placeholder="Enter review findings..."
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                value={completeNotes}
                onChange={(e) => setCompleteNotes(e.target.value)}
                placeholder="Additional notes..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCompleteReview} disabled={updatingStatus}>
              {updatingStatus ? 'Completing...' : 'Complete Review'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
