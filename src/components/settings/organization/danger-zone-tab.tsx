'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface DangerZoneTabProps {
  orgId: string;
  orgName: string;
}

export function DangerZoneTab({ orgId, orgName }: DangerZoneTabProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/organizations/${orgId}`, { method: 'DELETE' });
      if (res.ok) {
        toast({ title: 'Organization Deleted', description: `${orgName} has been permanently deleted` });
        router.push('/dashboard');
        router.refresh();
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'Failed to delete organization', variant: 'destructive' });
        setShowConfirm(false);
      }
    } catch {
      toast({ title: 'Error', description: 'An unexpected error occurred', variant: 'destructive' });
      setShowConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Card className="p-6 border-red-200 dark:border-red-900/50">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-red-600 dark:text-red-400">Delete Organization</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Permanently delete <strong>{orgName}</strong> and all associated data. This action cannot be undone. Organizations with existing orders or candidates cannot be deleted.
            </p>
            <Button variant="destructive" size="sm" className="mt-4" onClick={() => setShowConfirm(true)}>
              Delete Organization
            </Button>
          </div>
        </div>
      </Card>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" /> Delete Organization
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{orgName}</strong>, remove all members, and cannot be reversed. Are you absolutely sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">
              {deleting ? 'Deleting...' : 'Yes, Delete Organization'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
