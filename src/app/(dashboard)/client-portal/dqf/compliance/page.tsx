import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { ClientComplianceDashboard } from '@/components/dqf/client-compliance-dashboard';

export default async function ClientDqfCompliancePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signin');
  if (user.role !== 'client_admin' && user.role !== 'platform_admin') redirect('/dashboard');

  return (
    <div>
      <PageHeader title="Compliance Dashboard" description="View compliance scores for your drivers" />
      <div className="mt-6"><ClientComplianceDashboard /></div>
    </div>
  );
}
