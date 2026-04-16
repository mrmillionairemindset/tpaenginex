import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { DotComplianceReport } from '@/components/reports/dot-compliance-report';

export default async function DotComplianceReportPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  const hasAccess =
    user.role === 'tpa_admin' ||
    user.role === 'tpa_records' ||
    user.role === 'platform_admin';

  if (!hasAccess) {
    redirect('/dashboard');
  }

  return (
    <div>
      <PageHeader
        title="DOT Compliance Report"
        description="Audit reports for DOT-regulated drug testing programs"
      />

      <div className="mt-6">
        <DotComplianceReport />
      </div>
    </div>
  );
}
