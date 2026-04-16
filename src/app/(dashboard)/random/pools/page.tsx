import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { hasPermission } from '@/auth/rbac';
import { PageHeader } from '@/components/ui/page-header';
import { RandomPoolsTable } from '@/components/random/random-pools-table';

export default async function RandomPoolsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signin');

  const canView = await hasPermission('view_random');
  if (!canView) redirect('/dashboard');

  return (
    <div>
      <PageHeader
        title="Selection Pools"
        description="All random testing pools across programs"
      />
      <div className="mt-6">
        <RandomPoolsTable />
      </div>
    </div>
  );
}
