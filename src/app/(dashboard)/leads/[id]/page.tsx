import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { LeadDetail } from '@/components/leads/lead-detail';

export default async function LeadDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  const hasAccess =
    user.role === 'tpa_admin' || user.role === 'tpa_staff' || user.role === 'platform_admin';

  if (!hasAccess) {
    redirect('/dashboard');
  }

  return (
    <div>
      <PageHeader
        title="Lead Details"
        description="View and manage lead information"
      />

      <div className="mt-6">
        <LeadDetail leadId={params.id} userRole={user.role || ''} />
      </div>
    </div>
  );
}
