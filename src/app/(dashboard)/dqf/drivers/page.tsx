import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { DriversTable } from '@/components/dqf/drivers-table';

export default async function DQFDriversPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signin');
  if (!user.role?.startsWith('tpa_') && user.role !== 'platform_admin') redirect('/dashboard');

  return (
    <div>
      <PageHeader title="DQF Drivers" description="View and manage driver qualification files" />
      <div className="mt-6">
        <DriversTable />
      </div>
    </div>
  );
}
