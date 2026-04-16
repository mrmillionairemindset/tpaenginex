'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePolling } from '@/hooks/use-polling';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Plus, Copy } from 'lucide-react';

interface TicketForm {
  id: string;
  formName: string;
  isActive: boolean;
  publicUrl: string | null;
  submissionCount: number;
  clientOrg?: { id: string; name: string } | null;
}

export function TicketFormsTable() {
  const { toast } = useToast();
  const [forms, setForms] = useState<TicketForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    formName: '',
    clientOrgId: '',
  });

  const fetchForms = useCallback(async () => {
    try {
      const response = await fetch('/api/dqf/tickets');
      if (response.ok) {
        const data = await response.json();
        setForms(data.forms || []);
      }
    } catch (error) {
      console.error('Failed to fetch ticket forms:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchForms();
  }, [fetchForms]);

  usePolling(fetchForms);

  const resetForm = () => {
    setFormData({ formName: '', clientOrgId: '' });
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      toast({
        title: 'Copied',
        description: 'Public URL copied to clipboard',
      });
    });
  };

  const handleAddForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch('/api/dqf/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formName: formData.formName,
          clientOrgId: formData.clientOrgId || undefined,
        }),
      });

      if (response.ok) {
        toast({
          title: 'Form Created',
          description: `"${formData.formName}" has been created successfully`,
        });
        setShowAddDialog(false);
        resetForm();
        fetchForms();
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to create form',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      header: 'Form Name',
      accessor: 'formName' as const,
    },
    {
      header: 'Client',
      accessor: (form: TicketForm) => form.clientOrg?.name || 'General',
    },
    {
      header: 'Active',
      accessor: (form: TicketForm) => (
        <Badge
          className={`${
            form.isActive
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-800'
          } font-medium`}
          variant="secondary"
        >
          {form.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      header: 'Submissions',
      accessor: (form: TicketForm) => String(form.submissionCount),
    },
    {
      header: 'Public URL',
      accessor: (form: TicketForm) => {
        if (!form.publicUrl) return '-';
        const truncated =
          form.publicUrl.length > 40
            ? form.publicUrl.substring(0, 40) + '...'
            : form.publicUrl;
        return (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{truncated}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={(e) => {
                e.stopPropagation();
                copyUrl(form.publicUrl!);
              }}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Form
        </Button>
      </div>

      <DataTable
        data={forms}
        columns={columns}
        loading={loading}
        emptyMessage="No ticket forms found. Create your first form to start accepting driver applications."
      />

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Public Ticket Form</DialogTitle>
            <DialogDescription>
              Create an embeddable form for driver application intake.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddForm}>
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="formName">
                  Form Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="formName"
                  required
                  placeholder="e.g., Driver Application - Acme Trucking"
                  value={formData.formName}
                  onChange={(e) =>
                    setFormData({ ...formData, formName: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="clientOrgId">Client Org ID</Label>
                <Input
                  id="clientOrgId"
                  placeholder="Optional — associate with a specific client"
                  value={formData.clientOrgId}
                  onChange={(e) =>
                    setFormData({ ...formData, clientOrgId: e.target.value })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddDialog(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Creating...' : 'Create Form'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
