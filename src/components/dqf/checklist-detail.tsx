'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, Plus, Trash2, GripVertical, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ChecklistDetailProps {
  checklistId: string;
  userRole: string;
}

interface ChecklistItem {
  id?: string;
  label: string;
  isRequired: boolean;
  qualificationType?: string | null;
  sortOrder: number;
}

interface Checklist {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  clientOrg?: { id: string; name: string } | null;
  items: ChecklistItem[];
}

export function ChecklistDetail({ checklistId, userRole }: ChecklistDetailProps) {
  const { toast } = useToast();
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [savingDetails, setSavingDetails] = useState(false);

  // Items
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [savingItems, setSavingItems] = useState(false);

  // New item form
  const [newLabel, setNewLabel] = useState('');
  const [newRequired, setNewRequired] = useState(false);
  const [newQualType, setNewQualType] = useState('');

  useEffect(() => {
    async function fetchChecklist() {
      try {
        const response = await fetch(`/api/dqf/checklists/${checklistId}`);
        if (response.ok) {
          const data = await response.json();
          const c = data.checklist;
          setChecklist(c);
          setName(c.name);
          setDescription(c.description || '');
          setItems(
            (c.items || [])
              .sort((a: ChecklistItem, b: ChecklistItem) => a.sortOrder - b.sortOrder)
          );
        } else {
          setError('Checklist not found');
        }
      } catch {
        setError('Failed to load checklist');
      } finally {
        setLoading(false);
      }
    }

    fetchChecklist();
  }, [checklistId]);

  const patchChecklist = async (body: Record<string, unknown>) => {
    const response = await fetch(`/api/dqf/checklists/${checklistId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to update checklist');
    }
    const data = await response.json();
    return data.checklist;
  };

  const handleSaveDetails = async () => {
    setSavingDetails(true);
    try {
      const updated = await patchChecklist({ name, description });
      setChecklist(updated);
      toast({ title: 'Saved', description: 'Checklist details updated' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSavingDetails(false);
    }
  };

  const handleToggleActive = async (isActive: boolean) => {
    try {
      const updated = await patchChecklist({ isActive });
      setChecklist(updated);
      toast({
        title: isActive ? 'Activated' : 'Deactivated',
        description: `Checklist is now ${isActive ? 'active' : 'inactive'}`,
      });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleAddItem = async () => {
    if (!newLabel.trim()) return;

    const newItem: ChecklistItem = {
      label: newLabel.trim(),
      isRequired: newRequired,
      qualificationType: newQualType.trim() || null,
      sortOrder: items.length,
    };

    const updatedItems = [...items, newItem];
    setSavingItems(true);
    try {
      const updated = await patchChecklist({ items: updatedItems });
      setChecklist(updated);
      setItems(
        (updated.items || [])
          .sort((a: ChecklistItem, b: ChecklistItem) => a.sortOrder - b.sortOrder)
      );
      setNewLabel('');
      setNewRequired(false);
      setNewQualType('');
      toast({ title: 'Item Added', description: 'Checklist item added' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSavingItems(false);
    }
  };

  const handleRemoveItem = async (index: number) => {
    const updatedItems = items
      .filter((_, i) => i !== index)
      .map((item, i) => ({ ...item, sortOrder: i }));

    setSavingItems(true);
    try {
      const updated = await patchChecklist({ items: updatedItems });
      setChecklist(updated);
      setItems(
        (updated.items || [])
          .sort((a: ChecklistItem, b: ChecklistItem) => a.sortOrder - b.sortOrder)
      );
      toast({ title: 'Item Removed', description: 'Checklist item removed' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSavingItems(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !checklist) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Checklist Not Found"
        description={error || 'The checklist you are looking for does not exist'}
      />
    );
  }

  const canEdit = userRole === 'tpa_admin' || userRole === 'platform_admin';

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link
        href="/dqf/checklists"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Checklists
      </Link>

      {/* Header card */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{checklist.name}</h1>
            {checklist.clientOrg && (
              <p className="text-muted-foreground mt-1">{checklist.clientOrg.name}</p>
            )}
            {checklist.description && (
              <p className="text-sm text-muted-foreground mt-2">{checklist.description}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={checklist.isActive ? 'default' : 'secondary'}>
              {checklist.isActive ? 'Active' : 'Inactive'}
            </Badge>
            {canEdit && (
              <div className="flex items-center gap-2">
                <Label htmlFor="active-toggle" className="text-sm">Active</Label>
                <Switch
                  id="active-toggle"
                  checked={checklist.isActive}
                  onCheckedChange={handleToggleActive}
                />
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Edit name/description */}
      {canEdit && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Edit Details</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="checklist-name">Name</Label>
              <Input
                id="checklist-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Checklist name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="checklist-description">Description</Label>
              <Textarea
                id="checklist-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Checklist description..."
                rows={3}
              />
            </div>
            <Button
              variant="outline"
              onClick={handleSaveDetails}
              disabled={savingDetails || (name === checklist.name && description === (checklist.description || ''))}
            >
              {savingDetails ? 'Saving...' : 'Save Details'}
            </Button>
          </div>
        </Card>
      )}

      {/* Items list */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">
          Checklist Items ({items.length})
        </h2>

        {items.length > 0 ? (
          <div className="space-y-2 mb-6">
            {items.map((item, index) => (
              <div
                key={item.id || index}
                className="flex items-center gap-3 p-3 border rounded"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm font-medium text-muted-foreground w-6">
                  {item.sortOrder + 1}.
                </span>
                <span className="flex-1 text-sm font-medium">{item.label}</span>
                {item.qualificationType && (
                  <Badge variant="outline" className="text-xs">
                    {item.qualificationType}
                  </Badge>
                )}
                <Badge
                  className={
                    item.isRequired
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
                  }
                >
                  {item.isRequired ? 'Required' : 'Optional'}
                </Badge>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveItem(index)}
                    disabled={savingItems}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground mb-6">No items yet. Add one below.</p>
        )}

        {/* Add Item form */}
        {canEdit && (
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold mb-3">Add Item</h3>
            <div className="flex items-end gap-3 flex-wrap">
              <div className="flex-1 min-w-[200px] space-y-1">
                <Label htmlFor="new-item-label">Label</Label>
                <Input
                  id="new-item-label"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g. CDL Copy"
                />
              </div>
              <div className="min-w-[160px] space-y-1">
                <Label htmlFor="new-item-qual-type">Qualification Type</Label>
                <Input
                  id="new-item-qual-type"
                  value={newQualType}
                  onChange={(e) => setNewQualType(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="flex items-center gap-2 pb-1">
                <Switch
                  id="new-item-required"
                  checked={newRequired}
                  onCheckedChange={setNewRequired}
                />
                <Label htmlFor="new-item-required" className="text-sm">Required</Label>
              </div>
              <Button
                onClick={handleAddItem}
                disabled={savingItems || !newLabel.trim()}
              >
                <Plus className="mr-2 h-4 w-4" />
                {savingItems ? 'Adding...' : 'Add'}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
