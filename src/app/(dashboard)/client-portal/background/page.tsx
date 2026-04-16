import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { BackgroundChecksTable } from '@/components/background/background-checks-table';

export default async function ClientPortalBackgroundPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signin');
  if (user.role !== 'client_admin' && user.role !== 'platform_admin') redirect('/dashboard');

  return (
    <div>
      <PageHeader
        title="Background Checks"
        description="View the status of background checks your TPA has run for your organization."
      />
      <div className="mt-6">
        <BackgroundChecksTable canCreate={false} detailPathPrefix="/client-portal/background" />
      </div>
    </div>
  );
}
