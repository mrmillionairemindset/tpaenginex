'use client';

import { useEffect, useState } from 'react';
import { StatCard } from '@/components/ui/stat-card';
import { FileText, Users, CheckCircle, Clock, Building, CalendarDays, DollarSign, UserCheck, Target } from 'lucide-react';

interface DashboardStatsProps {
  userRole: string;
}

interface Stats {
  totalOrders?: number;
  completedOrders?: number;
  openOrders?: number;
  thisMonthOrders?: number;
  activeCandidates?: number;
  eventsThisWeek?: number;
  pendingResults?: number;
  billingQueue?: number;
  activeCollectors?: number;
  openLeads?: number;
  totalClients?: number;
  totalTpas?: number;
}

export function DashboardStats({ userRole }: DashboardStatsProps) {
  const [stats, setStats] = useState<Stats>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
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
    }

    fetchStats();
  }, []);

  const isClient = userRole === 'client_admin';
  const isPlatform = userRole === 'platform_admin';

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 rounded-lg border bg-white animate-pulse" />
        ))}
      </div>
    );
  }

  if (isPlatform) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Total Orders" value={String(stats.totalOrders || 0)} icon={FileText} />
        <StatCard title="TPA Tenants" value={String(stats.totalTpas || 0)} icon={Building} />
        <StatCard title="Client Orgs" value={String(stats.totalClients || 0)} icon={Users} />
      </div>
    );
  }

  if (isClient) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Orders" value={String(stats.totalOrders || 0)} icon={FileText} />
        <StatCard title="Active Candidates" value={String(stats.activeCandidates || 0)} icon={Users} />
        <StatCard title="Completed" value={String(stats.completedOrders || 0)} icon={CheckCircle} />
        <StatCard title="This Month" value={String(stats.thisMonthOrders || 0)} icon={FileText} />
      </div>
    );
  }

  // TPA dashboard
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <StatCard title="Open Orders" value={String(stats.openOrders || 0)} icon={FileText} />
      <StatCard title="Events This Week" value={String(stats.eventsThisWeek || 0)} icon={CalendarDays} />
      <StatCard title="Pending Results" value={String(stats.pendingResults || 0)} icon={Clock} />
      <StatCard title="Billing Queue" value={String(stats.billingQueue || 0)} icon={DollarSign} />
      <StatCard title="Active Collectors" value={String(stats.activeCollectors || 0)} icon={UserCheck} />
      <StatCard title="Open Leads" value={String(stats.openLeads || 0)} icon={Target} />
    </div>
  );
}
