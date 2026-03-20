import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { ClientDocumentsTable } from '@/components/clients/client-documents-table';

export default async function ClientPortalDocumentsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  if (user.role !== 'client_admin') {
    redirect('/dashboard');
  }

  if (!user.orgId) {
    redirect('/dashboard');
  }

  return (
    <div>
      <PageHeader
        title="Documents"
        description="View and download contracts, SOPs, BAAs, and other documents shared with your organization"
      />

      <div className="mt-6">
        <ClientDocumentsTable clientOrgId={user.orgId} />
      </div>
    </div>
  );
}
