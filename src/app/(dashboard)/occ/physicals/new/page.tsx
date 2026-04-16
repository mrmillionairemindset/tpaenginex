import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { SchedulePhysicalForm } from '@/components/occ/schedule-physical-form';

export default async function NewPhysicalPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signin');
  if (!user.role?.startsWith('tpa_') && user.role !== 'platform_admin') redirect('/dashboard');

  return (
    <div>
      <PageHeader
        title="Schedule Physical Exam"
        description="Book a DOT or non-DOT physical for a driver or worker."
      />
      <div className="mt-6">
        <SchedulePhysicalForm />
      </div>
    </div>
  );
}
