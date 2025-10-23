import { redirect } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { getCurrentUser } from '@/auth/get-user';

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  return (
    <DashboardLayout
      user={{
        name: user.name,
        email: user.email,
        role: user.role || '',
        organization: user.organization,
      }}
    >
      {children}
    </DashboardLayout>
  );
}
