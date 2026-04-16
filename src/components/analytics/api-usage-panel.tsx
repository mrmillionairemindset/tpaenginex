'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { StatCard } from '@/components/ui/stat-card';
import { useToast } from '@/components/ui/use-toast';
import { Activity, CheckCircle2, XCircle, Timer } from 'lucide-react';

interface PerDay {
  date: string;
  total: number;
  failed: number;
}

interface TopEndpoint {
  path: string;
  method: string;
  count: number;
}

interface TopKey {
  keyId: string;
  name: string;
  keyPrefix: string;
  count: number;
}

interface StatusBucket {
  statusCode: number;
  count: number;
}

interface SlowEndpoint {
  path: string;
  method: string;
  avgMs: number;
  count: number;
}

interface ApiUsageData {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgDurationMs: number;
  perDay: PerDay[];
  topEndpoints: TopEndpoint[];
  topKeys: TopKey[];
  statusDistribution: StatusBucket[];
  slowestEndpoints: SlowEndpoint[];
}

interface ApiUsagePanelProps {
  days: number;
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

function methodBadgeVariant(
  method: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (method.toUpperCase()) {
    case 'GET':
      return 'secondary';
    case 'POST':
      return 'default';
    case 'DELETE':
      return 'destructive';
    default:
      return 'outline';
  }
}

function statusBadgeVariant(
  code: number
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (code >= 500) return 'destructive';
  if (code >= 400) return 'destructive';
  if (code >= 300) return 'outline';
  return 'secondary';
}

function RequestsChart({ data }: { data: PerDay[] }) {
  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
        No requests in this period.
      </div>
    );
  }

  const width = 600;
  const height = 220;
  const padLeft = 40;
  const padRight = 12;
  const padTop = 12;
  const padBottom = 28;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  const maxCount = Math.max(1, ...data.map((d) => d.total));
  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;

  const totalPoints = data
    .map((d, i) => {
      const x = padLeft + i * stepX;
      const y = padTop + innerH - (d.total / maxCount) * innerH;
      return `${x},${y}`;
    })
    .join(' ');

  const failedPoints = data
    .map((d, i) => {
      const x = padLeft + i * stepX;
      const y = padTop + innerH - (d.failed / maxCount) * innerH;
      return `${x},${y}`;
    })
    .join(' ');

  const yTicks = 4;
  const tickValues = Array.from({ length: yTicks + 1 }, (_, i) =>
    Math.round((maxCount * i) / yTicks)
  );

  const xLabelIndices = data.length <= 7
    ? data.map((_, i) => i)
    : [0, Math.floor(data.length / 2), data.length - 1];

  const formatDate = (iso: string) => {
    const d = new Date(iso + 'T00:00:00Z');
    return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
  };

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto"
      preserveAspectRatio="none"
    >
      {tickValues.map((v, i) => {
        const y = padTop + innerH - (i / yTicks) * innerH;
        return (
          <g key={i}>
            <line
              x1={padLeft}
              x2={width - padRight}
              y1={y}
              y2={y}
              stroke="currentColor"
              strokeOpacity={0.1}
              strokeWidth={1}
            />
            <text
              x={padLeft - 6}
              y={y + 3}
              textAnchor="end"
              className="fill-muted-foreground"
              fontSize={10}
            >
              {v}
            </text>
          </g>
        );
      })}

      {xLabelIndices.map((idx) => {
        const x = padLeft + idx * stepX;
        return (
          <text
            key={idx}
            x={x}
            y={height - 8}
            textAnchor="middle"
            className="fill-muted-foreground"
            fontSize={10}
          >
            {formatDate(data[idx].date)}
          </text>
        );
      })}

      <polyline
        fill="none"
        stroke="rgb(37, 99, 235)"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        points={totalPoints}
      />
      <polyline
        fill="none"
        stroke="rgb(220, 38, 38)"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeDasharray="4 3"
        points={failedPoints}
      />

      {data.map((d, i) => {
        const x = padLeft + i * stepX;
        const y = padTop + innerH - (d.total / maxCount) * innerH;
        return (
          <circle key={`t-${i}`} cx={x} cy={y} r={2.5} fill="rgb(37, 99, 235)">
            <title>{`${d.date}: ${d.total} total, ${d.failed} failed`}</title>
          </circle>
        );
      })}
    </svg>
  );
}

