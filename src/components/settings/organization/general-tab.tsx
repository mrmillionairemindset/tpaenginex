'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface GeneralTabProps {
  orgId: string;
}

export function GeneralTab({ orgId }: GeneralTabProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    type: '',
    contactEmail: '',
    contactPhone: '',
    website: '',
  });

  useEffect(() => {
    async function fetch_() {
      try {
        const res = await fetch(`/api/organizations/${orgId}/settings`);
        if (res.ok) {
          const data = await res.json();
          setFormData({
            name: data.settings.name || '',
            slug: data.settings.slug || '',
            type: data.settings.type || '',
            contactEmail: data.settings.contactEmail || '',
            contactPhone: data.settings.contactPhone || '',
            website: data.settings.website || '',
          });
        }
      } catch (err) {
        console.error('Failed to fetch org settings:', err);
      } finally {
        setLoading(false);
      }
    }
    fetch_();
  }, [orgId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/organizations/${orgId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          contactEmail: formData.contactEmail || null,
          contactPhone: formData.contactPhone || null,
          website: formData.website || null,
        }),
      });
      if (res.ok) {
        toast({ title: 'Saved', description: 'General settings updated' });
      } else {
        const err = await res.json();
        toast({ title: 'Error', description: err.error || 'Failed to save', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'An unexpected error occurred', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>;

  const typeLabel: Record<string, string> = { platform: 'Platform', tpa: 'TPA', client: 'Client' };

  return (
    <form onSubmit={handleSubmit}>
      <Card className="p-6 space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="name">Organization Name <span className="text-red-500">*</span></Label>
            <Input id="name" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
          </div>
          <div>
            <Label>Type</Label>
            <div className="mt-1.5">
              <Badge variant="secondary">{typeLabel[formData.type] || formData.type}</Badge>
            </div>
          </div>
          <div>
            <Label>Slug</Label>
            <Input value={formData.slug} disabled className="bg-muted" />
          </div>
          <div>
            <Label htmlFor="contactEmail">Contact Email</Label>
            <Input id="contactEmail" type="email" value={formData.contactEmail} onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="contactPhone">Contact Phone</Label>
            <Input id="contactPhone" type="tel" value={formData.contactPhone} onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="website">Website</Label>
            <Input id="website" type="url" placeholder="https://example.com" value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} />
          </div>
        </div>
        <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save General'}</Button>
      </Card>
    </form>
  );
}
