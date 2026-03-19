import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { LeadsTable } from '@/components/leads/leads-table';

export default async function LeadsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  const hasAccess =
    user.role === 'tpa_admin' || user.role === 'platform_admin';

  if (!hasAccess) {
    redirect('/dashboard');
  }

  return (
    <div>
      <PageHeader
        title="Leads & Pipeline"
        description="Track prospective clients through the sales pipeline"
      />

      <div className="mt-6">
        <LeadsTable />
      </div>
    </div>
  );
}
