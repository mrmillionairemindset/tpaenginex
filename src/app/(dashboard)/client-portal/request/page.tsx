import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { ServiceRequestForm } from '@/components/clients/service-request-form';

export default async function ClientPortalRequestPage() {
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
        title="Request Service"
        description="Submit a new service request to your TPA"
      />

      <div className="mt-6 max-w-2xl">
        <ServiceRequestForm />
      </div>
    </div>
  );
}
