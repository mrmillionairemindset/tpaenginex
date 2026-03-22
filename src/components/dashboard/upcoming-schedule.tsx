'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { usePolling } from '@/hooks/use-polling';
import { format, isToday, isTomorrow, startOfWeek, endOfWeek } from 'date-fns';
import { CalendarDays, FileText, Target, Clock } from 'lucide-react';
import Link from 'next/link';

interface ScheduledOrder {
  id: string;
  orderNumber: string;
  status: string;
  serviceType: string;
  testType: string;
  isDOT: boolean;
  priority: string;
  scheduledFor: string;
  clientLabel?: string | null;
  candidate: { firstName: string; lastName: string } | null;
  collector: { id: string; firstName: string; lastName: string } | null;
  clientOrg: { id: string; name: string } | null;
}

interface ScheduledEvent {
  id: string;
  eventNumber: string;
  status: string;
  serviceType: string;
  scheduledDate: string;
  totalOrdered: number;
  totalCompleted: number;
  totalPending: number;
  location: string;
  clientOrg: { id: string; name: string } | null;
  collector: { id: string; firstName: string; lastName: string } | null;
}

interface FollowUp {
  id: string;
  companyName: string;
  contactName: string | null;
  stage: string;
  nextFollowUpAt: string;
  owner: { id: string; name: string | null } | null;
}

interface ScheduleItem {
  type: 'order' | 'event' | 'followup';
  id: string;
  title: string;
  subtitle: string;
  time: Date;
  href: string;
  priority?: string;
  isDOT?: boolean;
  status: string;
}

function dayLabel(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  return format(date, 'EEEE, MMM d');
}

export function UpcomingSchedule() {
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSchedule = useCallback(async () => {
    try {
      const now = new Date();
      const start = startOfWeek(now, { weekStartsOn: 1 });
      const end = endOfWeek(now, { weekStartsOn: 1 });

      const response = await fetch(
        `/api/schedule?start=${start.toISOString()}&end=${end.toISOString()}`
      );
      if (!response.ok) return;

      const data = await response.json();
      const combined: ScheduleItem[] = [];

      for (const o of data.orders as ScheduledOrder[]) {
        combined.push({
          type: 'order',
          id: o.id,
          title: `Order ${o.orderNumber}`,
          subtitle: [
            o.candidate ? `${o.candidate.firstName} ${o.candidate.lastName}` : '',
            o.clientOrg?.name || o.clientLabel || '',
          ].filter(Boolean).join(' — '),
          time: new Date(o.scheduledFor),
          href: `/orders/${o.id}`,
          priority: o.priority,
          isDOT: o.isDOT,
          status: o.status,
        });
      }

      for (const e of data.events as ScheduledEvent[]) {
        combined.push({
          type: 'event',
          id: e.id,
          title: `Event ${e.eventNumber}`,
          subtitle: [
            e.clientOrg?.name || '',
            e.location || '',
            `${e.totalOrdered} ordered`,
          ].filter(Boolean).join(' — '),
          time: new Date(e.scheduledDate),
          href: `/events/${e.id}`,
          status: e.status,
        });
      }

      for (const f of data.followUps as FollowUp[]) {
        combined.push({
          type: 'followup',
          id: f.id,
          title: `Follow up: ${f.companyName}`,
          subtitle: [
            f.contactName || '',
            f.owner?.name ? `Owned by ${f.owner.name}` : '',
          ].filter(Boolean).join(' — '),
          time: new Date(f.nextFollowUpAt),
          href: `/leads/${f.id}`,
          status: f.stage,
        });
      }

      combined.sort((a, b) => a.time.getTime() - b.time.getTime());
      setItems(combined);
    } catch (error) {
      console.error('Failed to fetch schedule:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  usePolling(fetchSchedule, 30000);

  // Group by day
  const grouped = new Map<string, ScheduleItem[]>();
  for (const item of items) {
    const key = format(item.time, 'yyyy-MM-dd');
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(item);
  }

  const typeIcon = {
    order: <FileText className="h-4 w-4 text-blue-500" />,
    event: <CalendarDays className="h-4 w-4 text-purple-500" />,
    followup: <Target className="h-4 w-4 text-orange-500" />,
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="h-48 animate-pulse rounded bg-muted" />
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="p-6 text-center text-muted-foreground">
        <CalendarDays className="h-10 w-10 mx-auto mb-2 opacity-30" />
        <p>Nothing scheduled this week</p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">This Week</h3>
        <Link
          href="/schedule"
          className="text-sm text-primary hover:underline"
        >
          View full schedule
        </Link>
      </div>

      <div className="space-y-5">
        {[...grouped.entries()].map(([dateKey, dayItems]) => (
          <div key={dateKey}>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">
              {dayLabel(new Date(dateKey + 'T12:00:00'))}
            </h4>
            <div className="space-y-2">
              {dayItems.map((item) => (
                <Link
                  key={`${item.type}-${item.id}`}
                  href={item.href}
                  className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="mt-0.5">{typeIcon[item.type]}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {item.title}
                      </span>
                      {item.priority === 'urgent' && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                          Urgent
                        </Badge>
                      )}
                      {item.isDOT && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          DOT
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.subtitle}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                    <Clock className="h-3 w-3" />
                    {format(item.time, 'h:mm a')}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
