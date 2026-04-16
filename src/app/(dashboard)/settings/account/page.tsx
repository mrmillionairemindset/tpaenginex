import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { AccountSettings } from '@/components/settings/account-settings';

export default async function AccountSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signin');

  return (
    <div>
      <PageHeader
        title="Account"
        description="Manage your data and account lifecycle"
      />
      <div className="mt-6 space-y-6 max-w-2xl">
        <AccountSettings userEmail={user.email} />
      </div>
    </div>
  );
}
