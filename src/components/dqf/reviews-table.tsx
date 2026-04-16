'use client';

import { useEffect, useState, useCallback } from 'react';
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
import { Plus } from 'lucide-react';
import { format } from 'date-fns';

interface Review {
  id: string;
  scheduledDate: string;
  reviewDate: string | null;
  status: string;
  notes: string | null;
  person?: { id: string; firstName: string; lastName: string };
  clientOrg?: { id: string; name: string } | null;
  signedOffByUser?: { id: string; name: string | null } | null;
}

const statusStyles: Record<string, { className: string; label: string }> = {
  scheduled: { className: 'bg-blue-100 text-blue-800', label: 'Scheduled' },
  in_progress: { className: 'bg-amber-100 text-amber-800', label: 'In Progress' },
  completed: { className: 'bg-green-100 text-green-800', label: 'Completed' },
  overdue: { className: 'bg-red-100 text-red-800', label: 'Overdue' },
  cancelled: { className: 'bg-gray-100 text-gray-800', label: 'Cancelled' },
};

export function ReviewsTable() {
  const { toast } = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    personId: '',
    clientOrgId: '',
    scheduledDate: '',
    notes: '',
  });

  const fetchReviews = useCallback(async () => {
    try {
      const response = await fetch('/api/dqf/reviews');
      if (response.ok) {
        const data = await response.json();
        setReviews(data.reviews || []);
      }
    } catch (error) {
      console.error('Failed to fetch reviews:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  usePolling(fetchReviews);

  const resetForm = () => {
    setFormData({
      personId: '',
      clientOrgId: '',
      scheduledDate: '',
      notes: '',
    });
  };

  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch('/api/dqf/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personId: formData.personId,
          clientOrgId: formData.clientOrgId || undefined,
          scheduledDate: formData.scheduledDate,
          notes: formData.notes || undefined,
        }),
      });

      if (response.ok) {
        toast({
          title: 'Review Scheduled',
          description: 'Annual review has been scheduled successfully',
        });
        setShowAddDialog(false);
        resetForm();
        fetchReviews();
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to schedule review',
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
      header: 'Driver',
      accessor: (review: Review) =>
        review.person
          ? `${review.person.firstName} ${review.person.lastName}`
          : '-',
    },
    {
      header: 'Client',
      accessor: (review: Review) => review.clientOrg?.name || '-',
    },
    {
      header: 'Scheduled Date',
      accessor: (review: Review) =>
        review.scheduledDate
          ? format(new Date(review.scheduledDate), 'MMM d, yyyy')
          : '-',
    },
    {
      header: 'Status',
      accessor: (review: Review) => {
        const style = statusStyles[review.status] || {
          className: 'bg-gray-100 text-gray-800',
          label: review.status,
        };
        return (
          <Badge className={`${style.className} font-medium`} variant="secondary">
            {style.label}
          </Badge>
        );
      },
    },
    {
      header: 'Signed Off',
      accessor: (review: Review) => review.signedOffByUser?.name || '-',
    },
  ];

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Schedule Review
        </Button>
      </div>

      <DataTable
        data={reviews}
        columns={columns}
        loading={loading}
        emptyMessage="No annual reviews found. Schedule your first review to get started."
      />

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Schedule Annual Review</DialogTitle>
            <DialogDescription>
              Schedule a new annual review for a driver.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddReview}>
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="personId">
                  Person ID <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="personId"
                  required
                  placeholder="Enter driver person ID"
                  value={formData.personId}
                  onChange={(e) =>
                    setFormData({ ...formData, personId: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="clientOrgId">Client Org ID</Label>
                <Input
                  id="clientOrgId"
                  placeholder="Optional client organization ID"
                  value={formData.clientOrgId}
                  onChange={(e) =>
                    setFormData({ ...formData, clientOrgId: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="scheduledDate">
                  Scheduled Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="scheduledDate"
                  type="date"
                  required
                  value={formData.scheduledDate}
                  onChange={(e) =>
                    setFormData({ ...formData, scheduledDate: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  rows={3}
                  placeholder="Optional notes about this review"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
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
                {submitting ? 'Scheduling...' : 'Schedule Review'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
