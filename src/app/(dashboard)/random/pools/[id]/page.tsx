import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { hasPermission } from '@/auth/rbac';
import { RandomPoolDetail } from '@/components/random/random-pool-detail';

export default async function RandomPoolDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signin');

  const canView = await hasPermission('view_random');
  if (!canView) redirect('/dashboard');

  return <RandomPoolDetail poolId={params.id} />;
}
