'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
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

interface AutomationToggles {
  enableSheetsSync: boolean;
  enableKitReminders: boolean;
  enableCollectorConfirmReminders: boolean;
  enableResultsPendingDaily: boolean;
  enableOrderCompletionEmail: boolean;
  enableEventCompletionEmail: boolean;
  enableLeadStageEmails: boolean;
  enableLeadFollowUpReminders: boolean;
}

const AUTOMATION_DEFAULTS: AutomationToggles = {
  enableSheetsSync: false,
  enableKitReminders: true,
  enableCollectorConfirmReminders: true,
  enableResultsPendingDaily: true,
  enableOrderCompletionEmail: true,
  enableEventCompletionEmail: true,
  enableLeadStageEmails: false,
  enableLeadFollowUpReminders: true,
};

const AUTOMATION_CONFIG = [
  {
    section: 'Integrations',
    toggles: [
      { key: 'enableSheetsSync' as const, label: 'Google Sheets Sync', description: 'Automatically sync new orders to Google Sheets' },
    ],
  },
  {
    section: 'Reminders',
    toggles: [
      { key: 'enableKitReminders' as const, label: 'Kit Mailing Reminders', description: 'Send reminders to mail collection kits 48 hours before events' },
      { key: 'enableCollectorConfirmReminders' as const, label: 'Collector Confirmation Reminders', description: 'Send reminders to reconfirm collectors 48 hours before collections' },
      { key: 'enableResultsPendingDaily' as const, label: 'Daily Pending Results Digest', description: 'Send daily emails about events with pending results' },
    ],
  },
  {
    section: 'Client Notifications',
    toggles: [
      { key: 'enableOrderCompletionEmail' as const, label: 'Order Completion Emails', description: 'Email client contacts when an order is completed' },
      { key: 'enableEventCompletionEmail' as const, label: 'Event Completion Emails', description: 'Email client contacts with event summaries when an event is completed' },
    ],
  },
  {
    section: 'CRM Automation',
    toggles: [
      { key: 'enableLeadStageEmails' as const, label: 'Lead Stage Emails', description: 'Automatically send templated emails when a lead changes stage' },
      { key: 'enableLeadFollowUpReminders' as const, label: 'Lead Follow-Up Reminders', description: 'Send in-app reminders for scheduled lead follow-ups' },
    ],
  },
];

interface TpaSettingsFormProps {
  orgId: string;
}

export function TpaSettingsForm({ orgId }: TpaSettingsFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAutomation, setSavingAutomation] = useState(false);
  const [automationToggles, setAutomationToggles] = useState<AutomationToggles>(AUTOMATION_DEFAULTS);
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
        const [orgRes, automationRes] = await Promise.all([
          fetch(`/api/organizations/${orgId}/settings`),
          fetch('/api/tpa-settings'),
        ]);

        if (orgRes.ok) {
          const data = await orgRes.json();
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

        if (automationRes.ok) {
          const data = await automationRes.json();
          setAutomationToggles({
            enableSheetsSync: data.settings.enableSheetsSync ?? AUTOMATION_DEFAULTS.enableSheetsSync,
            enableKitReminders: data.settings.enableKitReminders ?? AUTOMATION_DEFAULTS.enableKitReminders,
            enableCollectorConfirmReminders: data.settings.enableCollectorConfirmReminders ?? AUTOMATION_DEFAULTS.enableCollectorConfirmReminders,
            enableResultsPendingDaily: data.settings.enableResultsPendingDaily ?? AUTOMATION_DEFAULTS.enableResultsPendingDaily,
            enableOrderCompletionEmail: data.settings.enableOrderCompletionEmail ?? AUTOMATION_DEFAULTS.enableOrderCompletionEmail,
            enableEventCompletionEmail: data.settings.enableEventCompletionEmail ?? AUTOMATION_DEFAULTS.enableEventCompletionEmail,
            enableLeadStageEmails: data.settings.enableLeadStageEmails ?? AUTOMATION_DEFAULTS.enableLeadStageEmails,
            enableLeadFollowUpReminders: data.settings.enableLeadFollowUpReminders ?? AUTOMATION_DEFAULTS.enableLeadFollowUpReminders,
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

  const handleToggleChange = async (key: keyof AutomationToggles, value: boolean) => {
    const previous = automationToggles[key];
    setAutomationToggles(prev => ({ ...prev, [key]: value }));
    setSavingAutomation(true);

    try {
      const response = await fetch('/api/tpa-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });

      if (!response.ok) {
        setAutomationToggles(prev => ({ ...prev, [key]: previous }));
        toast({
          title: 'Error',
          description: 'Failed to update automation setting',
          variant: 'destructive',
        });
      }
    } catch {
      setAutomationToggles(prev => ({ ...prev, [key]: previous }));
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setSavingAutomation(false);
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

      <Card className="p-6 space-y-6 mt-6">
        <div>
          <h3 className="text-lg font-semibold mb-1">Automations</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Control which automations are active for your organization. Changes take effect immediately.
          </p>

          <div className="space-y-8">
            {AUTOMATION_CONFIG.map((group) => (
              <div key={group.section}>
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
                  {group.section}
                </h4>
                <div className="space-y-4">
                  {group.toggles.map((toggle) => (
                    <div
                      key={toggle.key}
                      className="flex items-center justify-between gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <Label htmlFor={toggle.key} className="font-medium">
                          {toggle.label}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {toggle.description}
                        </p>
                      </div>
                      <Switch
                        id={toggle.key}
                        checked={automationToggles[toggle.key]}
                        onCheckedChange={(checked) =>
                          handleToggleChange(toggle.key, checked)
                        }
                        disabled={savingAutomation}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </form>
  );
}
