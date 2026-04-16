import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';

export default async function DqfSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signin');
  if (user.role !== 'tpa_admin' && user.role !== 'platform_admin') redirect('/dashboard');

  return (
    <div>
      <PageHeader title="DQF Settings" description="Configure Driver Qualification File module settings" />
      <div className="mt-6 space-y-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-2">Default Checklist</h3>
          <p className="text-muted-foreground text-sm">Configure default qualification requirements for new drivers. Coming soon.</p>
        </Card>
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-2">Notification Preferences</h3>
          <p className="text-muted-foreground text-sm">Configure when to send expiry alerts and review reminders. Coming soon.</p>
        </Card>
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-2">Compliance Scoring</h3>
          <p className="text-muted-foreground text-sm">Adjust compliance score weights and thresholds. Coming soon.</p>
        </Card>
      </div>
    </div>
  );
}
