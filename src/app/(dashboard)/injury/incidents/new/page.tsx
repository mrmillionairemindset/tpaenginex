import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { ReportIncidentForm } from '@/components/injury/report-incident-form';

export default async function NewIncidentPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signin');
  if (!user.role?.startsWith('tpa_') && user.role !== 'platform_admin') {
    redirect('/dashboard');
  }

  return (
    <div>
      <PageHeader
        title="Report Workplace Incident"
        description="Capture the details right after the incident — accuracy now saves weeks later."
      />
      <div className="mt-6">
        <ReportIncidentForm />
      </div>
    </div>
  );
}
