import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { EventDetail } from '@/components/events/event-detail';

export default async function EventDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  const canView = user.role?.startsWith('tpa_') || user.role === 'platform_admin';
  if (!canView) {
    redirect('/dashboard');
  }

  return <EventDetail eventId={params.id} userRole={user.role || ''} />;
}
