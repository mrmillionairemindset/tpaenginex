'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePolling } from '@/hooks/use-polling';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Plus, Trash2 } from 'lucide-react';

interface ChecklistItem {
  id: string;
  label: string;
  isRequired: boolean;
  sortOrder: number;
}

interface Checklist {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  clientOrg?: { id: string; name: string } | null;
  items?: ChecklistItem[];
}

interface FormItem {
  label: string;
  isRequired: boolean;
}

export function ChecklistsTable() {
  const { toast } = useToast();
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    clientOrgId: '',
  });
  const [formItems, setFormItems] = useState<FormItem[]>([
    { label: '', isRequired: true },
  ]);

  const fetchChecklists = useCallback(async () => {
    try {
      const response = await fetch('/api/dqf/checklists');
      if (response.ok) {
        const data = await response.json();
        setChecklists(data.checklists || []);
      }
    } catch (error) {
      console.error('Failed to fetch checklists:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChecklists();
  }, [fetchChecklists]);

  usePolling(fetchChecklists);

  const resetForm = () => {
    setFormData({ name: '', description: '', clientOrgId: '' });
    setFormItems([{ label: '', isRequired: true }]);
  };

  const addItem = () => {
    setFormItems([...formItems, { label: '', isRequired: true }]);
  };

  const removeItem = (index: number) => {
    if (formItems.length <= 1) return;
    setFormItems(formItems.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof FormItem, value: string | boolean) => {
    const updated = [...formItems];
    updated[index] = { ...updated[index], [field]: value };
    setFormItems(updated);
  };

  const handleAddChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const validItems = formItems.filter((item) => item.label.trim() !== '');
    if (validItems.length === 0) {
      toast({
        title: 'Error',
        description: 'At least one checklist item with a label is required',
        variant: 'destructive',
      });
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch('/api/dqf/checklists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || undefined,
          clientOrgId: formData.clientOrgId || undefined,
          items: validItems.map((item, index) => ({
            label: item.label,
            isRequired: item.isRequired,
            sortOrder: index,
          })),
        }),
      });

      if (response.ok) {
        toast({
          title: 'Checklist Created',
          description: `"${formData.name}" has been created successfully`,
        });
        setShowAddDialog(false);
        resetForm();
        fetchChecklists();
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to create checklist',
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
      header: 'Name',
      accessor: 'name' as const,
    },
    {
      header: 'Client',
      accessor: (checklist: Checklist) => checklist.clientOrg?.name || 'All Clients',
    },
    {
      header: 'Items',
      accessor: (checklist: Checklist) =>
        checklist.items ? String(checklist.items.length) : '0',
    },
    {
      header: 'Active',
      accessor: (checklist: Checklist) => (
        <Badge
          className={`${
            checklist.isActive
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-800'
          } font-medium`}
          variant="secondary"
        >
          {checklist.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Checklist
        </Button>
      </div>

      <DataTable
        data={checklists}
        columns={columns}
        loading={loading}
        emptyMessage="No checklists found. Create your first checklist to get started."
      />

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Qualification Checklist</DialogTitle>
            <DialogDescription>
              Define the required qualifications for drivers.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddChecklist}>
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="name">
                  Checklist Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  required
                  placeholder="e.g., DOT Driver Qualification"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  rows={2}
                  placeholder="Optional description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="clientOrgId">Client Org ID</Label>
                <Input
                  id="clientOrgId"
                  placeholder="Optional — leave blank for all clients"
                  value={formData.clientOrgId}
                  onChange={(e) =>
                    setFormData({ ...formData, clientOrgId: e.target.value })
                  }
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <Label>Checklist Items</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addItem}>
                    <Plus className="mr-1 h-3 w-3" />
                    Add Item
                  </Button>
                </div>
                <div className="space-y-3">
                  {formItems.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 rounded-md border p-3"
                    >
                      <div className="flex-1">
                        <Input
                          placeholder={`Item ${index + 1} label`}
                          value={item.label}
                          onChange={(e) =>
                            updateItem(index, 'label', e.target.value)
                          }
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Label
                          htmlFor={`required-${index}`}
                          className="text-xs whitespace-nowrap"
                        >
                          Required
                        </Label>
                        <Switch
                          id={`required-${index}`}
                          checked={item.isRequired}
                          onCheckedChange={(checked) =>
                            updateItem(index, 'isRequired', checked)
                          }
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(index)}
                        disabled={formItems.length <= 1}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
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
                {submitting ? 'Creating...' : 'Create Checklist'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
