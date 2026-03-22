'use client';

import { useEffect, useState, useCallback } from 'react';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Download } from 'lucide-react';
import { format } from 'date-fns';
import { usePolling } from '@/hooks/use-polling';

type BillingStatus = 'pending' | 'sent' | 'paid' | 'overdue';

interface BillingItem {
  id: string;
  invoiceNumber: string;
  clientName: string;
  orderNumber: string;
  amountCents: number;
  status: BillingStatus;
  date: string;
}

const statusStyles: Record<BillingStatus, { className: string; label: string }> = {
  pending: { className: 'bg-amber-100 text-amber-800', label: 'Pending' },
  sent: { className: 'bg-primary/10 text-primary', label: 'Sent' },
  paid: { className: 'bg-green-100 text-green-800', label: 'Paid' },
  overdue: { className: 'bg-red-100 text-red-800', label: 'Overdue' },
};

function formatCentsToDollars(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

export function BillingTable() {
  const { toast } = useToast();
  const [items, setItems] = useState<BillingItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBilling = useCallback(async () => {
    try {
      const response = await fetch('/api/billing');
      if (response.ok) {
        const data = await response.json();
        setItems(data.items || []);
      }
    } catch (error) {
      console.error('Failed to fetch billing data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBilling();
  }, [fetchBilling]);

  usePolling(fetchBilling);

  const handleStatusChange = async (id: string, newStatus: BillingStatus) => {
    try {
      const response = await fetch(`/api/billing/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        setItems((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, status: newStatus } : item
          )
        );
        toast({
          title: 'Status Updated',
          description: `Invoice marked as ${statusStyles[newStatus].label.toLowerCase()}`,
        });
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to update status',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    }
  };

  const columns = [
    {
      header: 'Invoice #',
      accessor: 'invoiceNumber' as const,
    },
    {
      header: 'Client',
      accessor: 'clientName' as const,
    },
    {
      header: 'Order/Event #',
      accessor: 'orderNumber' as const,
    },
    {
      header: 'Amount',
      accessor: (item: BillingItem) => formatCentsToDollars(item.amountCents),
    },
    {
      header: 'Status',
      accessor: (item: BillingItem) => {
        const style = statusStyles[item.status];
        return (
          <Badge className={`${style.className} font-medium`} variant="secondary">
            {style.label}
          </Badge>
        );
      },
    },
    {
      header: 'Date',
      accessor: (item: BillingItem) =>
        format(new Date(item.date), 'MMM d, yyyy'),
    },
    {
      header: 'Actions',
      accessor: (item: BillingItem) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                window.open(`/api/billing/${item.id}/pdf`, '_blank');
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                handleStatusChange(item.id, 'sent');
              }}
            >
              Mark as Sent
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                handleStatusChange(item.id, 'paid');
              }}
            >
              Mark as Paid
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                handleStatusChange(item.id, 'overdue');
              }}
            >
              Mark as Overdue
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      className: 'w-[60px]',
    },
  ];

  return (
    <DataTable
      data={items}
      columns={columns}
      loading={loading}
      emptyMessage="No billing items found."
    />
  );
}
