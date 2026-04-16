'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { useToast } from '@/components/ui/use-toast';
import { FileText, Download, Loader2 } from 'lucide-react';

interface ReportSummary {
  totalTests: number;
  completed: number;
  pending: number;
  cancelled: number;
  passRate: number;
  avgCompletionDays: number;
}

interface ClientBreakdown {
  id: string;
  clientId: string;
  clientName: string;
  totalTests: number;
  completed: number;
  pending: number;
  cancelled: number;
  passRate: number;
  randomPoolSize: number;
  randomTestsRequired: number;
  randomTestsCompleted: number;
}

interface ReportData {
  period: { start: string; end: string };
  generatedAt: string;
  summary: ReportSummary;
  byClient: ClientBreakdown[];
}

export function DotComplianceReport() {
  const { toast } = useToast();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [clientOrgId, setClientOrgId] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ReportData | null>(null);

  const handleGenerate = async () => {
    if (!startDate || !endDate) {
      toast({
        title: 'Missing dates',
        description: 'Please select both a start and end date.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
      });
      if (clientOrgId) {
        params.set('clientOrgId', clientOrgId);
      }

      const res = await fetch(`/api/reports/dot-compliance?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to generate report');
      }

      const data = await res.json();
      // Add id field to each client row for DataTable compatibility
      const byClient = (data.report.byClient || []).map(
        (c: Omit<ClientBreakdown, 'id'>, idx: number) => ({
          ...c,
          id: c.clientId || String(idx),
        })
      );
      setReport({ ...data.report, byClient });
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to generate report',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      header: 'Client',
      accessor: (item: ClientBreakdown) => (
        <span className="font-medium">{item.clientName}</span>
      ),
    },
    {
      header: 'Total Tests',
      accessor: (item: ClientBreakdown) => item.totalTests,
      className: 'text-right',
    },
    {
      header: 'Completed',
      accessor: (item: ClientBreakdown) => item.completed,
      className: 'text-right',
    },
    {
      header: 'Pending',
      accessor: (item: ClientBreakdown) => (
        <Badge variant={item.pending > 0 ? 'secondary' : 'outline'}>
          {item.pending}
        </Badge>
      ),
      className: 'text-right',
    },
    {
      header: 'Cancelled',
      accessor: (item: ClientBreakdown) => item.cancelled,
      className: 'text-right',
    },
    {
      header: 'Pass Rate',
      accessor: (item: ClientBreakdown) => (
        <Badge variant={item.passRate >= 95 ? 'default' : 'destructive'}>
          {item.passRate}%
        </Badge>
      ),
      className: 'text-right',
    },
    {
      header: 'Random Completed',
      accessor: (item: ClientBreakdown) => item.randomTestsCompleted,
      className: 'text-right',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Report Parameters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientOrgId">Client ID (optional)</Label>
              <Input
                id="clientOrgId"
                type="text"
                placeholder="Filter by client..."
                value={clientOrgId}
                onChange={(e) => setClientOrgId(e.target.value)}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={handleGenerate} disabled={loading}>
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Generate Report
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const params = new URLSearchParams({ startDate, endDate });
                  if (clientOrgId) params.set('clientOrgId', clientOrgId);
                  window.location.href = `/api/reports/dot-compliance/pdf?${params.toString()}`;
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Export PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {report && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total DOT Tests
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {report.summary.totalTests}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Completed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {report.summary.completed}
                </div>
                <p className="text-xs text-muted-foreground">
                  {report.summary.totalTests > 0
                    ? Math.round(
                        (report.summary.completed / report.summary.totalTests) * 100
                      )
                    : 0}
                  % completion rate
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Pass Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {report.summary.passRate}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Based on finalized results
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Avg Completion
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {report.summary.avgCompletionDays} days
                </div>
                <p className="text-xs text-muted-foreground">
                  From order to completion
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Pending / Cancelled summary */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Pending
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">
                  {report.summary.pending}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Cancelled
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {report.summary.cancelled}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Client Breakdown Table */}
          <Card>
            <CardHeader>
              <CardTitle>Client Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                data={report.byClient}
                columns={columns}
                emptyMessage="No DOT tests found for the selected period."
              />
            </CardContent>
          </Card>

          {/* Report metadata */}
          <p className="text-xs text-muted-foreground">
            Report generated {new Date(report.generatedAt).toLocaleString()} for period{' '}
            {report.period.start} to {report.period.end}
          </p>
        </>
      )}
    </div>
  );
}
