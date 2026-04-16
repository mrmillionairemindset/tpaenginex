'use client';

import { useEffect, useState, useCallback } from 'react';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { usePolling } from '@/hooks/use-polling';

interface Qualification {
  qualificationType: string;
  status: string;
  expiresAt: string | null;
}

interface Driver {
  id: string;
  firstName: string;
  lastName: string;
  qualifications?: Qualification[];
  complianceScores?: { score: number }[];
}

function getQualificationBadge(qualifications: Qualification[] | undefined, type: string) {
  if (!qualifications || qualifications.length === 0) {
    return <Badge variant="outline">N/A</Badge>;
  }

  const qual = qualifications.find((q) => q.qualificationType === type);
  if (!qual) {
    return <Badge variant="outline">Missing</Badge>;
  }

  const now = new Date();
  const expiresAt = qual.expiresAt ? new Date(qual.expiresAt) : null;
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  if (qual.status === 'expired' || (expiresAt && expiresAt < now)) {
    return (
      <Badge variant="destructive">
        Expired{expiresAt ? ` ${expiresAt.toLocaleDateString()}` : ''}
      </Badge>
    );
  }

  if (expiresAt && expiresAt < thirtyDaysFromNow) {
    return (
      <Badge className="border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
        Expiring {expiresAt.toLocaleDateString()}
      </Badge>
    );
  }

  if (qual.status === 'active' || qual.status === 'valid') {
    return (
      <Badge className="border-transparent bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
        Active{expiresAt ? ` - ${expiresAt.toLocaleDateString()}` : ''}
      </Badge>
    );
  }

  return <Badge variant="secondary">{qual.status}</Badge>;
}

function getComplianceScore(scores: { score: number }[] | undefined) {
  if (!scores || scores.length === 0) {
    return <span className="text-muted-foreground">--</span>;
  }

  const score = scores[0].score;
  let colorClass = 'text-red-600 dark:text-red-400';
  if (score >= 80) {
    colorClass = 'text-green-600 dark:text-green-400';
  } else if (score >= 60) {
    colorClass = 'text-yellow-600 dark:text-yellow-400';
  }

  return <span className={`font-semibold ${colorClass}`}>{score}%</span>;
}

export function ClientDriversTable() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDrivers = useCallback(async () => {
    try {
      const response = await fetch('/api/dqf/drivers');
      if (response.ok) {
        const data = await response.json();
        setDrivers(data.drivers || []);
      }
    } catch (error) {
      console.error('Failed to fetch drivers:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  usePolling(fetchDrivers);

  const columns = [
    {
      header: 'Name',
      accessor: (driver: Driver) => (
        <span className="font-medium">
          {driver.firstName} {driver.lastName}
        </span>
      ),
    },
    {
      header: 'CDL Status',
      accessor: (driver: Driver) => getQualificationBadge(driver.qualifications, 'cdl'),
    },
    {
      header: 'Med Card Status',
      accessor: (driver: Driver) => getQualificationBadge(driver.qualifications, 'medical_card'),
    },
    {
      header: 'Compliance Score',
      accessor: (driver: Driver) => getComplianceScore(driver.complianceScores),
    },
  ];

  return (
    <DataTable
      data={drivers}
      columns={columns}
      loading={loading}
      emptyMessage="No drivers found for your organization."
    />
  );
}
