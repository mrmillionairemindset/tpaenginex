import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { ReviewsTable } from '@/components/dqf/reviews-table';

export default async function AnnualReviewsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signin');
  if (!user.role?.startsWith('tpa_') && user.role !== 'platform_admin') redirect('/dashboard');

  return (
    <div>
      <PageHeader title="Annual Reviews" description="Schedule and track annual driver reviews" />
      <div className="mt-6">
        <ReviewsTable />
      </div>
    </div>
  );
}
