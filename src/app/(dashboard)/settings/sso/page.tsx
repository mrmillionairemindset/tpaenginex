import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { SsoSettings } from '@/components/settings/sso-settings';

export default async function SsoSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signin');
  if (user.role !== 'tpa_admin' && user.role !== 'platform_admin') {
    redirect('/dashboard');
  }
  return (
    <div>
      <PageHeader
        title="SSO (SAML)"
        description="Configure SAML-based single sign-on for your organization. Users can sign in through your identity provider (Okta, Azure AD, Google Workspace, etc.)."
      />
      <SsoSettings />
    </div>
  );
}
