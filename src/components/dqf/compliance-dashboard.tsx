'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePolling } from '@/hooks/use-polling';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { format } from 'date-fns';

interface ComplianceScore {
  id: string;
  score: number;
  calculatedAt: string;
  breakdown: Record<string, number> | null;
  person?: { id: string; firstName: string; lastName: string } | null;
  clientOrg?: { id: string; name: string } | null;
}

function ScoreBadge({ score }: { score: number }) {
  let colorClass = 'text-red-600';
  if (score >= 80) colorClass = 'text-green-600';
  else if (score >= 60) colorClass = 'text-amber-600';

  return <span className={`font-semibold ${colorClass}`}>{score}%</span>;
}

function formatBreakdown(breakdown: Record<string, number> | null): string {
  if (!breakdown) return '-';
  const entries = Object.entries(breakdown);
  if (entries.length === 0) return '-';
  return entries.map(([key, value]) => `${key}: ${value}`).join(', ');
}

export function ComplianceDashboard() {
  const [scores, setScores] = useState<ComplianceScore[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchScores = useCallback(async () => {
    try {
      const response = await fetch('/api/dqf/compliance');
      if (response.ok) {
        const data = await response.json();
        setScores(data.scores || []);
      }
    } catch (error) {
      console.error('Failed to fetch compliance scores:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScores();
  }, [fetchScores]);

  usePolling(fetchScores);

  const columns = [
    {
      header: 'Driver',
      accessor: (score: ComplianceScore) =>
        score.person
          ? `${score.person.firstName} ${score.person.lastName}`
          : '-',
    },
    {
      header: 'Client',
      accessor: (score: ComplianceScore) => score.clientOrg?.name || '-',
    },
    {
      header: 'Score',
      accessor: (score: ComplianceScore) => <ScoreBadge score={score.score} />,
    },
    {
      header: 'Last Calculated',
      accessor: (score: ComplianceScore) =>
        score.calculatedAt
          ? format(new Date(score.calculatedAt), 'MMM d, yyyy h:mm a')
          : '-',
    },
    {
      header: 'Breakdown',
      accessor: (score: ComplianceScore) => (
        <span className="text-sm text-muted-foreground">
          {formatBreakdown(score.breakdown)}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            (window.location.href = '/api/dqf/compliance/export')
          }
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => (window.location.href = '/api/dqf/compliance/pdf')}
        >
          <Download className="h-4 w-4 mr-2" />
          Export PDF
        </Button>
      </div>
      <DataTable
        data={scores}
        columns={columns}
        loading={loading}
        emptyMessage="No compliance scores calculated yet. Scores are auto-generated when driver qualifications are updated."
      />
    </div>
  );
}
