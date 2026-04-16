'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  FileText,
  RefreshCw,
  TestTube,
  ClipboardCheck,
  PenLine,
  Paperclip,
  UserCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { format } from 'date-fns';

type TimelineEventType =
  | 'order_created'
  | 'status_changed'
  | 'specimen_collected'
  | 'result_reported'
  | 'signature_added'
  | 'document_uploaded'
  | 'collector_assigned';

interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  timestamp: string;
  description: string;
  actor?: string | null;
}

interface OrderTimelineProps {
  orderId: string;
}

const ICON_MAP: Record<TimelineEventType, React.ComponentType<{ className?: string }>> = {
  order_created: FileText,
  status_changed: RefreshCw,
  specimen_collected: TestTube,
  result_reported: ClipboardCheck,
  signature_added: PenLine,
  document_uploaded: Paperclip,
  collector_assigned: UserCheck,
};

export function OrderTimeline({ orderId }: OrderTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/orders/${orderId}/timeline`);
        if (!res.ok) {
          if (!cancelled) setError('Failed to load timeline');
          return;
        }
        const data = await res.json();
        if (!cancelled) setEvents(data.events || []);
      } catch {
        if (!cancelled) setError('Failed to load timeline');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  return (
    <Card className="p-6">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between"
      >
        <h2 className="text-lg font-semibold">Order Timeline</h2>
        {expanded ? (
          <ChevronUp className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="mt-4">
          {loading ? (
            <LoadingSpinner />
          ) : error ? (
            <p className="text-sm text-muted-foreground">{error}</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events yet.</p>
          ) : (
            <div className="relative pl-8 border-l-2 border-muted space-y-6">
              {events.map((event) => {
                const Icon = ICON_MAP[event.type] || FileText;
                return (
                  <div key={event.id} className="relative">
                    <div className="absolute -left-[2.1rem] w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium">{event.description}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(event.timestamp), 'PPp')}
                        {event.actor ? ` • ${event.actor}` : ''}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
