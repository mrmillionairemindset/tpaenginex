'use client';

import { useEffect, useState, useCallback } from 'react';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { useRouter } from 'next/navigation';
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
  email: string;
  phone: string;
  orgId: string;
  clientOrg?: { id: string; name: string } | null;
  qualifications?: Qualification[];
  complianceScores?: { score: number }[];
  applications?: { status: string }[];
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

function getApplicationBadge(applications: { status: string }[] | undefined) {
  if (!applications || applications.length === 0) {
    return <Badge variant="outline">None</Badge>;
  }

  const latest = applications[0];
  const statusMap: Record<string, { label: string; className: string }> = {
    submitted: { label: 'Submitted', className: 'border-transparent bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
    under_review: { label: 'Under Review', className: 'border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
    approved: { label: 'Approved', className: 'border-transparent bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
    rejected: { label: 'Rejected', className: 'border-transparent bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
    withdrawn: { label: 'Withdrawn', className: 'border-transparent bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200' },
  };

  const config = statusMap[latest.status] || { label: latest.status, className: '' };
  return <Badge className={config.className}>{config.label}</Badge>;
}

export function DriversTable() {
  const router = useRouter();
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
      header: 'Client',
      accessor: (driver: Driver) => driver.clientOrg?.name || '-',
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
      header: 'Compliance',
      accessor: (driver: Driver) => getComplianceScore(driver.complianceScores),
    },
    {
      header: 'Application',
      accessor: (driver: Driver) => getApplicationBadge(driver.applications),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => (window.location.href = '/api/dqf/drivers/export')}
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>
      <DataTable
        data={drivers}
        columns={columns}
        loading={loading}
        emptyMessage="No drivers found. Add a driver application to get started."
        onRowClick={(driver) => router.push(`/dqf/drivers/${driver.id}`)}
      />
    </div>
  );
}
