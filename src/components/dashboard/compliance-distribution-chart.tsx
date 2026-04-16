'use client';

import { useEffect, useState } from 'react';

interface Distribution {
  excellent: number;
  good: number;
  fair: number;
  poor: number;
}

const BUCKETS: Array<{
  key: keyof Distribution;
  label: string;
  range: string;
  color: string;
}> = [
  { key: 'excellent', label: 'Excellent', range: '90+', color: '#16a34a' },
  { key: 'good', label: 'Good', range: '80-89', color: '#65a30d' },
  { key: 'fair', label: 'Fair', range: '60-79', color: '#ca8a04' },
  { key: 'poor', label: 'Poor', range: '<60', color: '#dc2626' },
];

export function ComplianceDistributionChart() {
  const [data, setData] = useState<Distribution | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/dashboard/compliance-distribution');
        if (!res.ok) throw new Error('Request failed');
        const json = await res.json();
        if (!cancelled) {
          setData({
            excellent: Number(json.excellent) || 0,
            good: Number(json.good) || 0,
            fair: Number(json.fair) || 0,
            poor: Number(json.poor) || 0,
          });
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load chart');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const total = data.excellent + data.good + data.fair + data.poor;

  if (total === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
        No compliance data yet.
      </div>
    );
  }

  const max = Math.max(data.excellent, data.good, data.fair, data.poor, 1);

  return (
    <div className="space-y-2">
      {BUCKETS.map((b) => {
        const value = data[b.key];
        const pct = (value / max) * 100;
        return (
          <div key={b.key} className="flex items-center gap-3 text-sm">
            <div className="w-28 shrink-0">
              <div className="font-medium">{b.label}</div>
              <div className="text-xs text-muted-foreground">{b.range}</div>
            </div>
            <div className="flex-1 relative h-6 bg-muted rounded overflow-hidden">
              <div
                className="h-full rounded transition-all"
                style={{
                  width: `${pct}%`,
                  backgroundColor: b.color,
                  minWidth: value > 0 ? 4 : 0,
                }}
              />
            </div>
            <div className="w-10 text-right tabular-nums font-medium">
              {value}
            </div>
          </div>
        );
      })}
      <div className="pt-2 text-xs text-muted-foreground text-right">
        {total} total driver{total === 1 ? '' : 's'}
      </div>
    </div>
  );
}
