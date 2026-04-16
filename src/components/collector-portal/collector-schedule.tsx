'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Building2,
  Shield,
  AlertTriangle,
} from 'lucide-react';
import { format, isToday, isTomorrow } from 'date-fns';

interface ScheduledOrder {
  id: string;
  orderNumber: string;
  testType: string;
  serviceType: string;
  isDOT: boolean;
  priority: string;
  status: string;
  jobsiteLocation: string;
  scheduledFor: string | null;
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
  } | null;
}

interface ScheduledEvent {
  id: string;
  eventNumber: string;
  serviceType: string;
  location: string;
  scheduledDate: string;
  totalOrdered: number;
  totalCompleted: number;
  totalPending: number;
  status: string;
  clientOrg: {
    id: string;
    name: string;
  } | null;
}

function formatStatus(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function dayLabel(dateStr: string) {
  const date = new Date(dateStr);
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  return format(date, 'EEEE');
}

export function CollectorSchedule() {
  const [orders, setOrders] = useState<ScheduledOrder[]>([]);
  const [events, setEvents] = useState<ScheduledEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSchedule = useCallback(async () => {
    try {
      const res = await fetch('/api/collector-portal/schedule');
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch schedule');
      }
      const data = await res.json();
      setOrders(data.orders);
      setEvents(data.events);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch schedule');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-5 w-1/4 rounded bg-muted" />
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="h-4 w-full rounded bg-muted" />
              <div className="h-4 w-2/3 rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-destructive">
          <p>{error}</p>
        </CardContent>
      </Card>
    );
  }

  const hasItems = orders.length > 0 || events.length > 0;

  if (!hasItems) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Calendar className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold text-foreground">
            No scheduled items this week
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            When you have assignments scheduled for this week, they will appear
            here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Scheduled orders */}
      {orders.length > 0 && (
        <div>
          <h3 className="mb-3 text-lg font-semibold text-foreground">
            Orders ({orders.length})
          </h3>
          <div className="space-y-3">
            {orders.map((order) => (
              <Link
                key={order.id}
                href={`/collector-portal/${order.id}`}
                className="block"
              >
                <Card className="cursor-pointer hover:border-primary/50 hover:shadow-md">
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">
                            {order.orderNumber}
                          </span>
                          {order.isDOT && (
                            <Badge
                              variant="outline"
                              className="border-amber-500 text-amber-600 dark:text-amber-400"
                            >
                              <Shield className="mr-1 h-3 w-3" />
                              DOT
                            </Badge>
                          )}
                          {order.priority === 'urgent' && (
                            <Badge variant="destructive">
                              <AlertTriangle className="mr-1 h-3 w-3" />
                              Urgent
                            </Badge>
                          )}
                        </div>
                        {order.person && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <User className="h-3.5 w-3.5" />
                            <span>
                              {order.person.firstName}{' '}
                              {order.person.lastName}
                            </span>
                          </div>
                        )}
                        {order.clientOrg && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Building2 className="h-3.5 w-3.5" />
                            <span>{order.clientOrg.name}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" />
                          <span>{order.jobsiteLocation}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        {order.scheduledFor && (
                          <>
                            <p className="text-sm font-medium">
                              {dayLabel(order.scheduledFor)}
                            </p>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {format(
                                new Date(order.scheduledFor),
                                'h:mm a'
                              )}
                            </div>
                          </>
                        )}
                        <Badge
                          variant="secondary"
                          className="mt-1"
                        >
                          {formatStatus(order.status)}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Scheduled events */}
      {events.length > 0 && (
        <div>
          <h3 className="mb-3 text-lg font-semibold text-foreground">
            Events ({events.length})
          </h3>
          <div className="space-y-3">
            {events.map((event) => (
              <Card key={event.id}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">
                          {event.eventNumber}
                        </span>
                        <Badge variant="secondary">
                          {formatStatus(event.serviceType)}
                        </Badge>
                      </div>
                      {event.clientOrg && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Building2 className="h-3.5 w-3.5" />
                          <span>{event.clientOrg.name}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        <span>{event.location}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {event.totalCompleted} / {event.totalOrdered} completed
                        {event.totalPending > 0 && (
                          <span className="ml-2 text-amber-600">
                            ({event.totalPending} pending)
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {dayLabel(event.scheduledDate)}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {format(
                          new Date(event.scheduledDate),
                          'MMM d, h:mm a'
                        )}
                      </div>
                      <Badge variant="secondary" className="mt-1">
                        {formatStatus(event.status)}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
