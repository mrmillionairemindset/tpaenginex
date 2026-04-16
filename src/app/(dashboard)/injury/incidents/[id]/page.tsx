import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { IncidentDetail } from '@/components/injury/incident-detail';
import { roleHasPermission } from '@/auth/rbac';

export default async function IncidentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signin');
  if (!user.role?.startsWith('tpa_') && user.role !== 'platform_admin') {
    redirect('/dashboard');
  }

  const canSignOffRtw = user.role ? roleHasPermission(user.role, 'sign_off_rtw') : false;

  return (
    <div>
      <IncidentDetail
        incidentId={params.id}
        userRole={user.role || ''}
        canSignOffRtw={canSignOffRtw}
      />
    </div>
  );
}
