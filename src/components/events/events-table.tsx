'use client';

import { useEffect, useState, useCallback } from 'react';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { usePolling } from '@/hooks/use-polling';

interface Event {
  id: string;
  eventNumber: string;
  serviceType: string;
  status: string;
  scheduledDate: string;
  totalOrdered: number;
  totalCompleted: number;
  totalPending: number;
  clientOrg: {
    id: string;
    name: string;
  } | null;
  clientLabel?: string | null;
  collector: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
}

export function EventsTable() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    try {
      const response = await fetch('/api/events');
      if (response.ok) {
        const data = await response.json();
        setEvents(data.events);
      }
    } catch (error) {
      console.error('Failed to fetch events:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  usePolling(fetchEvents);

  const columns = [
    {
      header: 'Event #',
      accessor: 'eventNumber' as const,
    },
    {
      header: 'Client',
      accessor: (e: Event) => e.clientOrg?.name || e.clientLabel || 'N/A',
    },
    {
      header: 'Type',
      accessor: (e: Event) => (
        <Badge variant="secondary" className="capitalize">
          {e.serviceType.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      header: 'Date',
      accessor: (e: Event) => format(new Date(e.scheduledDate), 'MMM d, yyyy'),
    },
    {
      header: 'Collector',
      accessor: (e: Event) =>
        e.collector
          ? `${e.collector.firstName} ${e.collector.lastName}`
          : <span className="text-muted-foreground">Unassigned</span>,
    },
    {
      header: 'Progress',
      accessor: (e: Event) => (
        <span className="text-sm font-medium">
          <span className="text-green-600">{e.totalCompleted}</span>
          {' / '}
          <span>{e.totalOrdered}</span>
          {e.totalPending > 0 && (
            <span className="text-amber-600 ml-1">({e.totalPending} pending)</span>
          )}
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: (e: Event) => <StatusBadge status={e.status} />,
    },
  ];

  return (
    <DataTable
      data={events}
      columns={columns}
      loading={loading}
      emptyMessage="No events found. Create your first batch event to get started."
      onRowClick={(event) => router.push(`/events/${event.id}`)}
    />
  );
}
