import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { FitTestsTable } from '@/components/occ/fit-tests-table';

export default async function FitTestsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signin');
  if (!user.role?.startsWith('tpa_') && user.role !== 'platform_admin') redirect('/dashboard');

  return (
    <div>
      <PageHeader
        title="Respirator Fit Tests"
        description="OSHA 1910.134 respirator fit testing records and renewal dates."
      />
      <div className="mt-6">
        <FitTestsTable />
      </div>
    </div>
  );
}
