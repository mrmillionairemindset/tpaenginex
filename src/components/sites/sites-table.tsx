'use client';

import { useEffect, useState } from 'react';
import { DataTable } from '@/components/ui/data-table';
import { useRouter } from 'next/navigation';

interface Site {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string | null;
  isActive: boolean;
  _count: {
    appointments: number;
  };
}

interface SitesTableProps {
  userRole: string;
}

export function SitesTable({ userRole }: SitesTableProps) {
  const router = useRouter();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSites() {
      try {
        const response = await fetch('/api/sites');
        if (response.ok) {
          const data = await response.json();
          setSites(data.sites);
        }
      } catch (error) {
        console.error('Failed to fetch sites:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchSites();
  }, []);

  const columns = [
    {
      header: 'Site Name',
      accessor: 'name' as const,
    },
    {
      header: 'Address',
      accessor: (site: Site) =>
        `${site.address}, ${site.city}, ${site.state} ${site.zip}`,
    },
    {
      header: 'Phone',
      accessor: (site: Site) => site.phone || '—',
    },
    {
      header: 'Status',
      accessor: (site: Site) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            site.isActive
              ? 'bg-green-100 text-green-800'
              : 'bg-muted text-foreground'
          }`}
        >
          {site.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      header: 'Appointments',
      accessor: (site: Site) => site._count.appointments,
    },
  ];

  return (
    <DataTable
      data={sites}
      columns={columns}
      loading={loading}
      emptyMessage="No testing sites found. Add your first site to get started."
      onRowClick={(site) => router.push(`/sites/${site.id}`)}
    />
  );
}
