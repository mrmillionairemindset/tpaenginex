import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { CandidatesTable } from '@/components/candidates/candidates-table';

export default async function CandidatesPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  // Only employers can view candidates
  if (!user.role?.startsWith('employer')) {
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
