import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { CollectorAssignments } from '@/components/collector-portal/collector-assignments';

export default async function CollectorPortalPage() {
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
        title="My Assignments"
        description="Orders assigned to you for collection"
      />

      <div className="mt-6">
        <CollectorAssignments />
      </div>
    </div>
  );
}
