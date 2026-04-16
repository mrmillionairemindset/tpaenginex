import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { WebhooksManager } from '@/components/settings/webhooks-manager';

export default async function WebhooksSettingsPage() {
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
        title="Webhooks"
        description="Receive HMAC-signed HTTP callbacks when lifecycle events occur in your TPA."
      />
      <WebhooksManager />
    </div>
  );
}
