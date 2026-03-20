'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { StatusBadge } from '@/components/ui/status-badge';

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  testType: string;
  serviceType: string;
  priority: string;
  candidate: {
    firstName: string;
    lastName: string;
  };
  organization: {
    name: string;
  };
}

interface OrdersKanbanProps {
  userRole: string;
}

const KANBAN_COLUMNS = [
  {
    key: 'new',
    title: 'New',
    statuses: ['new', 'needs_site'],
  },
  {
    key: 'scheduled',
    title: 'Scheduled',
    statuses: ['scheduled'],
  },
  {
    key: 'in_progress',
    title: 'In Progress',
    statuses: ['in_progress'],
  },
  {
    key: 'results',
    title: 'Results',
    statuses: ['results_uploaded', 'pending_review', 'needs_correction'],
  },
  {
    key: 'complete',
    title: 'Complete',
    statuses: ['complete'],
  },
];

function ServiceTypeBadge({ serviceType }: { serviceType: string }) {
  return (
    <span className="inline-flex items-center text-xs px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground capitalize">
      {serviceType?.replace(/_/g, ' ') || 'N/A'}
    </span>
  );
}

export function OrdersKanban({ userRole }: OrdersKanbanProps) {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const isTpaUser = userRole.startsWith('tpa_') || userRole === 'platform_admin';

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Filter out cancelled orders
  const activeOrders = orders.filter((o) => o.status !== 'cancelled');

  // Group orders by column
  const columns = KANBAN_COLUMNS.map((col) => ({
    ...col,
    orders: activeOrders.filter((o) => col.statuses.includes(o.status)),
  }));

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((column) => (
        <div
          key={column.key}
          className="flex-shrink-0 w-72 bg-secondary/30 rounded-lg border border-border"
        >
          {/* Column header */}
          <div className="p-3 border-b border-border">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">{column.title}</h3>
              <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                {column.orders.length}
              </span>
            </div>
          </div>

          {/* Cards */}
          <div className="p-2 space-y-2 min-h-[200px] max-h-[calc(100vh-300px)] overflow-y-auto">
            {column.orders.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8">
                No orders
              </p>
            )}
            {column.orders.map((order) => (
              <div
                key={order.id}
                onClick={() => router.push(`/orders/${order.id}`)}
                className="bg-card border border-border rounded-md p-3 cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-mono font-medium text-primary">
                    {order.orderNumber}
                  </span>
                  {order.priority === 'urgent' && (
                    <span className="text-[10px] font-semibold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 px-1.5 py-0.5 rounded">
                      URGENT
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium truncate">
                  {order.candidate.firstName} {order.candidate.lastName}
                </p>
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <ServiceTypeBadge serviceType={order.serviceType} />
                  <StatusBadge status={order.status} />
                </div>
                {isTpaUser && order.organization && (
                  <p className="text-xs text-muted-foreground mt-1.5 truncate">
                    {order.organization.name}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
