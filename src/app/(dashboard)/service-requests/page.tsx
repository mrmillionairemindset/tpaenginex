import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { ServiceRequestsTable } from '@/components/service-requests/service-requests-table';

export default async function ServiceRequestsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  // Only TPA admin and staff can view
  const canView = user.role === 'tpa_admin' || user.role === 'tpa_staff' || user.role === 'platform_admin';
  if (!canView) {
    redirect('/dashboard');
  }

  return (
    <div>
      <PageHeader
        title="Service Requests"
        description="Review and process client service requests"
      />

      <div className="mt-6">
        <ServiceRequestsTable />
      </div>
    </div>
  );
}
