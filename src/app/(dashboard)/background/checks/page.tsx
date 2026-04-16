import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { BackgroundChecksTable } from '@/components/background/background-checks-table';

export default async function BackgroundChecksPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signin');
  if (!user.role?.startsWith('tpa_') && user.role !== 'platform_admin') redirect('/dashboard');

  return (
    <div>
      <PageHeader
        title="Background Checks"
        description="FCRA-compliant background screening via Checkr. Track status, view reports, and manage candidates."
      />
      <div className="mt-6">
        <BackgroundChecksTable />
      </div>
    </div>
  );
}
