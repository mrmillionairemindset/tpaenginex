import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { ClientDetail } from '@/components/clients/client-detail';

export default async function ClientDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  const hasAccess =
    user.role === 'tpa_admin' || user.role === 'tpa_staff' || user.role === 'platform_admin';

  if (!hasAccess) {
    redirect('/dashboard');
  }

  return <ClientDetail clientOrgId={params.id} userRole={user.role || ''} />;
}
