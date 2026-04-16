'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
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

interface AuditLog {
  id: string;
  tpaOrgId: string | null;
  actorUserId: string | null;
  actorEmail: string | null;
  entityType: string;
  entityId: string;
  action: string;
  diffJson: Record<string, any> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  actor: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

const ENTITY_TYPES = [
  { value: 'all', label: 'All entity types' },
  { value: 'driver_application', label: 'Driver Application' },
  { value: 'investigation', label: 'Investigation' },
  { value: 'review', label: 'Review' },
  { value: 'checklist', label: 'Checklist' },
  { value: 'qualification', label: 'Qualification' },
  { value: 'order', label: 'Order' },
];

export function AuditLogTable() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '50');
      if (entityType && entityType !== 'all') params.set('entityType', entityType);
      if (startDate) params.set('startDate', new Date(startDate).toISOString());
      if (endDate) {
        // Include the entire end day
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        params.set('endDate', end.toISOString());
      }

      const res = await fetch(`/api/audit-logs?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Failed to load audit logs');
      }
      const data = await res.json();
      setLogs(data.logs || []);
      setPagination(data.pagination || null);
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to load audit logs',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [page, entityType, startDate, endDate, toast]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleResetFilters = () => {
    setEntityType('all');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const actionVariant = (action: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    const lower = action.toLowerCase();
    if (lower.includes('delete') || lower.includes('remove')) return 'destructive';
    if (lower.includes('create') || lower.includes('add')) return 'default';
    if (lower.includes('update') || lower.includes('edit')) return 'secondary';
    return 'outline';
  };

  const columns = [
    {
      header: 'Date/Time',
      accessor: (log: AuditLog) => (
        <span className="text-sm">
          {format(new Date(log.createdAt), 'MMM d, yyyy h:mm:ss a')}
        </span>
      ),
    },
    {
      header: 'Actor',
      accessor: (log: AuditLog) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium">
            {log.actor?.name || log.actorEmail || 'System'}
          </span>
          {log.actor?.email && (
            <span className="text-xs text-muted-foreground">{log.actor.email}</span>
          )}
        </div>
      ),
    },
    {
      header: 'Entity Type',
      accessor: (log: AuditLog) => (
        <Badge variant="outline">{log.entityType}</Badge>
      ),
    },
    {
      header: 'Action',
      accessor: (log: AuditLog) => (
        <Badge variant={actionVariant(log.action)}>{log.action}</Badge>
      ),
    },
    {
      header: 'Entity ID',
      accessor: (log: AuditLog) => (
        <code className="font-mono text-xs" title={log.entityId}>
          {log.entityId.slice(0, 8)}...
        </code>
      ),
    },
    {
      header: 'Diff',
      accessor: (log: AuditLog) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setSelectedLog(log)}
          disabled={!log.diffJson}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label htmlFor="entityType">Entity Type</Label>
            <Select
              value={entityType}
              onValueChange={(val) => {
                setEntityType(val);
                setPage(1);
              }}
            >
              <SelectTrigger id="entityType" className="mt-1">
                <SelectValue placeholder="All entity types" />
              </SelectTrigger>
              <SelectContent>
                {ENTITY_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="startDate">Start Date</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="endDate">End Date</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="mt-1"
            />
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={handleResetFilters}>
              Reset Filters
            </Button>
          </div>
        </div>
      </Card>

      <DataTable
        data={logs}
        columns={columns}
        loading={loading}
        emptyMessage="No audit logs found matching your filters"
      />

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((p) => p + 1)}
              disabled={!pagination.hasMore || loading}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Audit Log Diff</DialogTitle>
            <DialogDescription>
              {selectedLog && (
                <>
                  {selectedLog.entityType} / {selectedLog.action} /{' '}
                  {format(new Date(selectedLog.createdAt), 'MMM d, yyyy h:mm:ss a')}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto rounded-md bg-muted p-4">
            <pre className="text-xs font-mono whitespace-pre-wrap break-words">
              {selectedLog ? JSON.stringify(selectedLog.diffJson, null, 2) : ''}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
