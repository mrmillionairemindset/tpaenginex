'use client';

import { useEffect, useState } from 'react';
import { StatCard } from '@/components/ui/stat-card';
import { FileText, Users, CheckCircle, Clock, Building } from 'lucide-react';

interface DashboardStatsProps {
  userRole: string;
}

interface Stats {
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  thisMonthOrders: number;
  activeCandidates?: number;
  totalOrganizations?: number;
}

export function DashboardStats({ userRole }: DashboardStatsProps) {
  const [stats, setStats] = useState<Stats>({
    totalOrders: 0,
    completedOrders: 0,
    pendingOrders: 0,
    thisMonthOrders: 0,
  });
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

  const isEmployer = userRole.startsWith('employer');

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 rounded-lg border bg-white animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Total Orders"
        value={stats.totalOrders.toString()}
        icon={FileText}
      />

      {isEmployer ? (
        <StatCard
          title="Active Candidates"
          value={stats.activeCandidates?.toString() || '0'}
          icon={Users}
        />
      ) : (
        <>
          <StatCard
            title="Pending Orders"
            value={stats.pendingOrders.toString()}
            icon={Clock}
          />
          <StatCard
            title="Employers"
            value={stats.totalOrganizations?.toString() || '0'}
            icon={Building}
          />
        </>
      )}

      <StatCard
        title="Completed"
        value={stats.completedOrders.toString()}
        icon={CheckCircle}
      />

      <StatCard
        title="This Month"
        value={stats.thisMonthOrders.toString()}
        icon={FileText}
      />
    </div>
  );
}
