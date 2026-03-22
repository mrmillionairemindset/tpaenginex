'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export function CommunicationsTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    replyToEmail: '',
    replyToOrders: '',
    replyToBilling: '',
    replyToLeads: '',
  });

  useEffect(() => {
    async function fetch_() {
      try {
        const res = await fetch('/api/tpa-settings');
        if (res.ok) {
          const data = await res.json();
          setFormData({
            replyToEmail: data.settings.replyToEmail || '',
            replyToOrders: data.settings.replyToOrders || '',
            replyToBilling: data.settings.replyToBilling || '',
            replyToLeads: data.settings.replyToLeads || '',
          });
        }
      } catch (err) {
        console.error('Failed to fetch email settings:', err);
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
          replyToEmail: formData.replyToEmail || null,
          replyToOrders: formData.replyToOrders || null,
          replyToBilling: formData.replyToBilling || null,
          replyToLeads: formData.replyToLeads || null,
        }),
      });
      if (res.ok) {
        toast({ title: 'Saved', description: 'Email routing updated' });
      } else {
        toast({ title: 'Error', description: 'Failed to save email settings', variant: 'destructive' });
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
          <p className="text-sm text-muted-foreground mb-4">
            When clients reply to emails, their replies go to these addresses. If a category-specific address is blank, the general address is used.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="replyToEmail">General (fallback for all emails)</Label>
            <Input id="replyToEmail" type="email" placeholder="info@yourcompany.com" value={formData.replyToEmail} onChange={(e) => setFormData({ ...formData, replyToEmail: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="replyToOrders">Orders & Collections</Label>
            <Input id="replyToOrders" type="email" placeholder="orders@yourcompany.com" value={formData.replyToOrders} onChange={(e) => setFormData({ ...formData, replyToOrders: e.target.value })} />
            <p className="text-xs text-muted-foreground mt-1">Collector assigned, order/event complete, kit reminders, pending results</p>
          </div>
          <div>
            <Label htmlFor="replyToBilling">Billing & Invoices</Label>
            <Input id="replyToBilling" type="email" placeholder="billing@yourcompany.com" value={formData.replyToBilling} onChange={(e) => setFormData({ ...formData, replyToBilling: e.target.value })} />
            <p className="text-xs text-muted-foreground mt-1">Invoice sent, overdue notices</p>
          </div>
          <div>
            <Label htmlFor="replyToLeads">Leads & Sales</Label>
            <Input id="replyToLeads" type="email" placeholder="sales@yourcompany.com" value={formData.replyToLeads} onChange={(e) => setFormData({ ...formData, replyToLeads: e.target.value })} />
            <p className="text-xs text-muted-foreground mt-1">Lead stage emails, follow-up outreach</p>
          </div>
        </div>
        <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Email Routing'}</Button>
      </Card>
    </form>
  );
}
