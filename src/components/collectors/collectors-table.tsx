'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { usePolling } from '@/hooks/use-polling';

interface Collector {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  certifications: string[] | null;
  serviceArea: string | null;
  isAvailable: boolean;
  isActive: boolean;
  userId: string | null;
  activeOrders?: number;
}

export function CollectorsTable() {
  const router = useRouter();
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCollectors = useCallback(async () => {
    try {
      const response = await fetch('/api/collectors');
      if (response.ok) {
        const data = await response.json();
        setCollectors(data.collectors);
      }
    } catch (error) {
      console.error('Failed to fetch collectors:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCollectors();
  }, [fetchCollectors]);

  usePolling(fetchCollectors);

  const columns = [
    {
      header: 'Name',
      accessor: (c: Collector) => (
        <div>
          <span className="font-medium">{c.firstName} {c.lastName}</span>
          {c.userId && (
            <Badge variant="outline" className="ml-2 text-[10px] px-1 py-0 text-green-600 border-green-300">
              Portal
            </Badge>
          )}
        </div>
      ),
    },
    {
      header: 'Contact',
      accessor: (c: Collector) => (
        <div className="text-sm">
          <div>{c.email}</div>
          <div className="text-muted-foreground">{c.phone}</div>
        </div>
      ),
    },
    {
      header: 'Certifications',
      accessor: (c: Collector) =>
        c.certifications && c.certifications.length > 0
          ? c.certifications.map((cert, i) => (
              <Badge key={i} variant="secondary" className="mr-1 text-xs">
                {cert}
              </Badge>
            ))
          : <span className="text-muted-foreground">-</span>,
    },
    {
      header: 'Service Area',
      accessor: (c: Collector) => c.serviceArea || <span className="text-muted-foreground">-</span>,
    },
    {
      header: 'Status',
      accessor: (c: Collector) => (
        <Badge variant={c.isAvailable ? 'default' : 'secondary'}>
          {c.isAvailable ? 'Available' : 'Unavailable'}
        </Badge>
      ),
    },
  ];

  return (
    <DataTable
      data={collectors}
      columns={columns}
      loading={loading}
      emptyMessage="No collectors yet. Invite a team member with the Collector role from Settings > Organization > Members."
      onRowClick={(collector) => router.push(`/collectors/${collector.id}`)}
    />
  );
}
