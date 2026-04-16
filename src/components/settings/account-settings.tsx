'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Download, Trash2, AlertTriangle, Check } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

const CONFIRMATION_PHRASE = 'DELETE MY ACCOUNT';

interface Props {
  userEmail: string;
}

interface DeletionStatus {
  pending: boolean;
  requestedAt?: string;
  scheduledFor?: string;
  reason?: string | null;
}

interface ExportHistoryItem {
  id: string;
  requestedAt: string;
  completedAt: string | null;
  status: string;
  sizeBytes: number | null;
  errorMessage: string | null;
}

export function AccountSettings({ userEmail }: Props) {
  const { toast } = useToast();

  // Export state
  const [exporting, setExporting] = useState(false);
  const [exportHistory, setExportHistory] = useState<ExportHistoryItem[]>([]);

  // Deletion state
  const [deletionStatus, setDeletionStatus] = useState<DeletionStatus | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  const loadExportHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/user/data-export');
      if (res.ok) {
        const data = await res.json();
        setExportHistory(data.exports);
      }
    } catch {}
  }, []);

  const loadDeletionStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/user/account/deletion-status');
      if (res.ok) {
        const data = await res.json();
        setDeletionStatus(data);
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadExportHistory();
    loadDeletionStatus();
  }, [loadExportHistory, loadDeletionStatus]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/user/data-export', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({
          title: 'Export failed',
          description: data.error || 'An error occurred',
          variant: 'destructive',
        });
        return;
      }

      // Trigger file download
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tpaengx-data-export-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: 'Export complete',
        description: 'Your data has been downloaded',
      });
      await loadExportHistory();
    } catch {
      toast({ title: 'Error', description: 'Export failed', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const handleRequestDeletion = async () => {
    if (deleteConfirmation !== CONFIRMATION_PHRASE) {
      toast({
        title: 'Confirmation required',
        description: `Type "${CONFIRMATION_PHRASE}" exactly to confirm`,
        variant: 'destructive',
      });
      return;
    }
    setDeleteSubmitting(true);
    try {
      const res = await fetch('/api/user/account/request-deletion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: deletePassword,
          confirmationPhrase: deleteConfirmation,
          reason: deleteReason || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: 'Could not delete',
          description: data.error || 'An error occurred',
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: 'Deletion scheduled',
        description: data.message,
      });
      setDeleteOpen(false);
      setDeletePassword('');
      setDeleteConfirmation('');
      setDeleteReason('');
      await loadDeletionStatus();
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handleCancelDeletion = async () => {
    setCancelSubmitting(true);
    try {
      const res = await fetch('/api/user/account/cancel-deletion', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Cancelled', description: data.message });
      await loadDeletionStatus();
    } finally {
      setCancelSubmitting(false);
    }
  };

  return (
    <>
      {deletionStatus?.pending && (
        <Card className="p-6 border-red-300 bg-red-50 dark:bg-red-950/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-900 dark:text-red-200">
                Account deletion scheduled
              </h3>
              <p className="text-sm text-red-800 dark:text-red-300 mt-1">
                Your account will be permanently deleted on{' '}
                <strong>{deletionStatus.scheduledFor && format(new Date(deletionStatus.scheduledFor), 'PPP')}</strong>.
                You can cancel this until that date.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={handleCancelDeletion}
                disabled={cancelSubmitting}
              >
                {cancelSubmitting ? 'Cancelling...' : 'Cancel deletion'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-6">
        <div className="flex items-start gap-3 mb-3">
          <Download className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div>
            <h3 className="text-lg font-semibold">Export your data</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Download a ZIP archive containing your profile, login history, notifications, and other personal data associated with{' '}
              <strong>{userEmail}</strong>. One export per hour.
            </p>
          </div>
        </div>
        <Button onClick={handleExport} disabled={exporting}>
          {exporting ? 'Generating...' : 'Download data export'}
        </Button>

        {exportHistory.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-muted-foreground mb-2">Recent exports:</p>
            <div className="space-y-1">
              {exportHistory.slice(0, 5).map((e) => (
                <div key={e.id} className="flex items-center justify-between text-xs">
                  <span>
                    {formatDistanceToNow(new Date(e.requestedAt), { addSuffix: true })}
                    {e.sizeBytes && ` · ${(e.sizeBytes / 1024).toFixed(0)} KB`}
                  </span>
                  <Badge
                    variant={e.status === 'completed' ? 'default' : 'secondary'}
                    className={e.status === 'failed' ? 'bg-red-600' : ''}
                  >
                    {e.status === 'completed' && <Check className="h-3 w-3 mr-1" />}
                    {e.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card className="p-6 border-red-200">
        <div className="flex items-start gap-3 mb-3">
          <Trash2 className="h-5 w-5 text-red-600 mt-0.5" />
          <div>
            <h3 className="text-lg font-semibold text-red-900 dark:text-red-200">
              Delete account
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Permanently delete your account and associated personal data. You have a 30-day grace
              period to cancel. Tenant data (orders you created, client records) is retained and
              belongs to your organization.
            </p>
          </div>
        </div>
        <Button
          variant="destructive"
          onClick={() => setDeleteOpen(true)}
          disabled={deletionStatus?.pending}
        >
          Delete my account
        </Button>
      </Card>

      <Dialog open={deleteOpen} onOpenChange={(open) => !deleteSubmitting && setDeleteOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account</DialogTitle>
            <DialogDescription>
              This is a serious action. Your account will be disabled immediately and permanently
              deleted after a 30-day grace period.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="del-password">Password</Label>
              <Input
                id="del-password"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                disabled={deleteSubmitting}
              />
            </div>
            <div>
              <Label htmlFor="del-confirm">
                Type <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">{CONFIRMATION_PHRASE}</code> to confirm
              </Label>
              <Input
                id="del-confirm"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder={CONFIRMATION_PHRASE}
                disabled={deleteSubmitting}
              />
            </div>
            <div>
              <Label htmlFor="del-reason">Reason (optional)</Label>
              <Textarea
                id="del-reason"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Help us improve — why are you leaving?"
                rows={3}
                disabled={deleteSubmitting}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleteSubmitting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRequestDeletion}
              disabled={
                deleteSubmitting ||
                !deletePassword ||
                deleteConfirmation !== CONFIRMATION_PHRASE
              }
            >
              {deleteSubmitting ? 'Scheduling...' : 'Schedule deletion'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
