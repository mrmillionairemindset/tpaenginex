import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { CollectorSchedule } from '@/components/collectors/collector-schedule';

export default async function CollectorDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  const hasAccess =
    user.role === 'tpa_admin' || user.role === 'tpa_staff' || user.role === 'platform_admin';

  if (!hasAccess) {
    redirect('/dashboard');
  }

  return <CollectorSchedule collectorId={params.id} userRole={user.role || ''} />;
}
