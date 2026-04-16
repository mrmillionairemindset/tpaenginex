import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { ReviewDetail } from '@/components/dqf/review-detail';

export default async function ReviewDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signin');
  if (!user.role?.startsWith('tpa_') && user.role !== 'platform_admin') redirect('/dashboard');
  return <ReviewDetail reviewId={params.id} userRole={user.role || ''} />;
}
