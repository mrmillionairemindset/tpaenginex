'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Bookmark, ChevronDown, X } from 'lucide-react';

interface SavedFilter {
  id: string;
  name: string;
  filters: Record<string, any>;
  isShared: boolean;
  isOwner: boolean;
  userId: string;
}

interface SavedFiltersDropdownProps {
  pageKey: string;
  currentFilters: Record<string, any>;
  onApply: (filters: Record<string, any>) => void;
}

export function SavedFiltersDropdown({
  pageKey,
  currentFilters,
  onApply,
}: SavedFiltersDropdownProps) {
  const { toast } = useToast();
  const [filters, setFilters] = useState<SavedFilter[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIsShared, setNewIsShared] = useState(false);

  const fetchFilters = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/saved-filters?pageKey=${encodeURIComponent(pageKey)}`
      );
      if (res.ok) {
        const data = await res.json();
        setFilters(data.filters || []);
      }
    } catch (err) {
      console.error('Failed to fetch saved filters:', err);
    }
  }, [pageKey]);

  useEffect(() => {
    fetchFilters();
  }, [fetchFilters]);

  const handleApply = (filter: SavedFilter) => {
    onApply(filter.filters || {});
    toast({
      title: 'Filter applied',
      description: `Applied view "${filter.name}".`,
    });
  };

  const handleDelete = async (e: React.MouseEvent, filter: SavedFilter) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete saved view "${filter.name}"?`)) return;
    try {
      const res = await fetch(`/api/saved-filters/${filter.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete');
      }
      toast({ title: 'View deleted' });
      await fetchFilters();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to delete',
        variant: 'destructive',
      });
    }
  };

  const handleSave = async () => {
    if (!newName.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter a name for this view.',
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/saved-filters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageKey,
          name: newName.trim(),
          filters: currentFilters,
          isShared: newIsShared,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save');
      }
      toast({ title: 'View saved', description: `Saved "${newName}".` });
      setDialogOpen(false);
      setNewName('');
      setNewIsShared(false);
      await fetchFilters();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to save',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Bookmark className="h-4 w-4 mr-2" />
            Saved Views ({filters.length})
            <ChevronDown className="h-4 w-4 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {filters.length === 0 ? (
            <div className="px-2 py-3 text-sm text-muted-foreground text-center">
              No saved views yet.
            </div>
          ) : (
            filters.map((filter) => (
              <DropdownMenuItem
                key={filter.id}
                onSelect={() => handleApply(filter)}
                className="group flex items-center justify-between gap-2"
              >
                <span className="flex-1 truncate">
                  {filter.name}
                  {filter.isShared && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (shared)
                    </span>
                  )}
                </span>
                {filter.isOwner && (
                  <button
                    type="button"
                    onClick={(e) => handleDelete(e, filter)}
                    className="opacity-0 group-hover:opacity-100 hover:text-destructive"
                    aria-label={`Delete ${filter.name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setDialogOpen(true);
            }}
          >
            Save current filters...
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save filter view</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="filter-name">Name</Label>
              <Input
                id="filter-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. My Open Orders"
                maxLength={100}
                autoFocus
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="filter-shared"
                type="checkbox"
                checked={newIsShared}
                onChange={(e) => setNewIsShared(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="filter-shared" className="cursor-pointer">
                Share this view with other users in my organization
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
