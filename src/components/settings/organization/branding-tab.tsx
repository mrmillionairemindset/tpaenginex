'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export function BrandingTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    brandName: '',
    logoUrl: '',
    primaryColor: '#3b82f6',
    defaultEmailFooter: '',
  });

  useEffect(() => {
    async function fetch_() {
      try {
        const res = await fetch('/api/tpa-settings');
        if (res.ok) {
          const data = await res.json();
          setFormData({
            brandName: data.settings.brandName || '',
            logoUrl: data.settings.logoUrl || '',
            primaryColor: data.settings.primaryColor || '#3b82f6',
            defaultEmailFooter: data.settings.defaultEmailFooter || '',
          });
        }
      } catch (err) {
        console.error('Failed to fetch branding:', err);
      } finally {
        setLoading(false);
      }
    }
    fetch_();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/tpa-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandName: formData.brandName || null,
          logoUrl: formData.logoUrl || null,
          primaryColor: formData.primaryColor || null,
          defaultEmailFooter: formData.defaultEmailFooter || null,
        }),
      });
      if (res.ok) {
        toast({ title: 'Saved', description: 'Branding settings updated' });
      } else {
        toast({ title: 'Error', description: 'Failed to save branding', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'An unexpected error occurred', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>;

  return (
    <form onSubmit={handleSubmit}>
      <Card className="p-6 space-y-5">
        <div>
          <Label htmlFor="brandName">Brand Name</Label>
          <Input id="brandName" placeholder="Your company name as it appears in emails" value={formData.brandName} onChange={(e) => setFormData({ ...formData, brandName: e.target.value })} />
          <p className="text-xs text-muted-foreground mt-1">Used as the sender name on all outgoing emails</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="logoUrl">Logo URL</Label>
            <Input id="logoUrl" type="url" placeholder="https://example.com/logo.png" value={formData.logoUrl} onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="primaryColor">Primary Color</Label>
            <div className="flex gap-2">
              <Input id="primaryColor" type="color" className="w-14 h-9 p-1 cursor-pointer" value={formData.primaryColor} onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })} />
              <Input value={formData.primaryColor} onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })} placeholder="#3b82f6" className="flex-1" />
            </div>
          </div>
        </div>
        <div>
          <Label htmlFor="emailFooter">Email Footer</Label>
          <Textarea id="emailFooter" rows={3} placeholder="Text that appears at the bottom of all outgoing emails..." value={formData.defaultEmailFooter} onChange={(e) => setFormData({ ...formData, defaultEmailFooter: e.target.value })} />
        </div>
        <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Branding'}</Button>
      </Card>
    </form>
  );
}
