import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { ClientDriversTable } from '@/components/dqf/client-drivers-table';

export default async function ClientDqfDriversPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signin');
  if (user.role !== 'client_admin' && user.role !== 'platform_admin') redirect('/dashboard');

  return (
    <div>
      <PageHeader title="Driver List" description="View your drivers and their qualification status" />
      <div className="mt-6"><ClientDriversTable /></div>
    </div>
  );
}
