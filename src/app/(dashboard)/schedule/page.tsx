import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { ScheduleView } from '@/components/schedule/schedule-view';

export default async function SchedulePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  const isTpaUser = user.role?.startsWith('tpa_') || user.role === 'platform_admin';
  if (!isTpaUser) {
    redirect('/dashboard');
  }

  return (
    <div>
      <PageHeader
        title="Schedule"
        description="View scheduled orders, events, and follow-ups"
      />

      <div className="mt-6">
        <ScheduleView />
      </div>
    </div>
  );
}
