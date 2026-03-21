'use client';

import { useEffect, useState } from 'react';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';

interface Order {
  id: string;
  orderNumber: string;
  status: 'new' | 'needs_site' | 'scheduled' | 'in_progress' | 'complete' | 'cancelled';
  testType: string;
  candidate: {
    firstName: string;
    lastName: string;
    email: string | null;
  };
  organization: {
    name: string;
  };
  clientOrg?: {
    name: string;
  } | null;
  createdAt: string;
}

interface OrdersTableProps {
  userRole: string;
}

export function OrdersTable({ userRole }: OrdersTableProps) {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOrders() {
      try {
        const response = await fetch('/api/orders');
        if (response.ok) {
          const data = await response.json();
          setOrders(data.orders);
        }
      } catch (error) {
        console.error('Failed to fetch orders:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchOrders();
  }, []);

  const isTpaUser = userRole.startsWith('tpa_') || userRole === 'platform_admin';

  const columns = [
    {
      header: 'Order #',
      accessor: 'orderNumber' as const,
    },
    {
      header: 'Candidate',
      accessor: (order: Order) =>
        `${order.candidate.firstName} ${order.candidate.lastName}`,
    },
    ...(isTpaUser
      ? [
          {
            header: 'Client',
            accessor: (order: Order) => order.clientOrg?.name || order.organization.name,
          },
        ]
      : []),
    {
      header: 'Test Type',
      accessor: 'testType' as const,
    },
    {
      header: 'Status',
      accessor: (order: Order) => <StatusBadge status={order.status} />,
    },
    {
      header: 'Created',
      accessor: (order: Order) =>
        formatDistanceToNow(new Date(order.createdAt), { addSuffix: true }),
    },
  ];

  return (
    <DataTable
      data={orders}
      columns={columns}
      loading={loading}
      emptyMessage="No orders found. Create your first order to get started."
      onRowClick={(order) => router.push(`/orders/${order.id}`)}
    />
  );
}
