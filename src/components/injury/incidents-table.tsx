'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus } from 'lucide-react';

interface Incident {
  id: string;
  incidentNumber: string;
  incidentDate: string;
  status: string;
  severity: string;
  oshaRecordable: boolean;
  injuryType: string;
  location: string;
  lostDaysCount: number;
  restrictedDaysCount: number;
  person?: { id: string; firstName: string; lastName: string };
  clientOrg?: { id: string; name: string } | null;
}

const statusColors: Record<string, string> = {
  open: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  in_treatment: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  rtw_eval_pending: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  rtw_full_duty: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  rtw_restricted: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  closed: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  litigation: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
};

const severityColors: Record<string, string> = {
  first_aid: 'bg-gray-100 text-gray-700',
  medical: 'bg-blue-100 text-blue-800',
  lost_time: 'bg-orange-100 text-orange-800',
  restricted_duty: 'bg-yellow-100 text-yellow-800',
  fatality: 'bg-red-200 text-red-900 font-bold',
};

function formatDate(d: string | null | undefined): string {
  if (!d) return '-';
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return '-';
  }
}

export function IncidentsTable() {
  const router = useRouter();
  const [rows, setRows] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [oshaFilter, setOshaFilter] = useState('all');

  const fetchData = useCallback(async () => {
    const qs = new URLSearchParams();
    if (statusFilter !== 'all') qs.set('status', statusFilter);
    if (severityFilter !== 'all') qs.set('severity', severityFilter);
    if (oshaFilter === 'recordable') qs.set('oshaRecordable', 'true');
    if (oshaFilter === 'not_recordable') qs.set('oshaRecordable', 'false');
    try {
      const res = await fetch(`/api/injury/incidents?${qs.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRows(data.incidents || []);
      }
    } catch (err) {
      console.error('[incidents-table] fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, severityFilter, oshaFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const columns = [
    {
      header: 'Case #',
      accessor: (r: Incident) => <span className="font-mono text-xs">{r.incidentNumber}</span>,
    },
    {
      header: 'Worker',
      accessor: (r: Incident) =>
        r.person ? `${r.person.firstName} ${r.person.lastName}` : 'Unknown',
    },
    {
      header: 'Incident Date',
      accessor: (r: Incident) => formatDate(r.incidentDate),
    },
    {
      header: 'Type',
      accessor: (r: Incident) => r.injuryType.replace(/_/g, ' '),
    },
    {
      header: 'Severity',
      accessor: (r: Incident) => (
        <Badge className={severityColors[r.severity] ?? ''}>
          {r.severity.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      header: 'Status',
      accessor: (r: Incident) => (
        <Badge className={statusColors[r.status] ?? ''}>
          {r.status.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      header: 'OSHA',
      accessor: (r: Incident) =>
        r.oshaRecordable ? (
          <Badge className="bg-red-100 text-red-800">Recordable</Badge>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        ),
    },
    {
      header: 'Lost / Restr.',
      accessor: (r: Incident) => `${r.lostDaysCount} / ${r.restrictedDaysCount}`,
    },
  ];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_treatment">In Treatment</SelectItem>
            <SelectItem value="rtw_eval_pending">RTW Eval Pending</SelectItem>
            <SelectItem value="rtw_full_duty">RTW Full Duty</SelectItem>
            <SelectItem value="rtw_restricted">RTW Restricted</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
            <SelectItem value="litigation">Litigation</SelectItem>
          </SelectContent>
        </Select>

        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="All severities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            <SelectItem value="first_aid">First Aid</SelectItem>
            <SelectItem value="medical">Medical</SelectItem>
            <SelectItem value="lost_time">Lost Time</SelectItem>
            <SelectItem value="restricted_duty">Restricted Duty</SelectItem>
            <SelectItem value="fatality">Fatality</SelectItem>
          </SelectContent>
        </Select>

        <Select value={oshaFilter} onValueChange={setOshaFilter}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="OSHA" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All cases</SelectItem>
            <SelectItem value="recordable">Recordable only</SelectItem>
            <SelectItem value="not_recordable">Non-recordable</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={() => router.push('/injury/osha-300')}>
            OSHA 300 Log
          </Button>
          <Button onClick={() => router.push('/injury/incidents/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Report Incident
          </Button>
        </div>
      </div>

      <DataTable
        data={rows}
        columns={columns}
        loading={loading}
        emptyMessage="No incidents yet. Click 'Report Incident' to create one."
        onRowClick={(r) => router.push(`/injury/incidents/${r.id}`)}
      />
    </>
  );
}
