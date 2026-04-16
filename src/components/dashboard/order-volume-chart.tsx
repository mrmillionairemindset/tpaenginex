'use client';

import { useEffect, useState } from 'react';

interface DayPoint {
  date: string;
  count: number;
}

export function OrderVolumeChart() {
  const [data, setData] = useState<DayPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/dashboard/order-volume');
        if (!res.ok) throw new Error('Request failed');
        const json = await res.json();
        if (!cancelled) setData(json.data ?? []);
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

  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
        No order data in the last 30 days.
      </div>
    );
  }

  // Chart dimensions and padding
  const width = 600;
  const height = 200;
  const padLeft = 32;
  const padRight = 8;
  const padTop = 10;
  const padBottom = 24;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  const maxCount = Math.max(1, ...data.map((d) => d.count));
  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;

  const points = data
    .map((d, i) => {
      const x = padLeft + i * stepX;
      const y = padTop + innerH - (d.count / maxCount) * innerH;
      return `${x},${y}`;
    })
    .join(' ');

  // Y-axis: 4 ticks
  const yTicks = 4;
  const tickValues = Array.from({ length: yTicks + 1 }, (_, i) =>
    Math.round((maxCount * i) / yTicks)
  );

  // X-axis labels: first, middle, last
  const xLabelIndices = [0, Math.floor(data.length / 2), data.length - 1];
  const formatDate = (iso: string) => {
    const d = new Date(iso + 'T00:00:00Z');
    return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
  };

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto text-primary"
      preserveAspectRatio="none"
    >
      {/* Horizontal grid lines and y-axis labels */}
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

      {/* X-axis labels */}
      {xLabelIndices.map((idx) => {
        const x = padLeft + idx * stepX;
        return (
          <text
            key={idx}
            x={x}
            y={height - 6}
            textAnchor="middle"
            className="fill-muted-foreground"
            fontSize={10}
          >
            {formatDate(data[idx].date)}
          </text>
        );
      })}

      {/* Data polyline */}
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
      />

      {/* Data points */}
      {data.map((d, i) => {
        const x = padLeft + i * stepX;
        const y = padTop + innerH - (d.count / maxCount) * innerH;
        return (
          <circle key={i} cx={x} cy={y} r={2} fill="currentColor">
            <title>{`${d.date}: ${d.count}`}</title>
          </circle>
        );
      })}
    </svg>
  );
}
