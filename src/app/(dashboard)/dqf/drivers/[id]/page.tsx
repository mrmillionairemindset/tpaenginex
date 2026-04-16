import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { DriverDetail } from '@/components/dqf/driver-detail';

export default async function DriverDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signin');
  if (!user.role?.startsWith('tpa_') && user.role !== 'platform_admin') redirect('/dashboard');

  return <DriverDetail driverId={params.id} userRole={user.role || ''} />;
}
