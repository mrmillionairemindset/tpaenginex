import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { ComplianceDashboard } from '@/components/dqf/compliance-dashboard';

export default async function ComplianceDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signin');
  if (!user.role?.startsWith('tpa_') && user.role !== 'platform_admin') redirect('/dashboard');

  return (
    <div>
      <PageHeader title="Compliance Dashboard" description="Per-driver and per-client compliance scoring" />
      <div className="mt-6">
        <ComplianceDashboard />
      </div>
    </div>
  );
}
