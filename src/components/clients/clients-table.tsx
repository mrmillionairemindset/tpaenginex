'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DataTable } from '@/components/ui/data-table';

interface Client {
  id: string;
  name: string;
  contactEmail: string | null;
  city: string | null;
  state: string | null;
  orderCount: number;
  memberCount: number;
}

export function ClientsTable() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchClients() {
      try {
        const response = await fetch('/api/clients');
        if (response.ok) {
          const data = await response.json();
          setClients(data.clients || []);
        }
      } catch (error) {
        console.error('Failed to fetch clients:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchClients();
  }, []);

  const columns = [
    {
      header: 'Name',
      accessor: 'name' as const,
    },
    {
      header: 'Contact Email',
      accessor: (client: Client) => client.contactEmail || '-',
    },
    {
      header: 'Location',
      accessor: (client: Client) => {
        if (client.city && client.state) {
          return `${client.city}, ${client.state}`;
        }
        return client.city || client.state || '-';
      },
    },
    {
      header: 'Orders',
      accessor: (client: Client) => String(client.orderCount ?? 0),
    },
    {
      header: 'Members',
      accessor: (client: Client) => String(client.memberCount ?? 0),
    },
  ];

  return (
    <DataTable
      data={clients}
      columns={columns}
      loading={loading}
      emptyMessage="No clients found. Add your first client to get started."
      onRowClick={(client) => router.push(`/clients/${client.id}`)}
    />
  );
}
