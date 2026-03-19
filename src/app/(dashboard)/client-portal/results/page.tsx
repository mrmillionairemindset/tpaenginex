import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { ClientResultsTable } from '@/components/clients/client-results-table';

export default async function ClientPortalResultsPage() {
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
        title="Results"
        description="View and download completed results"
      />

      <div className="mt-6">
        <ClientResultsTable />
      </div>
    </div>
  );
}
