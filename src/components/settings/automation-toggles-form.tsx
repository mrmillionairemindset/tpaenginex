'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

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

export function AutomationTogglesForm() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toggles, setToggles] = useState<AutomationToggles>(AUTOMATION_DEFAULTS);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const response = await fetch('/api/tpa-settings');
        if (response.ok) {
          const data = await response.json();
          setToggles({
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
        console.error('Failed to fetch automation settings:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchSettings();
  }, []);

  const handleToggleChange = async (key: keyof AutomationToggles, value: boolean) => {
    const previous = toggles[key];
    setToggles(prev => ({ ...prev, [key]: value }));
    setSaving(true);

    try {
      const response = await fetch('/api/tpa-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });

      if (!response.ok) {
        setToggles(prev => ({ ...prev, [key]: previous }));
        toast({
          title: 'Error',
          description: 'Failed to update automation setting',
          variant: 'destructive',
        });
      }
    } catch {
      setToggles(prev => ({ ...prev, [key]: previous }));
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
    <Card className="p-6 space-y-6">
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
                    checked={toggles[toggle.key]}
                    onCheckedChange={(checked) =>
                      handleToggleChange(toggle.key, checked)
                    }
                    disabled={saving}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
