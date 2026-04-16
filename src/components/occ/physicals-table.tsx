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
import { Plus } from 'lucide-react';

interface PhysicalExam {
  id: string;
  examType: string;
  status: string;
  certificationStatus: string | null;
  scheduledFor: string | null;
  examDate: string | null;
  mecExpiresOn: string | null;
  fmcsaSubmissionStatus: string;
  certificateNumber: string | null;
  person?: { id: string; firstName: string; lastName: string };
  clientOrg?: { id: string; name: string } | null;
  examiner?: { id: string; name: string | null } | null;
}

const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  in_progress: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  abandoned: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

const fmcsaColors: Record<string, string> = {
  not_required: 'bg-gray-100 text-gray-600',
  pending: 'bg-yellow-100 text-yellow-800',
  submitted: 'bg-blue-100 text-blue-800',
  accepted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  error: 'bg-red-100 text-red-800',
};

function formatDate(d: string | null | undefined): string {
  if (!d) return '-';
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return '-';
  }
}

export function PhysicalsTable() {
  const router = useRouter();
  const [rows, setRows] = useState<PhysicalExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [examTypeFilter, setExamTypeFilter] = useState<string>('all');

  const fetchData = useCallback(async () => {
    const qs = new URLSearchParams();
    if (statusFilter !== 'all') qs.set('status', statusFilter);
    if (examTypeFilter !== 'all') qs.set('examType', examTypeFilter);

    try {
      const res = await fetch(`/api/occ/physicals?${qs.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRows(data.exams || []);
      }
    } catch (err) {
      console.error('[physicals-table] fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, examTypeFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const columns = [
    {
      header: 'Driver / Worker',
      accessor: (r: PhysicalExam) => (
        <span className="font-medium">
          {r.person ? `${r.person.firstName} ${r.person.lastName}` : 'Unknown'}
        </span>
      ),
    },
    {
      header: 'Type',
      accessor: (r: PhysicalExam) => r.examType.toUpperCase().replace(/_/g, ' '),
    },
    {
      header: 'Status',
      accessor: (r: PhysicalExam) => (
        <Badge className={statusColors[r.status] ?? ''}>
          {r.status.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      header: 'Scheduled',
      accessor: (r: PhysicalExam) => formatDate(r.scheduledFor),
    },
    {
      header: 'Exam Date',
      accessor: (r: PhysicalExam) => formatDate(r.examDate),
    },
    {
      header: 'MEC Expires',
      accessor: (r: PhysicalExam) => formatDate(r.mecExpiresOn),
    },
    {
      header: 'FMCSA',
      accessor: (r: PhysicalExam) => (
        <Badge className={fmcsaColors[r.fmcsaSubmissionStatus] ?? ''}>
          {r.fmcsaSubmissionStatus.replace(/_/g, ' ')}
        </Badge>
      ),
    },
  ];

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="abandoned">Abandoned</SelectItem>
          </SelectContent>
        </Select>

        <Select value={examTypeFilter} onValueChange={setExamTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="dot">DOT</SelectItem>
            <SelectItem value="non_dot">Non-DOT</SelectItem>
            <SelectItem value="pre_employment">Pre-Employment</SelectItem>
            <SelectItem value="return_to_duty">Return to Duty</SelectItem>
            <SelectItem value="follow_up">Follow-Up</SelectItem>
            <SelectItem value="annual">Annual</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto">
          <Button onClick={() => router.push('/occ/physicals/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Schedule Exam
          </Button>
        </div>
      </div>

      <DataTable
        data={rows}
        columns={columns}
        loading={loading}
        emptyMessage="No physical exams yet. Click 'Schedule Exam' to create one."
        onRowClick={(r) => router.push(`/occ/physicals/${r.id}`)}
      />
    </>
  );
}
