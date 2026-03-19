import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { NewEventForm } from '@/components/events/new-event-form';

export default async function NewEventPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  const canCreate = user.role === 'tpa_admin' || user.role === 'tpa_staff' || user.role === 'platform_admin';
  if (!canCreate) {
    redirect('/events');
  }

  return (
    <div>
      <PageHeader
        title="New Event"
        description="Create a batch collection event or random pull"
      />

      <div className="mt-6 max-w-2xl">
        <NewEventForm />
      </div>
    </div>
  );
}
