'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/use-toast';
import { AlertCircle, User, MapPin, FileText, ClipboardList, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';

interface CandidateDetailsProps {
  candidateId: string;
  userRole?: string;
}

export function CandidateDetails({ candidateId, userRole = '' }: CandidateDetailsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [candidate, setCandidate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const isAdmin = userRole === 'tpa_admin' || userRole === 'platform_admin';

  useEffect(() => {
    async function fetchCandidate() {
      try {
        const response = await fetch(`/api/candidates/${candidateId}`);
        if (response.ok) {
          const data = await response.json();
          setCandidate(data.candidate);
        } else {
          setError('Candidate not found');
        }
      } catch (err) {
        setError('Failed to load candidate');
      } finally {
        setLoading(false);
      }
    }

    fetchCandidate();
  }, [candidateId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !candidate) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Candidate Not Found"
        description={error || 'The candidate you are looking for does not exist'}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {candidate.firstName} {candidate.lastName}
          </h1>
          <p className="text-muted-foreground mt-1">
            Added {format(new Date(candidate.createdAt), 'PPP')}
          </p>
        </div>
        {isAdmin && (
          <Button
            variant="outline"
            size="sm"
            className="border-destructive text-destructive hover:bg-destructive/10"
            disabled={deleting}
            onClick={async () => {
              if (!confirm(`Delete ${candidate.firstName} ${candidate.lastName}? This cannot be undone.`)) return;
              setDeleting(true);
              try {
                const res = await fetch(`/api/candidates/${candidateId}`, { method: 'DELETE' });
                if (res.ok) {
                  toast({ title: 'Candidate Deleted' });
                  router.push('/candidates');
                } else {
                  const err = await res.json();
                  toast({ title: 'Error', description: err.error, variant: 'destructive' });
                }
              } catch {
                toast({ title: 'Error', description: 'Failed to delete candidate', variant: 'destructive' });
              } finally {
                setDeleting(false);
              }
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {deleting ? 'Deleting...' : 'Delete Candidate'}
          </Button>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Candidate Information */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <User className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Contact Information</h2>
          </div>
          <dl className="space-y-2">
            <div>
              <dt className="text-sm text-muted-foreground">Name</dt>
              <dd className="font-medium">
                {candidate.firstName} {candidate.lastName}
              </dd>
            </div>
            {candidate.email && (
              <div>
                <dt className="text-sm text-muted-foreground">Email</dt>
                <dd className="font-medium">{candidate.email}</dd>
              </div>
            )}
            {candidate.phone && (
              <div>
                <dt className="text-sm text-muted-foreground">Phone</dt>
                <dd className="font-medium">{candidate.phone}</dd>
              </div>
            )}
          </dl>
        </Card>

        {/* Address Information */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Address</h2>
          </div>
          <dl className="space-y-2">
            {candidate.address && (
              <div>
                <dt className="text-sm text-muted-foreground">Street Address</dt>
                <dd className="font-medium">{candidate.address}</dd>
              </div>
            )}
            {candidate.city && (
              <div>
                <dt className="text-sm text-muted-foreground">City</dt>
                <dd className="font-medium">{candidate.city}</dd>
              </div>
            )}
            {candidate.state && (
              <div>
                <dt className="text-sm text-muted-foreground">State</dt>
                <dd className="font-medium">{candidate.state}</dd>
              </div>
            )}
            {candidate.zip && (
              <div>
                <dt className="text-sm text-muted-foreground">ZIP Code</dt>
                <dd className="font-medium">{candidate.zip}</dd>
              </div>
            )}
            {!candidate.address &&
              !candidate.city &&
              !candidate.state &&
              !candidate.zip && (
                <p className="text-sm text-muted-foreground">No address on file</p>
              )}
          </dl>
        </Card>
      </div>

      {/* Order History */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Order History</h2>
          </div>
          <span className="text-sm text-muted-foreground">
            {candidate.orders.length}{' '}
            {candidate.orders.length === 1 ? 'order' : 'orders'}
          </span>
        </div>

        {candidate.orders.length > 0 ? (
          <div className="space-y-3">
            {candidate.orders.map((order: any) => (
              <div
                key={order.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted cursor-pointer transition-colors"
                onClick={() => router.push(`/orders/${order.id}`)}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <p className="font-medium">{order.orderNumber}</p>
                    <StatusBadge status={order.status} />
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{order.testType}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(order.createdAt), 'PPP')}
                  </p>
                </div>
                <Button variant="ghost" size="sm">
                  View Details
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={FileText}
            title="No Orders Yet"
            description="This candidate has no screening orders"
          />
        )}
      </Card>
    </div>
  );
}
