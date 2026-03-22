'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Plus, Pencil, Trash2, X, MapPin } from 'lucide-react';
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

interface Location {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string | null;
  notes: string | null;
}

const emptyForm = { name: '', address: '', city: '', state: '', zip: '', phone: '', notes: '' };

interface LocationsTabProps {
  orgId: string;
}

export function LocationsTab({ orgId }: LocationsTabProps) {
  const { toast } = useToast();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [toDelete, setToDelete] = useState<Location | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const fetchLocations = useCallback(async () => {
    try {
      const res = await fetch(`/api/organizations/${orgId}/locations`);
      if (res.ok) {
        const data = await res.json();
        setLocations(data.locations || []);
      }
    } catch (err) {
      console.error('Failed to fetch locations:', err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { fetchLocations(); }, [fetchLocations]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (loc: Location) => {
    setEditing(loc);
    setForm({
      name: loc.name,
      address: loc.address,
      city: loc.city,
      state: loc.state,
      zip: loc.zip,
      phone: loc.phone || '',
      notes: loc.notes || '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = `/api/organizations/${orgId}/locations`;
      const method = editing ? 'PATCH' : 'POST';
      const body = editing ? { locationId: editing.id, ...form } : form;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast({ title: 'Saved', description: editing ? 'Location updated' : 'Location added' });
        setShowForm(false);
        setEditing(null);
        setForm(emptyForm);
        fetchLocations();
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'Failed to save location', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'An unexpected error occurred', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/organizations/${orgId}/locations`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId: toDelete.id }),
      });
      if (res.ok) {
        toast({ title: 'Deleted', description: `${toDelete.name} has been removed` });
        setToDelete(null);
        fetchLocations();
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'Failed to delete', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'An unexpected error occurred', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>;

  return (
    <>
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="font-semibold">Locations</h4>
            <p className="text-sm text-muted-foreground">{locations.length} location{locations.length !== 1 ? 's' : ''}</p>
          </div>
          <Button size="sm" onClick={showForm ? () => { setShowForm(false); setEditing(null); } : openAdd}>
            {showForm ? <><X className="h-4 w-4 mr-1" /> Cancel</> : <><Plus className="h-4 w-4 mr-1" /> Add Location</>}
          </Button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="mb-6 p-4 rounded-lg border bg-muted/30 space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label htmlFor="locName">Location Name *</Label>
                <Input id="locName" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="locAddr">Address *</Label>
                <Input id="locAddr" required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="locCity">City *</Label>
                <Input id="locCity" required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="locState">State *</Label>
                  <Input id="locState" required maxLength={2} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })} />
                </div>
                <div>
                  <Label htmlFor="locZip">ZIP *</Label>
                  <Input id="locZip" required value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} />
                </div>
              </div>
              <div>
                <Label htmlFor="locPhone">Phone</Label>
                <Input id="locPhone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="locNotes">Notes</Label>
                <Input id="locNotes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? 'Saving...' : editing ? 'Update Location' : 'Add Location'}
            </Button>
          </form>
        )}

        {locations.length === 0 && !showForm ? (
          <div className="py-8 text-center">
            <MapPin className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No locations added yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {locations.map((loc) => (
              <div key={loc.id} className="flex items-center gap-3 p-3 rounded-md border">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{loc.name}</span>
                  <p className="text-xs text-muted-foreground truncate">
                    {loc.address}, {loc.city}, {loc.state} {loc.zip}
                    {loc.phone ? ` \u00b7 ${loc.phone}` : ''}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(loc)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-500" onClick={() => setToDelete(loc)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <AlertDialog open={!!toDelete} onOpenChange={() => setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Location</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{toDelete?.name}</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
