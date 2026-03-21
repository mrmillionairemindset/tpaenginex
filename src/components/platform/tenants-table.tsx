'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  contactEmail: string | null;
  contactPhone: string | null;
  clientCount: number;
  userCount: number;
  createdAt: string;
  isActive: boolean;
}

export function TenantsTable() {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTenants() {
      try {
        const response = await fetch('/api/platform/tenants');
        if (response.ok) {
          const data = await response.json();
          setTenants(data.tenants || []);
        }
      } catch (error) {
        console.error('Failed to fetch tenants:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchTenants();
  }, []);

  const columns = [
    {
      header: 'TPA Name',
      accessor: 'name' as const,
    },
    {
      header: 'Contact',
      accessor: (tenant: Tenant) => tenant.contactEmail || '-',
    },
    {
      header: 'Clients',
      accessor: (tenant: Tenant) => String(tenant.clientCount),
    },
    {
      header: 'Users',
      accessor: (tenant: Tenant) => String(tenant.userCount),
    },
    {
      header: 'Status',
      accessor: (tenant: Tenant) => (
        <Badge
          className={`font-medium ${
            tenant.isActive
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-muted text-foreground'
          }`}
          variant="secondary"
        >
          {tenant.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      header: 'Created',
      accessor: (tenant: Tenant) =>
        format(new Date(tenant.createdAt), 'MMM d, yyyy'),
    },
  ];

  return (
    <DataTable
      data={tenants}
      columns={columns}
      loading={loading}
      emptyMessage="No TPA accounts found. Create your first TPA to get started."
      onRowClick={(tenant) => router.push(`/platform/tenants/${tenant.id}`)}
    />
  );
}
