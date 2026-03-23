import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { CollectorAssignmentDetail } from '@/components/collector-portal/collector-assignment-detail';

export default async function CollectorAssignmentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  if (user.role !== 'collector') {
    redirect('/dashboard');
  }

  return (
    <div>
      <PageHeader
        title="Assignment Detail"
        description="View order details and complete collection"
      />

      <div className="mt-6">
        <CollectorAssignmentDetail orderId={params.id} />
      </div>
    </div>
  );
}
