'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
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
  isPast,
} from 'date-fns';
import {
  CalendarDays,
  FileText,
  Target,
  Clock,
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

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
  new: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  scheduled: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  in_progress: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  complete: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  partially_complete: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
};

const typeConfig = {
  order: { icon: FileText, color: 'text-blue-500' },
  event: { icon: CalendarDays, color: 'text-purple-500' },
  followup: { icon: Target, color: 'text-orange-500' },
};

export function ScheduleView() {
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);

  const weekEnd = useMemo(() => endOfWeek(weekStart, { weekStartsOn: 1 }), [weekStart]);
  const days = useMemo(() => eachDayOfInterval({ start: weekStart, end: weekEnd }), [weekStart, weekEnd]);

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
            o.collector ? `${o.collector.firstName} ${o.collector.lastName}` : '',
          ].filter(Boolean).join(' \u00b7 '),
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
            `${e.totalCompleted}/${e.totalOrdered} done`,
          ].filter(Boolean).join(' \u00b7 '),
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
            f.stage.replace(/_/g, ' '),
          ].filter(Boolean).join(' \u00b7 '),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  usePolling(fetchSchedule, 30000);

  const goToThisWeek = () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const goPrev = () => setWeekStart((prev) => subWeeks(prev, 1));
  const goNext = () => setWeekStart((prev) => addWeeks(prev, 1));

  const isCurrentWeek = isSameDay(weekStart, startOfWeek(new Date(), { weekStartsOn: 1 }));

  const orderCount = items.filter((i) => i.type === 'order').length;
  const eventCount = items.filter((i) => i.type === 'event').length;
  const followUpCount = items.filter((i) => i.type === 'followup').length;
  const totalCount = items.length;

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <Card className="p-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goPrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold ml-1">
              {format(weekStart, 'MMM d')} — {format(weekEnd, 'MMM d, yyyy')}
            </span>
            {!isCurrentWeek && (
              <Button variant="outline" size="sm" className="h-7 text-xs ml-1" onClick={goToThisWeek}>
                Today
              </Button>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {orderCount > 0 && (
                <span className="flex items-center gap-1">
                  <FileText className="h-3 w-3 text-blue-500" /> {orderCount}
                </span>
              )}
              {eventCount > 0 && (
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3 w-3 text-purple-500" /> {eventCount}
                </span>
              )}
              {followUpCount > 0 && (
                <span className="flex items-center gap-1">
                  <Target className="h-3 w-3 text-orange-500" /> {followUpCount}
                </span>
              )}
              {totalCount === 0 && !loading && (
                <span>No items this week</span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                <Link href="/orders/new">
                  <Plus className="h-3 w-3 mr-1" /> Order
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                <Link href="/events/new">
                  <Plus className="h-3 w-3 mr-1" /> Event
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="space-y-1">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="h-12 rounded-lg border bg-card animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          {days.map((day, idx) => {
            const dayItems = items.filter((item) => isSameDay(item.time, day));
            const today = isToday(day);
            const past = isPast(day) && !today;
            const isLast = idx === days.length - 1;

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  !isLast && 'border-b',
                  today && 'bg-primary/[0.03]',
                  past && 'opacity-60',
                )}
              >
                {/* Day header row */}
                <div className={cn(
                  'flex items-center gap-2 px-4 py-2',
                  today ? 'border-l-2 border-l-primary' : 'border-l-2 border-l-transparent',
                )}>
                  <span className={cn(
                    'text-xs font-semibold w-8 text-center',
                    today ? 'text-primary' : 'text-muted-foreground',
                  )}>
                    {format(day, 'EEE')}
                  </span>
                  <span className={cn(
                    'text-xs font-medium',
                    today ? 'text-primary' : 'text-foreground',
                  )}>
                    {format(day, 'MMM d')}
                  </span>
                  {today && (
                    <Badge className="text-[9px] px-1.5 py-0 h-4">Today</Badge>
                  )}
                  {dayItems.length > 0 && (
                    <span className="text-[11px] text-muted-foreground ml-auto">
                      {dayItems.length}
                    </span>
                  )}
                </div>

                {/* Items */}
                {dayItems.length > 0 && (
                  <div className="px-4 pb-2 space-y-1">
                    {dayItems.map((item) => {
                      const config = typeConfig[item.type];
                      const Icon = config.icon;
                      const statusClass = statusColors[item.status] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';

                      return (
                        <Link
                          key={`${item.type}-${item.id}`}
                          href={item.href}
                          className="flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-muted/50 transition-colors group"
                        >
                          <Icon className={cn('h-3.5 w-3.5 shrink-0', config.color)} />
                          <span className="text-sm font-medium truncate">
                            {item.title}
                          </span>
                          <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                            {item.subtitle}
                          </span>
                          <div className="ml-auto flex items-center gap-1.5 shrink-0">
                            {item.priority === 'urgent' && (
                              <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4">
                                Urgent
                              </Badge>
                            )}
                            {item.isDOT && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                                DOT
                              </Badge>
                            )}
                            <Badge
                              variant="secondary"
                              className={cn('text-[9px] px-1.5 py-0 h-4', statusClass)}
                            >
                              {item.status.replace(/_/g, ' ')}
                            </Badge>
                            <span className="text-[11px] text-muted-foreground w-16 text-right">
                              {format(item.time, 'h:mm a')}
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
