'use client';

import { useEffect, useState } from 'react';
import { DataTable } from '@/components/ui/data-table';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';

interface Organization {
  id: string;
  name: string;
  type: string;
  createdAt: string;
  _count: {
    orders: number;
    users: number;
    candidates: number;
  };
}

export function OrganizationsTable() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOrganizations() {
      try {
        const response = await fetch('/api/organizations');
        if (response.ok) {
          const data = await response.json();
          setOrganizations(data.organizations);
        }
      } catch (error) {
        console.error('Failed to fetch organizations:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchOrganizations();
  }, []);

  const columns = [
    {
      header: 'Organization Name',
      accessor: 'name' as const,
    },
    {
      header: 'Type',
      accessor: (org: Organization) => (
        <span className="capitalize">{org.type.replace('_', ' ')}</span>
      ),
    },
    {
      header: 'Orders',
      accessor: (org: Organization) => org._count.orders,
    },
    {
      header: 'Candidates',
      accessor: (org: Organization) => org._count.candidates,
    },
    {
      header: 'Users',
      accessor: (org: Organization) => org._count.users,
    },
    {
      header: 'Member Since',
      accessor: (org: Organization) =>
        formatDistanceToNow(new Date(org.createdAt), { addSuffix: true }),
    },
  ];

  return (
    <DataTable
      data={organizations}
      columns={columns}
      loading={loading}
      emptyMessage="No employer organizations found."
      onRowClick={(org) => router.push(`/organizations/${org.id}`)}
    />
  );
}
