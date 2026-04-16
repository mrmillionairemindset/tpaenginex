import { redirect } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { getCurrentUser } from '@/auth/get-user';
import { getEnabledModules } from '@/auth/rbac';
import { getTenantBranding } from '@/lib/subdomain';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  const enabledModules = await getEnabledModules(user.tpaOrgId);
  const branding = user.tpaOrgId ? await getTenantBranding(user.tpaOrgId) : null;

  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { emailVerified: true },
  });
  const emailVerified = !!dbUser?.emailVerified;

  return (
    <DashboardLayout
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organization: user.organization ? {
          ...user.organization,
          slug: user.organization.slug || '',
        } : null,
      }}
      enabledModules={enabledModules}
      emailVerified={emailVerified}
      branding={branding ? {
        brandName: branding.brandName,
        logoUrl: branding.logoUrl,
        faviconUrl: branding.faviconUrl,
        primaryColor: branding.primaryColor,
      } : undefined}
      impersonation={user.isImpersonating ? {
        targetName: user.name,
        targetEmail: user.email,
        actualEmail: user.actualUserEmail,
      } : null}
    >
      {children}
    </DashboardLayout>
  );
}
