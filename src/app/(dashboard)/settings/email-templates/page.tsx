import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { EmailTemplatesEditor } from '@/components/settings/email-templates-editor';

export default async function EmailTemplatesSettingsPage() {
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
        title="Email Templates"
        description="Customize transactional emails sent by the platform. Default copy is used when a template is not customized."
      />

      <div className="mt-6">
        <EmailTemplatesEditor />
      </div>
    </div>
  );
}
