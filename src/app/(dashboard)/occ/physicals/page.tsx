import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { PhysicalsTable } from '@/components/occ/physicals-table';

export default async function PhysicalsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signin');
  if (!user.role?.startsWith('tpa_') && user.role !== 'platform_admin') redirect('/dashboard');

  return (
    <div>
      <PageHeader
        title="Physical Exams"
        description="DOT and non-DOT physicals, MEC issuance, and FMCSA submission status."
      />
      <div className="mt-6">
        <PhysicalsTable />
      </div>
    </div>
  );
}
