'use client';

import { useEffect, useState } from 'react';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { Upload } from 'lucide-react';

interface Order {
  id: string;
  orderNumber: string;
  status: 'new' | 'needs_site' | 'scheduled' | 'in_progress' | 'complete' | 'cancelled';
  testType: string;
  candidate: {
    firstName: string;
    lastName: string;
  };
  organization: {
    name: string;
  };
  appointments: Array<{
    site: {
      name: string;
    };
  }>;
  documents: Array<{
    kind: string;
  }>;
  createdAt: string;
}

export function ResultsTable() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOrders() {
      try {
        // Fetch orders that need results (in_progress or scheduled status)
        const response = await fetch('/api/orders?needsResults=true');
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

  const hasResults = (order: Order) => {
    return order.documents?.some((doc) => doc.kind === 'result') || false;
  };

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
    {
      header: 'Employer',
      accessor: (order: Order) => order.organization.name,
    },
    {
      header: 'Test Type',
      accessor: 'testType' as const,
    },
    {
      header: 'Site',
      accessor: (order: Order) =>
        order.appointments.length > 0
          ? order.appointments[0].site.name
          : '—',
    },
    {
      header: 'Status',
      accessor: (order: Order) => <StatusBadge status={order.status} />,
    },
    {
      header: 'Results',
      accessor: (order: Order) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            hasResults(order)
              ? 'bg-green-100 text-green-800'
              : 'bg-yellow-100 text-yellow-800'
          }`}
        >
          {hasResults(order) ? 'Uploaded' : 'Pending'}
        </span>
      ),
    },
    {
      header: 'Created',
      accessor: (order: Order) =>
        formatDistanceToNow(new Date(order.createdAt), { addSuffix: true }),
    },
    {
      header: 'Action',
      accessor: (order: Order) => (
        <Button
          size="sm"
          variant={hasResults(order) ? 'outline' : 'default'}
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/results/${order.id}`);
          }}
        >
          <Upload className="mr-2 h-4 w-4" />
          {hasResults(order) ? 'View' : 'Upload'}
        </Button>
      ),
    },
  ];

  return (
    <DataTable
      data={orders}
      columns={columns}
      loading={loading}
      emptyMessage="No orders pending results."
      onRowClick={(order) => router.push(`/results/${order.id}`)}
    />
  );
}
