'use client';

import { useEffect, useState } from 'react';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { format } from 'date-fns';

interface CompletedOrder {
  id: string;
  orderNumber: string;
  personName: string;
  testType: string;
  completedAt: string;
  resultFileUrl: string | null;
}

export function ClientResultsTable() {
  const [results, setResults] = useState<CompletedOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchResults() {
      try {
        const response = await fetch('/api/orders?status=complete');
        if (response.ok) {
          const data = await response.json();
          setResults(
            (data.orders || []).map((order: Record<string, unknown>) => ({
              id: order.id as string,
              orderNumber: order.orderNumber as string,
              personName: order.person
                ? `${(order.person as Record<string, string>).firstName} ${(order.person as Record<string, string>).lastName}`
                : '-',
              testType: order.testType as string,
              completedAt: order.completedAt as string || order.updatedAt as string,
              resultFileUrl: order.resultFileUrl as string | null || null,
            }))
          );
        }
      } catch (error) {
        console.error('Failed to fetch results:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchResults();
  }, []);

  const columns = [
    {
      header: 'Order #',
      accessor: 'orderNumber' as const,
    },
    {
      header: 'Person',
      accessor: 'personName' as const,
    },
    {
      header: 'Test Type',
      accessor: 'testType' as const,
    },
    {
      header: 'Status',
      accessor: () => (
        <Badge className="bg-green-100 text-green-800 font-medium" variant="secondary">
          Complete
        </Badge>
      ),
    },
    {
      header: 'Completed',
      accessor: (item: CompletedOrder) =>
        item.completedAt
          ? format(new Date(item.completedAt), 'MMM d, yyyy')
          : '-',
    },
    {
      header: 'Download',
      accessor: (item: CompletedOrder) =>
        item.resultFileUrl ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              window.open(item.resultFileUrl!, '_blank');
            }}
          >
            <Download className="h-4 w-4" />
          </Button>
        ) : (
          <span className="text-sm text-muted-foreground">N/A</span>
        ),
      className: 'w-[80px]',
    },
  ];

  return (
    <DataTable
      data={results}
      columns={columns}
      loading={loading}
      emptyMessage="No completed results available yet."
    />
  );
}
