import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { OrganizationsTable } from '@/components/organizations/organizations-table';

export default async function OrganizationsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  // Only providers can view organizations
  if (!user.role?.startsWith('tpa_') && user.role !== 'platform_admin') {
    redirect('/dashboard');
  }

  return (
    <div>
      <PageHeader
        title="Employer Organizations"
        description="Manage your employer client relationships"
      />

      <div className="mt-6">
        <OrganizationsTable />
      </div>
    </div>
  );
}
