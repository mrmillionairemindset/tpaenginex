import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { AutomationTogglesForm } from '@/components/settings/automation-toggles-form';

export default async function AutomationsSettingsPage() {
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
        title="Automations"
        description="Control which automations are active for your organization"
      />

      <div className="mt-6 max-w-2xl">
        <AutomationTogglesForm />
      </div>
    </div>
  );
}
