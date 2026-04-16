import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { CheckrSettingsForm } from '@/components/background/checkr-settings-form';

export default async function BackgroundSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signin');
  if (user.role !== 'tpa_admin' && user.role !== 'platform_admin') redirect('/background/checks');

  return (
    <div>
      <PageHeader
        title="Background Screening Settings"
        description="Manage Checkr API credentials for this TPA."
      />
      <div className="mt-6">
        <CheckrSettingsForm />
      </div>
    </div>
  );
}
