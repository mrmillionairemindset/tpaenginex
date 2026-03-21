import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { PlatformDashboard } from '@/components/platform/platform-dashboard';

export default async function PlatformPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  if (user.role !== 'platform_admin') {
    redirect('/dashboard');
  }

  return (
    <div>
      <PageHeader
        title="Platform Overview"
        description="Manage all TPA tenants across the platform"
      />

      <div className="mt-6">
        <PlatformDashboard />
      </div>
    </div>
  );
}
