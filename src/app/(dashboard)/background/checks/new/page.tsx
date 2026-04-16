import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { CreateCheckForm } from '@/components/background/create-check-form';

export default async function NewBackgroundCheckPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signin');
  if (!['tpa_admin', 'tpa_staff', 'platform_admin'].includes(user.role ?? '')) {
    redirect('/background/checks');
  }

  return (
    <div>
      <PageHeader
        title="New Background Check"
        description="Send a candidate invitation and initiate a Checkr report."
      />
      <div className="mt-6">
        <CreateCheckForm />
      </div>
    </div>
  );
}
