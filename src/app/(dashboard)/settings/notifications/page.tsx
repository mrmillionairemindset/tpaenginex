import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { NotificationPreferencesForm } from '@/components/settings/notification-preferences';

export default async function NotificationPreferencesPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  return (
    <div>
      <PageHeader
        title="Notification Preferences"
        description="Choose which notifications you want to receive via email and in-app"
      />

      <div className="mt-6 max-w-3xl">
        <NotificationPreferencesForm />
      </div>
    </div>
  );
}
