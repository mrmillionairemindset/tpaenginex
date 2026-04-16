import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PhysicalDetail } from '@/components/occ/physical-detail';

export default async function PhysicalDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signin');
  if (!user.role?.startsWith('tpa_') && user.role !== 'platform_admin') redirect('/dashboard');

  return (
    <div>
      <PhysicalDetail examId={params.id} userRole={user.role || ''} hasNrcme={Boolean(user.nrcmeNumber)} />
    </div>
  );
}
