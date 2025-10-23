'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'next/navigation';

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

  useEffect(() => {
    async function fetchRecentOrders() {
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
    }

    fetchRecentOrders();
  }, []);

  const isProvider = userRole.startsWith('provider');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 rounded-lg border bg-white">
        <LoadingSpinner />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-8 text-center text-gray-500">
        No recent activity to display
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => (
        <Card
          key={order.id}
          className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => router.push(`/orders/${order.id}`)}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <p className="font-medium">{order.orderNumber}</p>
                <StatusBadge status={order.status} />
              </div>
              <div className="mt-1 space-y-1">
                <p className="text-sm text-gray-600">
                  {order.candidate.firstName} {order.candidate.lastName}
                </p>
                {isProvider && (
                  <p className="text-sm text-gray-500">
                    {order.organization.name}
                  </p>
                )}
                <p className="text-sm text-gray-500">{order.testType}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">
                {formatDistanceToNow(new Date(order.createdAt), {
                  addSuffix: true,
                })}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
