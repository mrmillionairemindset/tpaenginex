import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { ChecklistsTable } from '@/components/dqf/checklists-table';

export default async function QualificationChecklistsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signin');
  if (!user.role?.startsWith('tpa_') && user.role !== 'platform_admin') redirect('/dashboard');

  return (
    <div>
      <PageHeader title="Qualification Checklists" description="Configure required qualifications per client" />
      <div className="mt-6">
        <ChecklistsTable />
      </div>
    </div>
  );
}
