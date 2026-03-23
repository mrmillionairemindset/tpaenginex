import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { CollectorsTable } from '@/components/collectors/collectors-table';

export default async function CollectorsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  const canView = user.role === 'tpa_admin' || user.role === 'tpa_staff' || user.role === 'platform_admin';
  if (!canView) {
    redirect('/dashboard');
  }

  return (
    <div>
      <PageHeader
        title="Collectors"
        description="View your collectors and their assignments"
      />

      <div className="mt-6">
        <CollectorsTable />
      </div>
    </div>
  );
}
