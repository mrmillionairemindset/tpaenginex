import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { NewClientForm } from '@/components/clients/new-client-form';

export default async function NewClientPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  const hasAccess =
    user.role === 'tpa_admin' || user.role === 'platform_admin';

  if (!hasAccess) {
    redirect('/dashboard');
  }

  return (
    <div>
      <PageHeader
        title="Add Client"
        description="Onboard a new client organization"
      />

      <div className="mt-6 max-w-2xl">
        <NewClientForm />
      </div>
    </div>
  );
}
