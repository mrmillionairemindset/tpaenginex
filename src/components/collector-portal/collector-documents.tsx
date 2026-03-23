'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';

interface AssignmentWithDocs {
  id: string;
  orderNumber: string;
  serviceType: string;
  status: string;
  documents: {
    id: string;
    kind: string;
    fileName: string;
    createdAt: string;
  }[];
}

function formatStatus(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function CollectorDocuments() {
  const [assignments, setAssignments] = useState<AssignmentWithDocs[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssignments = useCallback(async () => {
    try {
      const res = await fetch('/api/collector-portal/assignments');
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch assignments');
      }
      const data = await res.json();
      // Filter to only assignments that have documents
      setAssignments(
        data.assignments.filter(
          (a: AssignmentWithDocs) => a.documents && a.documents.length > 0
        )
      );
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to fetch documents'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-destructive">
          <p>{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (assignments.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold text-foreground">
            No documents yet
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Documents uploaded for your assignments will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalDocs = assignments.reduce(
    (sum, a) => sum + a.documents.length,
    0
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {totalDocs} document{totalDocs !== 1 ? 's' : ''} across{' '}
        {assignments.length} assignment{assignments.length !== 1 ? 's' : ''}
      </p>

      {assignments.map((assignment) => (
        <Card key={assignment.id}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Link
                href={`/collector-portal/${assignment.id}`}
                className="hover:underline"
              >
                <CardTitle className="text-base">
                  {assignment.orderNumber}
                </CardTitle>
              </Link>
              <Badge variant="secondary">
                {formatStatus(assignment.serviceType)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {assignment.documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between rounded-md border px-4 py-2"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{doc.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatStatus(doc.kind)}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(doc.createdAt), 'MMM d, yyyy')}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
