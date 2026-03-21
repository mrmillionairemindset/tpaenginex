'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { StatusBadge } from '@/components/ui/status-badge';
import { useToast } from '@/components/ui/use-toast';

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
  clientOrg?: {
    name: string;
  } | null;
  clientLabel?: string | null;
}

interface OrdersKanbanProps {
  userRole: string;
}

const KANBAN_COLUMNS = [
  {
    key: 'new',
    title: 'New',
    statuses: ['new', 'needs_site'],
    dropStatus: 'new',
  },
  {
    key: 'scheduled',
    title: 'Scheduled',
    statuses: ['scheduled'],
    dropStatus: 'scheduled',
  },
  {
    key: 'in_progress',
    title: 'In Progress',
    statuses: ['in_progress'],
    dropStatus: 'in_progress',
  },
  {
    key: 'results',
    title: 'Results',
    statuses: ['results_uploaded', 'pending_review', 'needs_correction'],
    dropStatus: 'results_uploaded',
  },
  {
    key: 'complete',
    title: 'Complete',
    statuses: ['complete'],
    dropStatus: 'complete',
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
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedOrderId, setDraggedOrderId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

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

  const handleDragStart = (e: React.DragEvent, orderId: string) => {
    setDraggedOrderId(orderId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', orderId);
    // Make the drag image slightly transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedOrderId(null);
    setDragOverColumn(null);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  };

  const handleDragOver = (e: React.DragEvent, columnKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnKey);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if leaving the column entirely (not entering a child)
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!e.currentTarget.contains(relatedTarget)) {
      setDragOverColumn(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, column: typeof KANBAN_COLUMNS[0]) => {
    e.preventDefault();
    setDragOverColumn(null);

    const orderId = e.dataTransfer.getData('text/plain');
    if (!orderId) return;

    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    // Already in this column?
    if (column.statuses.includes(order.status)) return;

    const newStatus = column.dropStatus;

    // Optimistic update
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    );

    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        const data = await response.json();
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: data.order.status } : o))
        );
        toast({ title: 'Order Moved', description: `${order.orderNumber} moved to ${column.title}` });
      } else {
        // Revert on failure
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: order.status } : o))
        );
        const err = await response.json();
        toast({ title: 'Error', description: err.error || 'Failed to update status', variant: 'destructive' });
      }
    } catch {
      // Revert on failure
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: order.status } : o))
      );
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
    }
  };

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
          className={`flex-shrink-0 w-72 rounded-lg border transition-colors ${
            dragOverColumn === column.key
              ? 'border-primary bg-primary/5'
              : 'border-border bg-secondary/30'
          }`}
          onDragOver={(e) => handleDragOver(e, column.key)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, column)}
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
                {dragOverColumn === column.key ? 'Drop here' : 'No orders'}
              </p>
            )}
            {column.orders.map((order) => (
              <div
                key={order.id}
                draggable={isTpaUser}
                onDragStart={(e) => handleDragStart(e, order.id)}
                onDragEnd={handleDragEnd}
                onClick={() => router.push(`/orders/${order.id}`)}
                className={`bg-card border rounded-md p-3 transition-all ${
                  isTpaUser ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                } ${
                  draggedOrderId === order.id
                    ? 'border-primary/50 opacity-50'
                    : 'border-border hover:border-primary/50 hover:shadow-sm'
                }`}
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
                {isTpaUser && (order.clientOrg || order.clientLabel || order.organization) && (
                  <p className="text-xs text-muted-foreground mt-1.5 truncate">
                    {order.clientOrg?.name || order.clientLabel || order.organization.name}
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
