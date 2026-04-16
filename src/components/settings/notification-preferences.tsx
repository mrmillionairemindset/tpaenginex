'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface NotificationPreferences {
  emailOrderCompletion: boolean;
  emailCollectorAssigned: boolean;
  emailKitReminder: boolean;
  emailResultsPending: boolean;
  emailAnnualReview: boolean;
  emailExpiryAlerts: boolean;
  emailWeeklyDigest: boolean;
  inAppOrderUpdates: boolean;
  inAppDqfEvents: boolean;
  inAppSystem: boolean;
}

const DEFAULTS: NotificationPreferences = {
  emailOrderCompletion: true,
  emailCollectorAssigned: true,
  emailKitReminder: true,
  emailResultsPending: true,
  emailAnnualReview: true,
  emailExpiryAlerts: true,
  emailWeeklyDigest: true,
  inAppOrderUpdates: true,
  inAppDqfEvents: true,
  inAppSystem: true,
};

const EMAIL_TOGGLES: { key: keyof NotificationPreferences; label: string; description: string }[] = [
  { key: 'emailOrderCompletion', label: 'Order Completion', description: 'Emails when an order is marked complete' },
  { key: 'emailCollectorAssigned', label: 'Collector Assigned', description: 'Emails when a collector is assigned to an order' },
  { key: 'emailKitReminder', label: 'Kit Mailing Reminders', description: 'Reminders to mail collection kits' },
  { key: 'emailResultsPending', label: 'Results Pending', description: 'Daily digest when results are pending' },
  { key: 'emailAnnualReview', label: 'Annual Review Reminders', description: 'Emails when driver annual reviews are approaching' },
  { key: 'emailExpiryAlerts', label: 'Expiry Alerts', description: 'License and medical card expiration alerts' },
  { key: 'emailWeeklyDigest', label: 'Weekly Digest', description: 'Weekly summary of activity' },
];

const IN_APP_TOGGLES: { key: keyof NotificationPreferences; label: string; description: string }[] = [
  { key: 'inAppOrderUpdates', label: 'Order Updates', description: 'In-app notifications for order changes' },
  { key: 'inAppDqfEvents', label: 'DQF Events', description: 'In-app notifications for driver qualification events' },
  { key: 'inAppSystem', label: 'System Notifications', description: 'In-app notifications for general system events' },
];

export function NotificationPreferencesForm() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULTS);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch('/api/user-notification-preferences');
        if (response.ok) {
          const data = await response.json();
          if (data?.preferences) {
            setPrefs({
              emailOrderCompletion: data.preferences.emailOrderCompletion ?? DEFAULTS.emailOrderCompletion,
              emailCollectorAssigned: data.preferences.emailCollectorAssigned ?? DEFAULTS.emailCollectorAssigned,
              emailKitReminder: data.preferences.emailKitReminder ?? DEFAULTS.emailKitReminder,
              emailResultsPending: data.preferences.emailResultsPending ?? DEFAULTS.emailResultsPending,
              emailAnnualReview: data.preferences.emailAnnualReview ?? DEFAULTS.emailAnnualReview,
              emailExpiryAlerts: data.preferences.emailExpiryAlerts ?? DEFAULTS.emailExpiryAlerts,
              emailWeeklyDigest: data.preferences.emailWeeklyDigest ?? DEFAULTS.emailWeeklyDigest,
              inAppOrderUpdates: data.preferences.inAppOrderUpdates ?? DEFAULTS.inAppOrderUpdates,
              inAppDqfEvents: data.preferences.inAppDqfEvents ?? DEFAULTS.inAppDqfEvents,
              inAppSystem: data.preferences.inAppSystem ?? DEFAULTS.inAppSystem,
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch preferences:', error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleChange = (key: keyof NotificationPreferences, value: boolean) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/user-notification-preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      });

      if (!response.ok) {
        toast({ title: 'Error', description: 'Failed to save preferences', variant: 'destructive' });
      } else {
        toast({ title: 'Saved', description: 'Notification preferences updated.' });
      }
    } catch {
      toast({ title: 'Error', description: 'An unexpected error occurred', variant: 'destructive' });
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
    <div className="space-y-6">
      <Card className="p-6 space-y-6">
        <div>
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Email Notifications
          </h4>
          <div className="space-y-4">
            {EMAIL_TOGGLES.map((toggle) => (
              <div key={toggle.key} className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <Label htmlFor={toggle.key} className="font-medium">{toggle.label}</Label>
                  <p className="text-sm text-muted-foreground">{toggle.description}</p>
                </div>
                <Switch
                  id={toggle.key}
                  checked={prefs[toggle.key]}
                  onCheckedChange={(checked) => handleChange(toggle.key, checked)}
                  disabled={saving}
                />
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-6">
        <div>
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
            In-App Notifications
          </h4>
          <div className="space-y-4">
            {IN_APP_TOGGLES.map((toggle) => (
              <div key={toggle.key} className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <Label htmlFor={toggle.key} className="font-medium">{toggle.label}</Label>
                  <p className="text-sm text-muted-foreground">{toggle.description}</p>
                </div>
                <Switch
                  id={toggle.key}
                  checked={prefs[toggle.key]}
                  onCheckedChange={(checked) => handleChange(toggle.key, checked)}
                  disabled={saving}
                />
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Preferences'}
        </Button>
      </div>
    </div>
  );
}
