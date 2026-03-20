'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { AlertCircle, UserCheck, Calendar, MapPin, Mail, Phone, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';

interface CollectorScheduleProps {
  collectorId: string;
  userRole: string;
}

export function CollectorSchedule({ collectorId, userRole }: CollectorScheduleProps) {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetch_data() {
      try {
        const response = await fetch(`/api/collectors/${collectorId}/schedule`);
        if (response.ok) {
          setData(await response.json());
        } else {
          setError('Collector not found');
        }
      } catch (err) {
        setError('Failed to load collector');
      } finally {
        setLoading(false);
      }
    }

    fetch_data();
  }, [collectorId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Collector Not Found"
        description={error || 'The collector you are looking for does not exist'}
      />
    );
  }

  const { collector, schedule, stats } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{collector.firstName} {collector.lastName}</h1>
          <div className="flex items-center gap-3 mt-1 text-muted-foreground">
            {collector.email && (
              <span className="flex items-center gap-1 text-sm">
                <Mail className="h-3.5 w-3.5" /> {collector.email}
              </span>
            )}
            {collector.phone && (
              <span className="flex items-center gap-1 text-sm">
                <Phone className="h-3.5 w-3.5" /> {collector.phone}
              </span>
            )}
          </div>
        </div>
        <Badge variant={collector.isAvailable ? 'default' : 'secondary'} className="text-sm">
          {collector.isAvailable ? 'Available' : 'Unavailable'}
        </Badge>
      </div>

      {/* Collector Info + Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-primary">{stats.upcoming}</p>
          <p className="text-xs text-muted-foreground">Upcoming</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-amber-500">{stats.active}</p>
          <p className="text-xs text-muted-foreground">Active / In Progress</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-green-500">{stats.completed}</p>
          <p className="text-xs text-muted-foreground">Completed</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold">{stats.totalAssignments}</p>
          <p className="text-xs text-muted-foreground">Total Assignments</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-4 w-4 text-primary" />
            <p className="text-xs font-medium">Certifications</p>
          </div>
          <div className="flex flex-wrap gap-1">
            {collector.certifications && collector.certifications.length > 0 ? (
              collector.certifications.map((cert: string, i: number) => (
                <Badge key={i} variant="secondary" className="text-xs">{cert}</Badge>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">None</span>
            )}
          </div>
          {collector.serviceArea && (
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {collector.serviceArea}
            </p>
          )}
        </Card>
      </div>

      {/* Upcoming Assignments */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Upcoming ({schedule.upcoming.length})</h2>
        </div>

        {schedule.upcoming.length > 0 ? (
          <div className="space-y-2">
            {schedule.upcoming.map((item: any) => (
              <ScheduleItem key={`${item.type}-${item.id}`} item={item} router={router} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No upcoming assignments.</p>
        )}
      </Card>

      {/* Active / In Progress */}
      {schedule.active.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <UserCheck className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-semibold">Active / In Progress ({schedule.active.length})</h2>
          </div>

          <div className="space-y-2">
            {schedule.active.map((item: any) => (
              <ScheduleItem key={`${item.type}-${item.id}`} item={item} router={router} />
            ))}
          </div>
        </Card>
      )}

      {/* Recently Completed */}
      {schedule.completed.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <UserCheck className="h-5 w-5 text-green-500" />
            <h2 className="text-lg font-semibold">Recently Completed ({schedule.completed.length})</h2>
          </div>

          <div className="space-y-2">
            {schedule.completed.map((item: any) => (
              <ScheduleItem key={`${item.type}-${item.id}`} item={item} router={router} />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function ScheduleItem({ item, router }: { item: any; router: any }) {
  return (
    <div
      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted cursor-pointer"
      onClick={() => router.push(item.href)}
    >
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg text-xs font-bold ${
          item.type === 'event' ? 'bg-accent/10 text-accent' : 'bg-primary/10 text-primary'
        }`}>
          {item.type === 'event' ? 'EVT' : 'ORD'}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm">{item.title}</p>
            {item.isDOT && (
              <Badge variant="secondary" className="text-xs">DOT</Badge>
            )}
            {item.priority === 'urgent' && (
              <Badge variant="secondary" className="text-xs bg-red-500/10 text-red-500">URGENT</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {item.client} &middot; {item.subtitle}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 text-right">
        {item.date && (
          <span className="text-xs text-muted-foreground">
            {format(new Date(item.date), 'MMM d, yyyy h:mm a')}
          </span>
        )}
        <StatusBadge status={item.status} />
      </div>
    </div>
  );
}
