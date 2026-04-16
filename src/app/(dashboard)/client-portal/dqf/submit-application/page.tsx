import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { ClientSubmitApplication } from '@/components/dqf/client-submit-application';

export default async function ClientSubmitApplicationPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signin');
  if (user.role !== 'client_admin' && user.role !== 'platform_admin') redirect('/dashboard');

  return (
    <div>
      <PageHeader title="Submit Driver Application" description="Submit a new driver application for qualification processing" />
      <div className="mt-6"><ClientSubmitApplication /></div>
    </div>
  );
}
