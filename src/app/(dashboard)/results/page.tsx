import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { ResultsTable } from '@/components/results/results-table';

export default async function ResultsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  // Only providers can access results
  if (!user.role?.startsWith('tpa_') && user.role !== 'platform_admin') {
    redirect('/dashboard');
  }

  return (
    <div>
      <PageHeader
        title="Results Management"
        description="Upload and manage screening test results"
      />

      <div className="mt-6">
        <ResultsTable />
      </div>
    </div>
  );
}
