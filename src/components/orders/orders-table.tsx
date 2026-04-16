'use client';

import { useEffect, useState, useCallback } from 'react';
import { DataTable } from '@/components/ui/data-table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { SavedFiltersDropdown } from '@/components/saved-filters-dropdown';
import { OrderImportDialog } from '@/components/orders/order-import-dialog';
import { Download, Loader2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { usePolling } from '@/hooks/use-polling';

interface Order {
  id: string;
  orderNumber: string;
  status: 'new' | 'needs_site' | 'scheduled' | 'in_progress' | 'complete' | 'cancelled';
  testType: string;
  person: {
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
  clientLabel?: string | null;
  createdAt: string;
}

interface OrdersTableProps {
  userRole: string;
}

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'new', label: 'New' },
  { value: 'needs_site', label: 'Needs Site' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'results_uploaded', label: 'Results Uploaded' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'complete', label: 'Complete' },
  { value: 'cancelled', label: 'Cancelled' },
];

const BULK_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'new', label: 'New' },
  { value: 'needs_site', label: 'Needs Site' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'results_uploaded', label: 'Results Uploaded' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'needs_correction', label: 'Needs Correction' },
  { value: 'complete', label: 'Complete' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function OrdersTable({ userRole }: OrdersTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<string>('');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  const canBulkUpdate =
    userRole === 'tpa_admin' ||
    userRole === 'tpa_staff' ||
    userRole === 'platform_admin';

  const handleBulkStatusUpdate = async () => {
    if (!bulkStatus || selectedIds.length === 0) return;
    setBulkSubmitting(true);
    try {
      const res = await fetch('/api/orders/bulk-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds: selectedIds, status: bulkStatus }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update orders');
      }
      const data = await res.json();
      toast({
        title: 'Orders updated',
        description: `${data.updated} order(s) updated.`,
      });
      setSelectedIds([]);
      setBulkStatus('');
      await fetchOrders();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to update orders',
        variant: 'destructive',
      });
    } finally {
      setBulkSubmitting(false);
    }
  };

  const fetchOrders = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const qs = params.toString();
      const response = await fetch(`/api/orders${qs ? `?${qs}` : ''}`);
      if (response.ok) {
        const data = await response.json();
        setOrders(data.orders);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, startDate, endDate]);

  // Debounced fetch when filters change
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchOrders();
    }, 500);
    return () => clearTimeout(handler);
  }, [search, statusFilter, startDate, endDate, fetchOrders]);

  usePolling(fetchOrders);

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setStartDate('');
    setEndDate('');
  };

  const hasFilters = search || statusFilter || startDate || endDate;

  const isTpaUser = userRole.startsWith('tpa_') || userRole === 'platform_admin';

  const columns = [
    {
      header: 'Order #',
      accessor: 'orderNumber' as const,
    },
    {
      header: 'Person',
      accessor: (order: Order) =>
        `${order.person.firstName} ${order.person.lastName}`,
    },
    ...(isTpaUser
      ? [
          {
            header: 'Client',
            accessor: (order: Order) => order.clientOrg?.name || order.clientLabel || order.organization.name,
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
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3 p-4 border rounded-md bg-muted/30">
        <div className="flex-1 min-w-[200px]">
          <Label htmlFor="search" className="text-xs mb-1 block">Search</Label>
          <Input
            id="search"
            type="text"
            placeholder="Order #, person name, or jobsite..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="min-w-[160px]">
          <Label htmlFor="status" className="text-xs mb-1 block">Status</Label>
          <select
            id="status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="min-w-[150px]">
          <Label htmlFor="startDate" className="text-xs mb-1 block">Start Date</Label>
          <Input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="min-w-[150px]">
          <Label htmlFor="endDate" className="text-xs mb-1 block">End Date</Label>
          <Input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" />
            Clear filters
          </Button>
        )}
        <SavedFiltersDropdown
          pageKey="orders"
          currentFilters={{ search, statusFilter, startDate, endDate }}
          onApply={(f) => {
            setSearch(f.search || '');
            setStatusFilter(f.statusFilter || '');
            setStartDate(f.startDate || '');
            setEndDate(f.endDate || '');
          }}
        />
        <div className="ml-auto flex items-center gap-2">
          {canBulkUpdate && <OrderImportDialog onImported={fetchOrders} />}
          <Button
            variant="outline"
            size="sm"
            onClick={() => (window.location.href = '/api/orders/export')}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>
      {canBulkUpdate && selectedIds.length > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-md border bg-muted/40 px-4 py-2">
          <span className="text-sm font-medium">
            ({selectedIds.length} selected)
          </span>
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
            Clear
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <Select value={bulkStatus} onValueChange={setBulkStatus}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Change status..." />
              </SelectTrigger>
              <SelectContent>
                {BULK_STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={handleBulkStatusUpdate}
              disabled={!bulkStatus || bulkSubmitting}
            >
              {bulkSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Apply
            </Button>
          </div>
        </div>
      )}
      <DataTable
        data={orders}
        columns={columns}
        loading={loading}
        emptyMessage={hasFilters ? 'No orders match the current filters.' : 'No orders found. Create your first order to get started.'}
        onRowClick={(order) => router.push(`/orders/${order.id}`)}
        selectable={canBulkUpdate}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />
    </div>
  );
}
