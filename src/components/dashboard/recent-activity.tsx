'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { usePolling } from '@/hooks/use-polling';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'next/navigation';
import { FileText, Plus } from 'lucide-react';
import Link from 'next/link';

interface RecentActivityProps {
  userRole: string;
}

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
  createdAt: string;
}

export function RecentActivity({ userRole }: RecentActivityProps) {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecentOrders = useCallback(async () => {
    try {
      const response = await fetch('/api/orders?limit=5');
      if (response.ok) {
        const data = await response.json();
        setOrders(data.orders);
      }
    } catch (error) {
      console.error('Failed to fetch recent orders:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecentOrders();
  }, [fetchRecentOrders]);

  usePolling(fetchRecentOrders, 30000);

  const isTpaUser = userRole.startsWith('tpa_') || userRole === 'platform_admin';

  if (loading) {
    return (
      <Card className="p-5">
        <div className="space-y-3">
          <div className="h-5 w-32 animate-pulse rounded bg-muted" />
          <div className="h-14 animate-pulse rounded bg-muted" />
          <div className="h-14 animate-pulse rounded bg-muted" />
          <div className="h-14 animate-pulse rounded bg-muted" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Recent Orders</h3>
        <Link href="/orders" className="text-xs text-primary hover:underline">
          View all
        </Link>
      </div>

      {orders.length === 0 ? (
        <div className="py-6 text-center">
          <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground mb-3">No orders yet</p>
          <Button asChild size="sm" variant="outline">
            <Link href="/orders/new">
              <Plus className="h-3.5 w-3.5 mr-1" /> Create First Order
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
          {orders.map((order) => (
            <div
              key={order.id}
              className="flex items-center gap-3 p-2.5 rounded-md border cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => router.push(`/orders/${order.id}`)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{order.orderNumber}</span>
                  <StatusBadge status={order.status} />
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {order.candidate.firstName} {order.candidate.lastName}
                  {isTpaUser ? ` — ${order.organization.name}` : ''}
                </p>
              </div>
              <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
