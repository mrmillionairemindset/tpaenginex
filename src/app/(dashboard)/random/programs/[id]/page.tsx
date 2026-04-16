import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { hasPermission } from '@/auth/rbac';
import { RandomProgramDetail } from '@/components/random/random-program-detail';

export default async function RandomProgramDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signin');

  const canView = await hasPermission('view_random');
  if (!canView) redirect('/dashboard');

  return <RandomProgramDetail programId={params.id} />;
}
