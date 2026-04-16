import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { ApplicationsTable } from '@/components/dqf/applications-table';

export default async function DriverApplicationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signin');
  if (!user.role?.startsWith('tpa_') && user.role !== 'platform_admin') redirect('/dashboard');

  return (
    <div>
      <PageHeader title="Driver Applications" description="Manage new hire driver applications" />
      <div className="mt-6">
        <ApplicationsTable userRole={user.role || undefined} />
      </div>
    </div>
  );
}
