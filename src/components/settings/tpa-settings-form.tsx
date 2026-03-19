'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface TpaSettings {
  name: string;
  slug: string;
  contactEmail: string | null;
  contactPhone: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  defaultEmailFooter: string | null;
  website: string | null;
}

interface TpaSettingsFormProps {
  orgId: string;
}

export function TpaSettingsForm({ orgId }: TpaSettingsFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    contactEmail: '',
    contactPhone: '',
    logoUrl: '',
    primaryColor: '#3b82f6',
    defaultEmailFooter: '',
    website: '',
  });

  useEffect(() => {
    async function fetchSettings() {
      try {
        const response = await fetch(`/api/organizations/${orgId}/settings`);
        if (response.ok) {
          const data = await response.json();
          const settings: TpaSettings = data.settings;
          setFormData({
            name: settings.name || '',
            contactEmail: settings.contactEmail || '',
            contactPhone: settings.contactPhone || '',
            logoUrl: settings.logoUrl || '',
            primaryColor: settings.primaryColor || '#3b82f6',
            defaultEmailFooter: settings.defaultEmailFooter || '',
            website: settings.website || '',
          });
        }
      } catch (error) {
        console.error('Failed to fetch settings:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchSettings();
  }, [orgId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch(`/api/organizations/${orgId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          contactEmail: formData.contactEmail || null,
          contactPhone: formData.contactPhone || null,
          logoUrl: formData.logoUrl || null,
          primaryColor: formData.primaryColor || null,
          defaultEmailFooter: formData.defaultEmailFooter || null,
          website: formData.website || null,
        }),
      });

      if (response.ok) {
        toast({
          title: 'Settings Saved',
          description: 'Your TPA settings have been updated',
        });
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to save settings',
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
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card className="p-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-4">Organization Details</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label htmlFor="name">
                Organization Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="contactEmail">Contact Email</Label>
              <Input
                id="contactEmail"
                type="email"
                value={formData.contactEmail}
                onChange={(e) =>
                  setFormData({ ...formData, contactEmail: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="contactPhone">Contact Phone</Label>
              <Input
                id="contactPhone"
                type="tel"
                value={formData.contactPhone}
                onChange={(e) =>
                  setFormData({ ...formData, contactPhone: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                placeholder="https://example.com"
                value={formData.website}
                onChange={(e) =>
                  setFormData({ ...formData, website: e.target.value })
                }
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4">Branding</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="logoUrl">Logo URL</Label>
              <Input
                id="logoUrl"
                type="url"
                placeholder="https://example.com/logo.png"
                value={formData.logoUrl}
                onChange={(e) =>
                  setFormData({ ...formData, logoUrl: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="primaryColor">Primary Color</Label>
              <div className="flex gap-2">
                <Input
                  id="primaryColor"
                  type="color"
                  className="w-14 h-9 p-1 cursor-pointer"
                  value={formData.primaryColor}
                  onChange={(e) =>
                    setFormData({ ...formData, primaryColor: e.target.value })
                  }
                />
                <Input
                  value={formData.primaryColor}
                  onChange={(e) =>
                    setFormData({ ...formData, primaryColor: e.target.value })
                  }
                  placeholder="#3b82f6"
                  className="flex-1"
                />
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4">Defaults</h3>
          <div>
            <Label htmlFor="defaultEmailFooter">Default Email Footer</Label>
            <Textarea
              id="defaultEmailFooter"
              rows={4}
              value={formData.defaultEmailFooter}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  defaultEmailFooter: e.target.value,
                })
              }
              placeholder="Text that appears at the bottom of all outgoing emails..."
            />
          </div>
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </Card>
    </form>
  );
}
