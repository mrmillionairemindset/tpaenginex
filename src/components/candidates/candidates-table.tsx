'use client';

import { useEffect, useState } from 'react';
import { DataTable } from '@/components/ui/data-table';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';

interface Candidate {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  createdAt: string;
  _count: {
    orders: number;
  };
}

export function CandidatesTable() {
  const router = useRouter();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCandidates() {
      try {
        const response = await fetch('/api/candidates');
        if (response.ok) {
          const data = await response.json();
          setCandidates(data.candidates);
        }
      } catch (error) {
        console.error('Failed to fetch candidates:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchCandidates();
  }, []);

  const columns = [
    {
      header: 'Name',
      accessor: (candidate: Candidate) =>
        `${candidate.firstName} ${candidate.lastName}`,
    },
    {
      header: 'Email',
      accessor: (candidate: Candidate) => candidate.email || '—',
    },
    {
      header: 'Phone',
      accessor: (candidate: Candidate) => candidate.phone || '—',
    },
    {
      header: 'Location',
      accessor: (candidate: Candidate) => {
        if (candidate.city && candidate.state) {
          return `${candidate.city}, ${candidate.state}`;
        }
        return '—';
      },
    },
    {
      header: 'Orders',
      accessor: (candidate: Candidate) => candidate._count.orders,
    },
    {
      header: 'Added',
      accessor: (candidate: Candidate) =>
        formatDistanceToNow(new Date(candidate.createdAt), { addSuffix: true }),
    },
  ];

  return (
    <DataTable
      data={candidates}
      columns={columns}
      loading={loading}
      emptyMessage="No candidates found. Create an order to add your first candidate."
      onRowClick={(candidate) => router.push(`/candidates/${candidate.id}`)}
    />
  );
}
