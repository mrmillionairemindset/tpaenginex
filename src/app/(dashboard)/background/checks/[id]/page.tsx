import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { CheckDetail } from '@/components/background/check-detail';

export default async function BackgroundCheckDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signin');
  if (!user.role?.startsWith('tpa_') && user.role !== 'platform_admin') redirect('/dashboard');

  return (
    <div>
      <CheckDetail checkId={params.id} userRole={user.role || ''} />
    </div>
  );
}
