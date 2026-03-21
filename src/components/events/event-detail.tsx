'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/use-toast';
import { AlertCircle, CalendarDays, MapPin, UserCheck, Users, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';

interface EventDetailProps {
  eventId: string;
  userRole: string;
}

export function EventDetail({ eventId, userRole }: EventDetailProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    async function fetchEvent() {
      try {
        const response = await fetch(`/api/events/${eventId}`);
        if (response.ok) {
          const data = await response.json();
          setEvent(data.event);
        } else {
          setError('Event not found');
        }
      } catch (err) {
        setError('Failed to load event');
      } finally {
        setLoading(false);
      }
    }

    fetchEvent();
  }, [eventId]);

  const handleMarkComplete = async () => {
    setCompleting(true);
    try {
      const response = await fetch(`/api/events/${eventId}/complete`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        setEvent(data.event);
        toast({
          title: 'Event Complete',
          description: 'Event has been marked as complete',
        });
      } else {
        const data = await response.json();
        toast({
          title: 'Error',
          description: data.error || 'Failed to complete event',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to complete event',
        variant: 'destructive',
      });
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !event) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Event Not Found"
        description={error || 'The event you are looking for does not exist'}
      />
    );
  }

  const canComplete = (userRole === 'tpa_admin' || userRole === 'tpa_staff' || userRole === 'platform_admin')
    && event.status !== 'complete' && event.status !== 'cancelled';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{event.eventNumber}</h1>
          <p className="text-muted-foreground mt-1">
            {event.clientOrg?.name || event.clientLabel || 'No Client'} &mdash; {format(new Date(event.scheduledDate), 'PPP')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={event.status} />
          {canComplete && (
            <Button onClick={handleMarkComplete} disabled={completing}>
              <CheckCircle className="mr-2 h-4 w-4" />
              {completing ? 'Completing...' : 'Mark Complete'}
            </Button>
          )}
        </div>
      </div>

      {/* Progress Counter */}
      <Card className="p-6">
        <div className="grid grid-cols-3 gap-6 text-center">
          <div>
            <p className="text-3xl font-bold text-green-600">{event.totalCompleted}</p>
            <p className="text-sm text-muted-foreground">Completed</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-amber-600">{event.totalPending}</p>
            <p className="text-sm text-muted-foreground">Pending</p>
          </div>
          <div>
            <p className="text-3xl font-bold">{event.totalOrdered}</p>
            <p className="text-sm text-muted-foreground">Total Ordered</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Event Details */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Event Details</h2>
          </div>
          <dl className="space-y-2">
            <div>
              <dt className="text-sm text-muted-foreground">Service Type</dt>
              <dd className="font-medium capitalize">{event.serviceType.replace(/_/g, ' ')}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Scheduled Date</dt>
              <dd className="font-medium">{format(new Date(event.scheduledDate), 'PPpp')}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Location</dt>
              <dd className="font-medium">{event.location}</dd>
            </div>
            {event.notes && (
              <div>
                <dt className="text-sm text-muted-foreground">Notes</dt>
                <dd className="font-medium">{event.notes}</dd>
              </div>
            )}
            {event.kitMailedAt && (
              <div>
                <dt className="text-sm text-muted-foreground">Kits Mailed</dt>
                <dd className="font-medium">{format(new Date(event.kitMailedAt), 'PPp')}</dd>
              </div>
            )}
          </dl>
        </Card>

        {/* Collector */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <UserCheck className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Assigned Collector</h2>
          </div>
          {event.collector ? (
            <dl className="space-y-2">
              <div>
                <dt className="text-sm text-muted-foreground">Name</dt>
                <dd className="font-medium">{event.collector.firstName} {event.collector.lastName}</dd>
              </div>
              {event.collector.email && (
                <div>
                  <dt className="text-sm text-muted-foreground">Email</dt>
                  <dd className="font-medium">{event.collector.email}</dd>
                </div>
              )}
              {event.collector.phone && (
                <div>
                  <dt className="text-sm text-muted-foreground">Phone</dt>
                  <dd className="font-medium">{event.collector.phone}</dd>
                </div>
              )}
              {event.collectorConfirmedAt && (
                <div>
                  <dt className="text-sm text-muted-foreground">Confirmed At</dt>
                  <dd className="font-medium text-green-600">
                    {format(new Date(event.collectorConfirmedAt), 'PPp')}
                  </dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-muted-foreground">No collector assigned yet</p>
          )}
        </Card>
      </div>

      {/* Child Orders */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Linked Orders ({event.orders?.length || 0})</h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/orders/new?eventId=${event.id}`)}
          >
            Add Donor
          </Button>
        </div>
        {event.orders && event.orders.length > 0 ? (
          <div className="space-y-2">
            {event.orders.map((order: any) => (
              <div
                key={order.id}
                className="flex items-center justify-between p-3 border rounded hover:bg-muted cursor-pointer"
                onClick={() => router.push(`/orders/${order.id}`)}
              >
                <div>
                  <p className="font-medium">{order.orderNumber}</p>
                  {order.candidate && (
                    <p className="text-sm text-muted-foreground">
                      {order.candidate.firstName} {order.candidate.lastName}
                    </p>
                  )}
                </div>
                <StatusBadge status={order.status} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No orders linked to this event yet. Click "Add Donor" to create one.</p>
        )}
      </Card>
    </div>
  );
}
