import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { CollectorSchedule } from '@/components/collector-portal/collector-schedule';

export default async function CollectorSchedulePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  if (user.role !== 'collector') {
    redirect('/dashboard');
  }

  return (
    <div>
      <PageHeader
        title="My Schedule"
        description="Your assignments for the current week"
      />

      <div className="mt-6">
        <CollectorSchedule />
      </div>
    </div>
  );
}
