'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';

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
}

export function CollectorsTable() {
  const router = useRouter();
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCollectors() {
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
    }

    fetchCollectors();
  }, []);

  const columns = [
    {
      header: 'Name',
      accessor: (c: Collector) => `${c.firstName} ${c.lastName}`,
    },
    {
      header: 'Email',
      accessor: 'email' as const,
    },
    {
      header: 'Phone',
      accessor: 'phone' as const,
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
          : <span className="text-muted-foreground">None</span>,
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
      emptyMessage="No collectors found. Add your first collector to get started."
      onRowClick={(collector) => router.push(`/collectors/${collector.id}`)}
    />
  );
}
