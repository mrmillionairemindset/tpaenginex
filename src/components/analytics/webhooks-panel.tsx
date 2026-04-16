'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { StatCard } from '@/components/ui/stat-card';
import { useToast } from '@/components/ui/use-toast';
import { formatDistanceToNow } from 'date-fns';
import {
  Webhook,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

interface PerDay {
  date: string;
  success: number;
  failed: number;
}

interface ByEvent {
  event: string;
  count: number;
  successRate: number;
}

interface BySubscription {
  subscriptionId: string;
  url: string;
  count: number;
  failureRate: number;
}

interface RecentFailure {
  id: string;
  subscriptionId: string;
  event: string;
  url: string;
  responseStatus: number | null;
  errorMessage: string | null;
  status: string;
  attempts: number;
  createdAt: string;
}

interface WebhooksData {
  totalDeliveries: number;
  successful: number;
  failed: number;
  deadLetter: number;
  successRate: number;
  perDay: PerDay[];
  byEvent: ByEvent[];
  bySubscription: BySubscription[];
  recentFailures: RecentFailure[];
}

interface WebhooksPanelProps {
  days: number;
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

function formatPercent(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

/**
 * Circular success rate gauge. 0-100% arc.
 */
function SuccessRateGauge({ rate }: { rate: number }) {
  const size = 160;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, rate));
  const offset = circumference * (1 - clamped);

  const color =
    clamped >= 0.95
      ? 'rgb(22, 163, 74)'
      : clamped >= 0.8
      ? 'rgb(234, 179, 8)'
      : 'rgb(220, 38, 38)';

  return (
    <div className="flex items-center justify-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeOpacity={0.1}
            strokeWidth={stroke}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold">{formatPercent(clamped)}</span>
          <span className="text-xs text-muted-foreground">success rate</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Horizontal bar chart by event — simple SVG per row.
 */
function EventBarChart({ data }: { data: ByEvent[] }) {
  if (data.length === 0) {
    return (
      <div className="h-24 flex items-center justify-center text-sm text-muted-foreground">
        No deliveries in this period.
      </div>
    );
  }

  const max = Math.max(1, ...data.map((d) => d.count));

  return (
    <div className="space-y-2">
      {data.map((d) => {
        const widthPct = (d.count / max) * 100;
        const successBarPct = widthPct * d.successRate;
        return (
          <div key={d.event} className="text-xs">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-mono truncate">{d.event}</span>
              <span className="text-muted-foreground shrink-0">
                {formatNumber(d.count)} · {formatPercent(d.successRate)}
              </span>
            </div>
            <div className="relative h-3 rounded bg-muted overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-red-500/70"
                style={{ width: `${widthPct}%` }}
              />
              <div
                className="absolute inset-y-0 left-0 bg-green-500"
                style={{ width: `${successBarPct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function WebhooksPanel({ days }: WebhooksPanelProps) {
  const { toast } = useToast();
  const [data, setData] = useState<WebhooksData | null>(null);
  const [loading, setLoading] = useState(true);
  const [redeliveringId, setRedeliveringId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics/webhooks?days=${days}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `Request failed (${res.status})`);
      }
      const json = (await res.json()) as WebhooksData;
      setData(json);
    } catch (e: any) {
      toast({
        title: 'Failed to load webhook analytics',
        description: e?.message || 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [days, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRedeliver = async (failure: RecentFailure) => {
    setRedeliveringId(failure.id);
    try {
      const res = await fetch(
        `/api/webhooks/${failure.subscriptionId}/redeliver`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deliveryId: failure.id }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `Request failed (${res.status})`);
      }
      toast({
        title: 'Delivery re-queued',
        description: `Event ${failure.event} will retry shortly.`,
      });
      await load();
    } catch (e: any) {
      toast({
        title: 'Failed to re-queue delivery',
        description: e?.message || 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setRedeliveringId(null);
    }
  };

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
          title="Total Deliveries"
          value={formatNumber(data.totalDeliveries)}
          icon={Webhook}
        />
        <StatCard
          title="Successful"
          value={formatNumber(data.successful)}
          icon={CheckCircle2}
        />
        <StatCard
          title="Failed"
          value={formatNumber(data.failed)}
          icon={XCircle}
        />
        <StatCard
          title="Dead Letter"
          value={formatNumber(data.deadLetter)}
          icon={AlertTriangle}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <SuccessRateGauge rate={data.successRate} />
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Based on {formatNumber(data.successful + data.failed + data.deadLetter)}{' '}
              resolved deliveries
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Deliveries by Event</CardTitle>
          </CardHeader>
          <CardContent>
            <EventBarChart data={data.byEvent} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Subscriptions</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            data={data.bySubscription.map((s) => ({ id: s.subscriptionId, ...s }))}
            columns={[
              {
                header: 'URL',
                accessor: (row) => (
                  <span className="font-mono text-xs truncate block max-w-md">
                    {row.url}
                  </span>
                ),
              },
              {
                header: 'Deliveries',
                accessor: (row) => formatNumber(row.count),
                className: 'text-right w-28',
              },
              {
                header: 'Failure Rate',
                accessor: (row) => (
                  <Badge
                    variant={
                      row.failureRate >= 0.1
                        ? 'destructive'
                        : row.failureRate > 0
                        ? 'outline'
                        : 'secondary'
                    }
                  >
                    {formatPercent(row.failureRate)}
                  </Badge>
                ),
                className: 'text-right w-32',
              },
            ]}
            emptyMessage="No subscription activity."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Failures</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            data={data.recentFailures}
            columns={[
              {
                header: 'Event',
                accessor: (row) => (
                  <span className="font-mono text-xs">{row.event}</span>
                ),
              },
              {
                header: 'URL',
                accessor: (row) => (
                  <span
                    className="font-mono text-xs truncate block max-w-xs"
                    title={row.url}
                  >
                    {row.url}
                  </span>
                ),
              },
              {
                header: 'Status',
                accessor: (row) => (
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        row.status === 'dead_letter' ? 'destructive' : 'outline'
                      }
                    >
                      {row.status === 'dead_letter' ? 'Dead Letter' : 'Failed'}
                    </Badge>
                    {row.responseStatus != null && (
                      <span className="text-xs text-muted-foreground">
                        {row.responseStatus}
                      </span>
                    )}
                  </div>
                ),
                className: 'w-48',
              },
              {
                header: 'Attempts',
                accessor: (row) => String(row.attempts),
                className: 'w-20 text-right',
              },
              {
                header: 'When',
                accessor: (row) => (
                  <span
                    className="text-xs text-muted-foreground"
                    title={new Date(row.createdAt).toLocaleString()}
                  >
                    {formatDistanceToNow(new Date(row.createdAt), {
                      addSuffix: true,
                    })}
                  </span>
                ),
                className: 'w-32',
              },
              {
                header: '',
                accessor: (row) => (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={redeliveringId === row.id}
                    onClick={() => handleRedeliver(row)}
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 mr-1.5 ${
                        redeliveringId === row.id ? 'animate-spin' : ''
                      }`}
                    />
                    Redeliver
                  </Button>
                ),
                className: 'w-32 text-right',
              },
            ]}
            emptyMessage="No failed deliveries in this period."
          />
        </CardContent>
      </Card>
    </div>
  );
}
