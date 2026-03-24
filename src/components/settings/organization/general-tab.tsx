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
    async function fetchSettings() {
      try {
        const res = await fetch(`/api/organizations/${orgId}/settings`, { cache: 'no-store' });
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
    fetchSettings();
  }, [orgId]);

  const handleSave = async () => {
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

      const data = await res.json().catch(() => ({ error: 'Server error' }));

      if (res.ok) {
        // Update form with saved values from server
        if (data.settings) {
          setFormData({
            name: data.settings.name || '',
            slug: data.settings.slug || '',
            type: data.settings.type || '',
            contactEmail: data.settings.contactEmail || '',
            contactPhone: data.settings.contactPhone || '',
            website: data.settings.website || '',
          });
        }
        toast({ title: 'Saved', description: 'General settings updated' });
      } else {
        toast({
          title: 'Save Failed',
          description: data.error || `Error ${res.status}`,
          variant: 'destructive',
          duration: 8000,
        });
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Could not reach server', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>;

  const typeLabel: Record<string, string> = { platform: 'Platform', tpa: 'TPA', client: 'Client' };

  return (
    <Card className="p-6 space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <Label htmlFor="gen-name">Organization Name <span className="text-red-500">*</span></Label>
          <Input id="gen-name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
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
          <Label htmlFor="gen-email">Contact Email</Label>
          <Input id="gen-email" type="email" value={formData.contactEmail} onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="gen-phone">Contact Phone</Label>
          <Input id="gen-phone" type="tel" value={formData.contactPhone} onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })} />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="gen-website">Website</Label>
          <Input id="gen-website" placeholder="https://example.com" value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} />
        </div>
      </div>
      <Button onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save General'}
      </Button>
    </Card>
  );
}
