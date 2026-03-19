import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { CandidatesTable } from '@/components/candidates/candidates-table';

export default async function CandidatesPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  // Only TPA users and platform admins can view candidates
  const canView = user.role?.startsWith('tpa_') || user.role === 'platform_admin';
  if (!canView) {
    redirect('/dashboard');
  }

  return (
    <div>
      <PageHeader
        title="Candidates"
        description="Manage your candidates and their screening history"
      />

      <div className="mt-6">
        <CandidatesTable />
      </div>
    </div>
  );
}
