import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { OrganizationSettingsTabs } from '@/components/settings/organization/organization-settings-tabs';

export default async function OrganizationSettingsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  if (user.role !== 'tpa_admin' && user.role !== 'platform_admin') {
    redirect('/dashboard');
  }

  return (
    <div>
      <PageHeader
        title="Organization Settings"
        description="Manage your organization details, branding, team, and locations"
      />

      <div className="mt-6 max-w-3xl">
        <OrganizationSettingsTabs
          orgId={user.orgId || ''}
          currentUserId={user.id}
          orgName={user.organization?.name || ''}
        />
      </div>
    </div>
  );
}
