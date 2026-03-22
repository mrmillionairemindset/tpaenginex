'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePolling } from '@/hooks/use-polling';
import {
  format,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  isToday,
  isSameDay,
  eachDayOfInterval,
} from 'date-fns';
import {
  CalendarDays,
  FileText,
  Target,
  Clock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
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

const statusColors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  scheduled: 'bg-indigo-100 text-indigo-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  complete: 'bg-green-100 text-green-800',
  partially_complete: 'bg-amber-100 text-amber-800',
};

const typeConfig = {
  order: { icon: FileText, color: 'text-blue-500', bg: 'bg-blue-50' },
  event: { icon: CalendarDays, color: 'text-purple-500', bg: 'bg-purple-50' },
  followup: { icon: Target, color: 'text-orange-500', bg: 'bg-orange-50' },
};

export function ScheduleView() {
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const fetchSchedule = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/schedule?start=${weekStart.toISOString()}&end=${weekEnd.toISOString()}`
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
            o.collector ? `Collector: ${o.collector.firstName} ${o.collector.lastName}` : '',
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
            `${e.totalOrdered} ordered, ${e.totalCompleted} done`,
            e.collector ? `Collector: ${e.collector.firstName} ${e.collector.lastName}` : '',
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
          title: f.companyName,
          subtitle: [
            f.contactName || '',
            f.owner?.name ? `Owned by ${f.owner.name}` : '',
            f.stage.replace(/_/g, ' '),
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
  }, [weekStart, weekEnd]);

  useEffect(() => {
    setLoading(true);
    fetchSchedule();
  }, [fetchSchedule]);

  usePolling(fetchSchedule, 30000);

  const goToThisWeek = () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const goPrev = () => setWeekStart((prev) => subWeeks(prev, 1));
  const goNext = () => setWeekStart((prev) => addWeeks(prev, 1));

  const isCurrentWeek = isSameDay(weekStart, startOfWeek(new Date(), { weekStartsOn: 1 }));

  // Count items per type
  const orderCount = items.filter((i) => i.type === 'order').length;
  const eventCount = items.filter((i) => i.type === 'event').length;
  const followUpCount = items.filter((i) => i.type === 'followup').length;

  return (
    <div className="space-y-4">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goPrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={goNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isCurrentWeek && (
            <Button variant="ghost" size="sm" onClick={goToThisWeek}>
              This Week
            </Button>
          )}
          <span className="text-sm font-medium ml-2">
            {format(weekStart, 'MMM d')} — {format(weekEnd, 'MMM d, yyyy')}
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <FileText className="h-3.5 w-3.5 text-blue-500" /> {orderCount} orders
          </span>
          <span className="flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5 text-purple-500" /> {eventCount} events
          </span>
          <span className="flex items-center gap-1">
            <Target className="h-3.5 w-3.5 text-orange-500" /> {followUpCount} follow-ups
          </span>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 rounded-lg border bg-card animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {days.map((day) => {
            const dayItems = items.filter((item) => isSameDay(item.time, day));
            const today = isToday(day);

            return (
              <Card
                key={day.toISOString()}
                className={`p-4 ${today ? 'ring-2 ring-primary/30' : ''}`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <h3
                    className={`text-sm font-semibold ${
                      today ? 'text-primary' : 'text-foreground'
                    }`}
                  >
                    {format(day, 'EEEE, MMMM d')}
                  </h3>
                  {today && (
                    <Badge variant="default" className="text-[10px] px-1.5 py-0">
                      Today
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {dayItems.length === 0
                      ? 'No items'
                      : `${dayItems.length} item${dayItems.length > 1 ? 's' : ''}`}
                  </span>
                </div>

                {dayItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic pl-1">
                    Nothing scheduled
                  </p>
                ) : (
                  <div className="space-y-2">
                    {dayItems.map((item) => {
                      const config = typeConfig[item.type];
                      const Icon = config.icon;
                      const statusClass =
                        statusColors[item.status] || 'bg-gray-100 text-gray-800';

                      return (
                        <Link
                          key={`${item.type}-${item.id}`}
                          href={item.href}
                          className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                        >
                          <div
                            className={`mt-0.5 p-1.5 rounded ${config.bg}`}
                          >
                            <Icon className={`h-4 w-4 ${config.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">
                                {item.title}
                              </span>
                              <Badge
                                variant="secondary"
                                className={`text-[10px] px-1.5 py-0 ${statusClass}`}
                              >
                                {item.status.replace(/_/g, ' ')}
                              </Badge>
                              {item.priority === 'urgent' && (
                                <Badge
                                  variant="destructive"
                                  className="text-[10px] px-1.5 py-0"
                                >
                                  Urgent
                                </Badge>
                              )}
                              {item.isDOT && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0"
                                >
                                  DOT
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {item.subtitle}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                            <Clock className="h-3 w-3" />
                            {format(item.time, 'h:mm a')}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
