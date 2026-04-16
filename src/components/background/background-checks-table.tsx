'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Plus } from 'lucide-react';

interface BackgroundCheck {
  id: string;
  status: string;
  submittedAt: string | null;
  completedAt: string | null;
  canceledAt: string | null;
  externalId: string | null;
  candidateInviteUrl: string | null;
  person?: { id: string; firstName: string; lastName: string; email: string };
  clientOrg?: { id: string; name: string } | null;
  package?: { id: string; name: string; providerPackageSlug: string; retailPriceCents: number };
}

const STATUS_COLORS: Record<string, string> = {
  clear: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  consider: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  suspended: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  dispute: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  pending: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  processing: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  canceled: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  expired: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
};

function formatDate(d: string | null | undefined): string {
  if (!d) return '-';
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return '-';
  }
}

export interface BackgroundChecksTableProps {
  /** If set, constrain the listing endpoint (e.g., client portal can use the default). */
  basePath?: string;
  /** Whether to show the "New Check" button (false for client portal). */
  canCreate?: boolean;
  /** Destination path when a row is clicked. */
  detailPathPrefix?: string;
}

export function BackgroundChecksTable({
  basePath = '/api/background/checks',
  canCreate = true,
  detailPathPrefix = '/background/checks',
}: BackgroundChecksTableProps) {
  const router = useRouter();
  const [rows, setRows] = useState<BackgroundCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');

  const fetchData = useCallback(async () => {
    const qs = new URLSearchParams();
    if (statusFilter !== 'all') qs.set('status', statusFilter);
    if (search.trim()) qs.set('search', search.trim());

    try {
      setLoading(true);
      const res = await fetch(`${basePath}?${qs.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRows(data.checks || []);
      }
    } catch (err) {
      console.error('[background-checks-table] fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, basePath]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const columns = [
    {
      header: 'Candidate',
      accessor: (r: BackgroundCheck) => (
        <span className="font-medium">
          {r.person ? `${r.person.firstName} ${r.person.lastName}` : 'Unknown'}
        </span>
      ),
    },
    {
      header: 'Package',
      accessor: (r: BackgroundCheck) => r.package?.name ?? '-',
    },
    {
      header: 'Client',
      accessor: (r: BackgroundCheck) => r.clientOrg?.name ?? '-',
    },
    {
      header: 'Status',
      accessor: (r: BackgroundCheck) => (
        <Badge className={STATUS_COLORS[r.status] ?? ''}>
          {r.status.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      header: 'Submitted',
      accessor: (r: BackgroundCheck) => formatDate(r.submittedAt),
    },
    {
      header: 'Completed',
      accessor: (r: BackgroundCheck) => formatDate(r.completedAt),
    },
  ];

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="clear">Clear</SelectItem>
            <SelectItem value="consider">Consider</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="dispute">Dispute</SelectItem>
            <SelectItem value="canceled">Canceled</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>

        <Input
          placeholder="Search by name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-[300px]"
        />

        {canCreate && (
          <div className="ml-auto">
            <Button onClick={() => router.push('/background/checks/new')}>
              <Plus className="mr-2 h-4 w-4" />
              New Check
            </Button>
          </div>
        )}
      </div>

      <DataTable
        data={rows}
        columns={columns}
        loading={loading}
        emptyMessage="No background checks yet."
        onRowClick={(r) => router.push(`${detailPathPrefix}/${r.id}`)}
      />
    </>
  );
}
