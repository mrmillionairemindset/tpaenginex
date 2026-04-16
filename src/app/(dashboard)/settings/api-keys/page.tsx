import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { ApiKeysManager } from '@/components/settings/api-keys-manager';

export default async function ApiKeysSettingsPage() {
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
        title="API Keys"
        description="Manage API keys for programmatic access to your TPA data. Keys authenticate machine-to-machine integrations."
      />
      <ApiKeysManager />
    </div>
  );
}
