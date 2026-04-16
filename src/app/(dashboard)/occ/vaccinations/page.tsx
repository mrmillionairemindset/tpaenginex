import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { VaccinationsTable } from '@/components/occ/vaccinations-table';

export default async function VaccinationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signin');
  if (!user.role?.startsWith('tpa_') && user.role !== 'platform_admin') redirect('/dashboard');

  return (
    <div>
      <PageHeader
        title="Vaccinations"
        description="Immunization tracking for workers and drivers."
      />
      <div className="mt-6">
        <VaccinationsTable />
      </div>
    </div>
  );
}
