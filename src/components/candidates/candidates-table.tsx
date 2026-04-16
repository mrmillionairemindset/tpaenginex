'use client';

import { useEffect, useState } from 'react';
import { DataTable } from '@/components/ui/data-table';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';

interface Person {
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
  const [persons, setPersons] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPersons() {
      try {
        const response = await fetch('/api/candidates');
        if (response.ok) {
          const data = await response.json();
          setPersons(data.persons || data.candidates);
        }
      } catch (error) {
        console.error('Failed to fetch persons:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchPersons();
  }, []);

  const columns = [
    {
      header: 'Name',
      accessor: (person: Person) =>
        `${person.firstName} ${person.lastName}`,
    },
    {
      header: 'Email',
      accessor: (person: Person) => person.email || '—',
    },
    {
      header: 'Phone',
      accessor: (person: Person) => person.phone || '—',
    },
    {
      header: 'Location',
      accessor: (person: Person) => {
        if (person.city && person.state) {
          return `${person.city}, ${person.state}`;
        }
        return '—';
      },
    },
    {
      header: 'Orders',
      accessor: (person: Person) => person._count.orders,
    },
    {
      header: 'Added',
      accessor: (person: Person) =>
        formatDistanceToNow(new Date(person.createdAt), { addSuffix: true }),
    },
  ];

  return (
    <DataTable
      data={persons}
      columns={columns}
      loading={loading}
      emptyMessage="No persons found. Create an order to add your first person."
      onRowClick={(person) => router.push(`/candidates/${person.id}`)}
    />
  );
}
