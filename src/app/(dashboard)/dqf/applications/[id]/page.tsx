import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { ApplicationDetail } from '@/components/dqf/application-detail';

export default async function ApplicationDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signin');
  if (!user.role?.startsWith('tpa_') && user.role !== 'platform_admin') redirect('/dashboard');

  return <ApplicationDetail applicationId={params.id} userRole={user.role || ''} />;
}
