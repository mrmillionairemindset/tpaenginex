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

interface PersonDetailsProps {
  personId: string;
  userRole?: string;
}

export function CandidateDetails({ personId, userRole = '' }: PersonDetailsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [person, setPerson] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const isAdmin = userRole === 'tpa_admin' || userRole === 'platform_admin';

  useEffect(() => {
    async function fetchPerson() {
      try {
        const response = await fetch(`/api/candidates/${personId}`);
        if (response.ok) {
          const data = await response.json();
          setPerson(data.person || data.candidate);
        } else {
          setError('Person not found');
        }
      } catch (err) {
        setError('Failed to load person');
      } finally {
        setLoading(false);
      }
    }

    fetchPerson();
  }, [personId]);

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
        title="Person Not Found"
        description={error || 'The person you are looking for does not exist'}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {person.firstName} {person.lastName}
          </h1>
          <p className="text-muted-foreground mt-1">
            Added {format(new Date(person.createdAt), 'PPP')}
          </p>
        </div>
        {isAdmin && (
          <Button
            variant="outline"
            size="sm"
            className="border-destructive text-destructive hover:bg-destructive/10"
            disabled={deleting}
            onClick={async () => {
              if (!confirm(`Delete ${person.firstName} ${person.lastName}? This cannot be undone.`)) return;
              setDeleting(true);
              try {
                const res = await fetch(`/api/candidates/${personId}`, { method: 'DELETE' });
                if (res.ok) {
                  toast({ title: 'Person Deleted' });
                  router.push('/candidates');
                } else {
                  const err = await res.json();
                  toast({ title: 'Error', description: err.error, variant: 'destructive' });
                }
              } catch {
                toast({ title: 'Error', description: 'Failed to delete person', variant: 'destructive' });
              } finally {
                setDeleting(false);
              }
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {deleting ? 'Deleting...' : 'Delete Person'}
          </Button>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Person Information */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <User className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Contact Information</h2>
          </div>
          <dl className="space-y-2">
            <div>
              <dt className="text-sm text-muted-foreground">Name</dt>
              <dd className="font-medium">
                {person.firstName} {person.lastName}
              </dd>
            </div>
            {person.email && (
              <div>
                <dt className="text-sm text-muted-foreground">Email</dt>
                <dd className="font-medium">{person.email}</dd>
              </div>
            )}
            {person.phone && (
              <div>
                <dt className="text-sm text-muted-foreground">Phone</dt>
                <dd className="font-medium">{person.phone}</dd>
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
            {person.address && (
              <div>
                <dt className="text-sm text-muted-foreground">Street Address</dt>
                <dd className="font-medium">{person.address}</dd>
              </div>
            )}
            {person.city && (
              <div>
                <dt className="text-sm text-muted-foreground">City</dt>
                <dd className="font-medium">{person.city}</dd>
              </div>
            )}
            {person.state && (
              <div>
                <dt className="text-sm text-muted-foreground">State</dt>
                <dd className="font-medium">{person.state}</dd>
              </div>
            )}
            {person.zip && (
              <div>
                <dt className="text-sm text-muted-foreground">ZIP Code</dt>
                <dd className="font-medium">{person.zip}</dd>
              </div>
            )}
            {!person.address &&
              !person.city &&
              !person.state &&
              !person.zip && (
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
            {person.orders.length}{' '}
            {person.orders.length === 1 ? 'order' : 'orders'}
          </span>
        </div>

        {person.orders.length > 0 ? (
          <div className="space-y-3">
            {person.orders.map((order: any) => (
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
            description="This person has no screening orders"
          />
        )}
      </Card>
    </div>
  );
}
