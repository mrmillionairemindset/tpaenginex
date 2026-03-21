import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { TenantDetail } from '@/components/platform/tenant-detail';

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;

  if (!user) {
    redirect('/auth/signin');
  }

  if (user.role !== 'platform_admin') {
    redirect('/dashboard');
  }

  return <TenantDetail tenantId={id} />;
}
