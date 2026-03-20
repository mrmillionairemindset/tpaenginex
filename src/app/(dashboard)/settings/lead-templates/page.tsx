import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { LeadTemplatesEditor } from '@/components/settings/lead-templates-editor';

export default async function LeadTemplatesPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  if (user.role !== 'tpa_admin' && user.role !== 'platform_admin') {
    redirect('/dashboard');
  }

  return (
    <div>
      <PageHeader
        title="Lead Email Templates"
        description="Customize the automated emails sent when leads move through your pipeline stages"
      />

      <div className="mt-6">
        <LeadTemplatesEditor />
      </div>
    </div>
  );
}
