import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { PageHeader } from '@/components/ui/page-header';
import { TwoFactorSettings } from '@/components/settings/security/two-factor-settings';
import { LoginHistory } from '@/components/settings/security/login-history';
import { ActiveSessions } from '@/components/settings/security/active-sessions';

export default async function SecuritySettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signin');

  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { totpEnabled: true, totpVerifiedAt: true },
  });

  return (
    <div>
      <PageHeader
        title="Security"
        description="Manage your account security settings"
      />
      <div className="mt-6 space-y-6 max-w-2xl">
        <TwoFactorSettings
          initialEnabled={dbUser?.totpEnabled ?? false}
          enabledAt={dbUser?.totpVerifiedAt?.toISOString() ?? null}
        />
        <ActiveSessions />
        <LoginHistory />
      </div>
    </div>
  );
}
