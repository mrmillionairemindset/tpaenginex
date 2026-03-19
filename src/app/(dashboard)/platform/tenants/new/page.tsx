import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { NewTenantForm } from '@/components/platform/new-tenant-form';

export default async function NewTenantPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  if (user.role !== 'platform_admin') {
    redirect('/dashboard');
  }

  return (
    <div>
      <PageHeader
        title="Provision TPA"
        description="Create a new TPA tenant"
      />

      <div className="mt-6 max-w-2xl">
        <NewTenantForm />
      </div>
    </div>
  );
}
