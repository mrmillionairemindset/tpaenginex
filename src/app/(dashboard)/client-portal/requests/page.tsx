import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { ClientRequestsTable } from '@/components/clients/client-requests-table';

export default async function ClientPortalRequestsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  if (user.role !== 'client_admin') {
    redirect('/dashboard');
  }

  return (
    <div>
      <PageHeader
        title="My Requests"
        description="View your submitted service requests and their status"
      />

      <div className="mt-6">
        <ClientRequestsTable />
      </div>
    </div>
  );
}
