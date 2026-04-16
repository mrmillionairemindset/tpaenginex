'use client';

import { useEffect, useState, useCallback } from 'react';
import { DataTable } from '@/components/ui/data-table';
import { usePolling } from '@/hooks/use-polling';
import { format } from 'date-fns';

interface ComplianceScore {
  id: string;
  score: number;
  calculatedAt: string;
  person?: { id: string; firstName: string; lastName: string } | null;
}

function ScoreBadge({ score }: { score: number }) {
  let colorClass = 'text-red-600 dark:text-red-400';
  if (score >= 80) colorClass = 'text-green-600 dark:text-green-400';
  else if (score >= 60) colorClass = 'text-amber-600 dark:text-amber-400';

  return <span className={`font-semibold ${colorClass}`}>{score}%</span>;
}

export function ClientComplianceDashboard() {
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
      header: 'Driver Name',
      accessor: (score: ComplianceScore) =>
        score.person
          ? `${score.person.firstName} ${score.person.lastName}`
          : '-',
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
  ];

  return (
    <DataTable
      data={scores}
      columns={columns}
      loading={loading}
      emptyMessage="No compliance scores available yet. Scores are generated when driver qualifications are updated."
    />
  );
}
