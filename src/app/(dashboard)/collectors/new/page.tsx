import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { NewCollectorForm } from '@/components/collectors/new-collector-form';

export default async function NewCollectorPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  if (user.role !== 'tpa_admin' && user.role !== 'platform_admin') {
    redirect('/collectors');
  }

  return (
    <div>
      <PageHeader
        title="Add Collector"
        description="Add a new mobile PRN collector to your team"
      />

      <div className="mt-6 max-w-2xl">
        <NewCollectorForm />
      </div>
    </div>
  );
}
