import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { IncidentsTable } from '@/components/injury/incidents-table';

export default async function IncidentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signin');
  if (!user.role?.startsWith('tpa_') && user.role !== 'platform_admin') {
    redirect('/dashboard');
  }

  return (
    <div>
      <PageHeader
        title="Injury Incidents"
        description="Workplace injury intake, treatment log, and return-to-work tracking. Recordable cases feed the OSHA 300 log."
      />
      <div className="mt-6">
        <IncidentsTable />
      </div>
    </div>
  );
}
