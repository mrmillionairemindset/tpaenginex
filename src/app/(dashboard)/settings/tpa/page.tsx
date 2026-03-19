import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { TpaSettingsForm } from '@/components/settings/tpa-settings-form';

export default async function TpaSettingsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  if (user.role !== 'tpa_admin') {
    redirect('/dashboard');
  }

  return (
    <div>
      <PageHeader
        title="TPA Settings"
        description="Configure your TPA branding and defaults"
      />

      <div className="mt-6 max-w-2xl">
        <TpaSettingsForm orgId={user.orgId || ''} />
      </div>
    </div>
  );
}
