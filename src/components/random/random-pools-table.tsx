'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface Pool {
  id: string;
  periodStartsAt: string;
  periodEndsAt: string;
  status: 'open' | 'selected' | 'closed';
  totalEligible: number;
  totalSelectedDrug: number;
  totalSelectedAlcohol: number;
  selectedAt: string | null;
  program: {
    id: string;
    name: string;
    programType: string;
    periodType: string;
  };
}

const poolStatusBadge = (s: Pool['status']) => {
  const map: Record<string, { label: string; className: string }> = {
    open: { label: 'Open', className: 'border-transparent bg-blue-100 text-blue-800' },
    selected: {
      label: 'Selected',
      className: 'border-transparent bg-green-100 text-green-800',
    },
    closed: {
      label: 'Closed',
      className: 'border-transparent bg-gray-200 text-gray-700',
    },
  };
  const cfg = map[s];
  return <Badge className={cfg.className}>{cfg.label}</Badge>;
};

export function RandomPoolsTable() {
  const router = useRouter();
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/random/pools');
      if (res.ok) {
        const data = await res.json();
        setPools(data.pools || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const columns = [
    {
      header: 'Program',
      accessor: (p: Pool) => <span className="font-medium">{p.program.name}</span>,
    },
    {
      header: 'Type',
      accessor: (p: Pool) => (
        <Badge className="border-transparent bg-blue-100 text-blue-800">
          {p.program.programType.toUpperCase()}
        </Badge>
      ),
    },
    {
      header: 'Period',
      accessor: (p: Pool) =>
        `${format(new Date(p.periodStartsAt), 'MMM d, yyyy')} - ${format(new Date(p.periodEndsAt), 'MMM d, yyyy')}`,
    },
    { header: 'Status', accessor: (p: Pool) => poolStatusBadge(p.status) },
    { header: 'Eligible', accessor: (p: Pool) => String(p.totalEligible) },
    { header: 'Drug', accessor: (p: Pool) => String(p.totalSelectedDrug) },
    { header: 'Alcohol', accessor: (p: Pool) => String(p.totalSelectedAlcohol) },
    {
      header: 'Selected At',
      accessor: (p: Pool) =>
        p.selectedAt ? format(new Date(p.selectedAt), 'MMM d, yyyy') : '—',
    },
  ];

  return (
    <DataTable
      data={pools}
      columns={columns}
      loading={loading}
      emptyMessage="No pools yet."
      onRowClick={(p) => router.push(`/random/pools/${p.id}`)}
    />
  );
}
