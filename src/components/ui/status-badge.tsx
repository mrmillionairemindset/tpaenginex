import { Badge } from './badge';
import { cn } from '@/lib/utils';

type OrderStatus = 'new' | 'needs_site' | 'scheduled' | 'in_progress' | 'results_uploaded' | 'pending_review' | 'needs_correction' | 'complete' | 'cancelled';

const statusStyles: Record<OrderStatus, { variant: string; label: string }> = {
  new: { variant: 'bg-blue-100 text-blue-800', label: 'New' },
  needs_site: { variant: 'bg-amber-100 text-amber-800', label: 'Needs Site' },
  scheduled: { variant: 'bg-purple-100 text-purple-800', label: 'Scheduled' },
  in_progress: { variant: 'bg-yellow-100 text-yellow-800', label: 'In Progress' },
  results_uploaded: { variant: 'bg-cyan-100 text-cyan-800', label: 'Results Uploaded' },
  pending_review: { variant: 'bg-indigo-100 text-indigo-800', label: 'Pending Review' },
  needs_correction: { variant: 'bg-orange-100 text-orange-800', label: 'Needs Correction' },
  complete: { variant: 'bg-green-100 text-green-800', label: 'Complete' },
  cancelled: { variant: 'bg-red-100 text-red-800', label: 'Cancelled' },
};

interface StatusBadgeProps {
  status: OrderStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = statusStyles[status];

  return (
    <Badge
      className={cn(style.variant, 'font-medium', className)}
      variant="secondary"
    >
      {style.label}
    </Badge>
  );
}
