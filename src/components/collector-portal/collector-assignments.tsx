'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePolling } from '@/hooks/use-polling';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ClipboardList,
  MapPin,
  Clock,
  User,
  Building2,
  AlertTriangle,
  Shield,
} from 'lucide-react';
import { format } from 'date-fns';

interface Assignment {
  id: string;
  orderNumber: string;
  testType: string;
  serviceType: string;
  isDOT: boolean;
  priority: string;
  status: string;
  jobsiteLocation: string;
  scheduledFor: string | null;
  notes: string | null;
  person: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
  } | null;
  clientOrg: {
    id: string;
    name: string;
  } | null;
  event: {
    id: string;
    eventNumber: string;
    serviceType: string;
    scheduledDate: string;
    totalOrdered: number;
  } | null;
}

function statusColor(status: string) {
  switch (status) {
    case 'new':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    case 'scheduled':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
    case 'in_progress':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    case 'results_uploaded':
    case 'pending_review':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
    case 'complete':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
  }
}

function formatStatus(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function CollectorAssignments() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
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
      setAssignments(data.assignments);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch assignments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  usePolling(fetchAssignments, 30000);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="space-y-2">
              <div className="h-4 w-1/2 rounded bg-muted" />
              <div className="h-3 w-1/3 rounded bg-muted" />
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="h-3 w-full rounded bg-muted" />
              <div className="h-3 w-2/3 rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
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
          <ClipboardList className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold text-foreground">
            No assignments yet
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            When you are assigned to orders, they will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {assignments.map((assignment) => (
        <Link
          key={assignment.id}
          href={`/collector-portal/${assignment.id}`}
          className="block transition-transform hover:scale-[1.01]"
        >
          <Card className="h-full cursor-pointer hover:border-primary/50 hover:shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-base font-semibold">
                  {assignment.orderNumber}
                </CardTitle>
                <Badge className={statusColor(assignment.status)}>
                  {formatStatus(assignment.status)}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {assignment.isDOT && (
                  <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400">
                    <Shield className="mr-1 h-3 w-3" />
                    DOT
                  </Badge>
                )}
                {assignment.priority === 'urgent' && (
                  <Badge variant="destructive">
                    <AlertTriangle className="mr-1 h-3 w-3" />
                    Urgent
                  </Badge>
                )}
                <Badge variant="secondary">
                  {formatStatus(assignment.serviceType)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {assignment.person && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-4 w-4 shrink-0" />
                  <span>
                    {assignment.person.firstName}{' '}
                    {assignment.person.lastName}
                  </span>
                </div>
              )}
              {assignment.clientOrg && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="h-4 w-4 shrink-0" />
                  <span>{assignment.clientOrg.name}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" />
                <span className="truncate">{assignment.jobsiteLocation}</span>
              </div>
              {assignment.scheduledFor && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4 shrink-0" />
                  <span>
                    {format(
                      new Date(assignment.scheduledFor),
                      'MMM d, yyyy h:mm a'
                    )}
                  </span>
                </div>
              )}
              {assignment.event && (
                <div className="mt-2 rounded-md bg-muted/50 px-3 py-2 text-xs">
                  Event: {assignment.event.eventNumber} ({assignment.event.serviceType})
                </div>
              )}
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
