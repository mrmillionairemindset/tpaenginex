import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { BatTestsTable } from '@/components/occ/bat-tests-table';

export default async function BatTestsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signin');
  if (!user.role?.startsWith('tpa_') && user.role !== 'platform_admin') redirect('/dashboard');

  return (
    <div>
      <PageHeader
        title="Breath Alcohol Tests"
        description="DOT-compliant BAT testing log with technician and device details."
      />
      <div className="mt-6">
        <BatTestsTable />
      </div>
    </div>
  );
}
