'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { usePolling } from '@/hooks/use-polling';
import {
  FileText,
  Users,
  CheckCircle,
  Clock,
  Building,
  CalendarDays,
  DollarSign,
  UserCheck,
  Target,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface DashboardStatsProps {
  userRole: string;
  enabledModules?: string[];
}

interface Stats {
  totalOrders?: number;
  completedOrders?: number;
  openOrders?: number;
  thisMonthOrders?: number;
  activePersons?: number;
  eventsThisWeek?: number;
  pendingResults?: number;
  billingQueue?: number;
  activeCollectors?: number;
  openLeads?: number;
  totalClients?: number;
  totalTpas?: number;
  // DQF
  activeDrivers?: number;
  expiringQualifications?: number;
  upcomingReviews?: number;
  avgComplianceScore?: number;
}

function PrimaryStat({
  title,
  value,
  icon: Icon,
  href,
  accent,
  label,
}: {
  title: string;
  value: number;
  icon: LucideIcon;
  href: string;
  accent: string;
  label?: string;
}) {
  return (
    <Link href={href}>
      <Card className="group hover:shadow-md transition-all">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn('rounded-lg p-2.5', accent)}>
                <Icon className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{title}</p>
                <p className="text-2xl font-bold">{value}</p>
              </div>
            </div>
            {value > 0 && label && (
              <span className="text-xs text-muted-foreground group-hover:text-primary flex items-center gap-1 transition-colors">
                {label} <ArrowRight className="h-3 w-3" />
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function SecondaryStat({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: number;
  icon: LucideIcon;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">{title}</span>
      <span className="ml-auto text-sm font-semibold">{value}</span>
    </div>
  );
}

export function DashboardStats({ userRole, enabledModules }: DashboardStatsProps) {
  const hasDqf = enabledModules?.includes('dqf') ?? false;
  const [stats, setStats] = useState<Stats>({});
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/dashboard/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  usePolling(fetchStats, 30000);

  const isClient = userRole === 'client_admin';
  const isPlatform = userRole === 'platform_admin';

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-[88px] rounded-lg border bg-card animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (isPlatform) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        <PrimaryStat title="Total Orders" value={stats.totalOrders || 0} icon={FileText} href="/orders" accent="bg-blue-500" label="View" />
        <PrimaryStat title="TPA Tenants" value={stats.totalTpas || 0} icon={Building} href="/platform/tenants" accent="bg-purple-500" label="Manage" />
        <PrimaryStat title="Client Orgs" value={stats.totalClients || 0} icon={Users} href="/platform" accent="bg-green-500" label="View" />
      </div>
    );
  }

  if (isClient) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <PrimaryStat title="Total Orders" value={stats.totalOrders || 0} icon={FileText} href="/client-portal/orders" accent="bg-blue-500" />
        <PrimaryStat title="Active Persons" value={stats.activePersons || 0} icon={Users} href="/client-portal/orders" accent="bg-green-500" />
        <PrimaryStat title="Completed" value={stats.completedOrders || 0} icon={CheckCircle} href="/client-portal/orders" accent="bg-emerald-500" />
        <PrimaryStat title="This Month" value={stats.thisMonthOrders || 0} icon={CalendarDays} href="/client-portal/orders" accent="bg-purple-500" />
      </div>
    );
  }

  // TPA dashboard — split into action items (top) and info (bottom)
  return (
    <div className="space-y-4">
      {/* Primary: items needing attention */}
      <div className="grid gap-4 md:grid-cols-3">
        <PrimaryStat
          title="Open Orders"
          value={stats.openOrders || 0}
          icon={FileText}
          href="/orders"
          accent="bg-blue-500"
          label="Review"
        />
        <PrimaryStat
          title="Pending Results"
          value={stats.pendingResults || 0}
          icon={Clock}
          href="/orders"
          accent={stats.pendingResults ? 'bg-amber-500' : 'bg-slate-400'}
          label="Follow up"
        />
        <PrimaryStat
          title="Billing Queue"
          value={stats.billingQueue || 0}
          icon={DollarSign}
          href="/billing"
          accent={stats.billingQueue ? 'bg-orange-500' : 'bg-slate-400'}
          label="Process"
        />
      </div>

      {/* Secondary: informational counters */}
      <div className="grid gap-3 md:grid-cols-3">
        <SecondaryStat title="Events This Week" value={stats.eventsThisWeek || 0} icon={CalendarDays} />
        <SecondaryStat title="Active Collectors" value={stats.activeCollectors || 0} icon={UserCheck} />
        <SecondaryStat title="Open Leads" value={stats.openLeads || 0} icon={Target} />
      </div>

      {/* DQF stats — only shown when module is enabled */}
      {hasDqf && (
        <div className="grid gap-3 md:grid-cols-4">
          <SecondaryStat title="Active Drivers" value={stats.activeDrivers || 0} icon={Users} />
          <SecondaryStat title="Expiring Qualifications" value={stats.expiringQualifications || 0} icon={Clock} />
          <SecondaryStat title="Upcoming Reviews" value={stats.upcomingReviews || 0} icon={CalendarDays} />
          <SecondaryStat title="Avg Compliance" value={stats.avgComplianceScore || 0} icon={CheckCircle} />
        </div>
      )}
    </div>
  );
}
