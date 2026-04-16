import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { hasPermission } from '@/auth/rbac';
import { PageHeader } from '@/components/ui/page-header';
import { RandomProgramsTable } from '@/components/random/random-programs-table';

export default async function RandomProgramsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signin');

  const canView = await hasPermission('view_random');
  if (!canView) redirect('/dashboard');

  return (
    <div>
      <PageHeader
        title="Random Programs"
        description="DOT-compliant random drug & alcohol testing programs (49 CFR Part 382)"
      />
      <div className="mt-6">
        <RandomProgramsTable />
      </div>
    </div>
  );
}