export function ApiUsagePanel({ days }: ApiUsagePanelProps) {
  const { toast } = useToast();
  const [data, setData] = useState<ApiUsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/analytics/api-usage?days=${days}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error || `Request failed (${res.status})`);
        }
        const json = (await res.json()) as ApiUsageData;
        if (!cancelled) setData(json);
      } catch (e: any) {
        if (!cancelled) {
          toast({
            title: 'Failed to load API usage',
            description: e?.message || 'Unknown error',
            variant: 'destructive',
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [days, toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        No data available.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Requests"
          value={formatNumber(data.totalRequests)}
          icon={Activity}
        />
        <StatCard
          title="Successful"
          value={formatNumber(data.successfulRequests)}
          icon={CheckCircle2}
        />
        <StatCard
          title="Failed"
          value={formatNumber(data.failedRequests)}
          icon={XCircle}
        />
        <StatCard
          title="Avg Duration"
          value={`${formatNumber(data.avgDurationMs)} ms`}
          icon={Timer}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Requests per day</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-0.5 w-4"
                style={{ backgroundColor: 'rgb(37, 99, 235)' }}
              />
              Total
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-0.5 w-4 border-t-2 border-dashed"
                style={{ borderColor: 'rgb(220, 38, 38)' }}
              />
              Failed
            </span>
          </div>
          <RequestsChart data={data.perDay} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Endpoints</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              data={data.topEndpoints.map((e, i) => ({
                id: `${e.method}-${e.path}-${i}`,
                ...e,
              }))}
              columns={[
                {
                  header: 'Method',
                  accessor: (row) => (
                    <Badge variant={methodBadgeVariant(row.method)}>
                      {row.method}
                    </Badge>
                  ),
                  className: 'w-24',
                },
                {
                  header: 'Path',
                  accessor: (row) => (
                    <span className="font-mono text-xs">{row.path}</span>
                  ),
                },
                {
                  header: 'Count',
                  accessor: (row) => formatNumber(row.count),
                  className: 'text-right w-24',
                },
              ]}
              emptyMessage="No endpoint activity."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top API Keys</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              data={data.topKeys.map((k) => ({ id: k.keyId, ...k }))}
              columns={[
                {
                  header: 'Name',
                  accessor: (row) => <span className="font-medium">{row.name}</span>,
                },
                {
                  header: 'Prefix',
                  accessor: (row) => (
                    <span className="font-mono text-xs text-muted-foreground">
                      {row.keyPrefix}
                    </span>
                  ),
                },
                {
                  header: 'Requests',
                  accessor: (row) => formatNumber(row.count),
                  className: 'text-right w-24',
                },
              ]}
              emptyMessage="No API key activity."
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Status Code Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              data={data.statusDistribution.map((s) => ({
                id: String(s.statusCode),
                ...s,
              }))}
              columns={[
                {
                  header: 'Status',
                  accessor: (row) => (
                    <Badge variant={statusBadgeVariant(row.statusCode)}>
                      {row.statusCode}
                    </Badge>
                  ),
                  className: 'w-24',
                },
                {
                  header: 'Count',
                  accessor: (row) => formatNumber(row.count),
                  className: 'text-right',
                },
              ]}
              emptyMessage="No status data."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Slowest Endpoints</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              data={data.slowestEndpoints.map((e, i) => ({
                id: `${e.method}-${e.path}-${i}`,
                ...e,
              }))}
              columns={[
                {
                  header: 'Method',
                  accessor: (row) => (
                    <Badge variant={methodBadgeVariant(row.method)}>
                      {row.method}
                    </Badge>
                  ),
                  className: 'w-24',
                },
                {
                  header: 'Path',
                  accessor: (row) => (
                    <span className="font-mono text-xs">{row.path}</span>
                  ),
                },
                {
                  header: 'Avg',
                  accessor: (row) => `${formatNumber(row.avgMs)} ms`,
                  className: 'text-right w-24',
                },
                {
                  header: 'Samples',
                  accessor: (row) => formatNumber(row.count),
                  className: 'text-right w-20',
                },
              ]}
              emptyMessage="Not enough samples for latency analysis."
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
