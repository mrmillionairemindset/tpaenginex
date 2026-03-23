import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { CollectorDocuments } from '@/components/collector-portal/collector-documents';

export default async function CollectorDocumentsPage() {
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
        title="My Documents"
        description="Documents uploaded for your assignments"
      />

      <div className="mt-6">
        <CollectorDocuments />
      </div>
    </div>
  );
}
