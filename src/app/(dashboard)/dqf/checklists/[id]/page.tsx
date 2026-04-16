import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { ChecklistDetail } from '@/components/dqf/checklist-detail';

export default async function ChecklistDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signin');
  if (!user.role?.startsWith('tpa_') && user.role !== 'platform_admin') redirect('/dashboard');
  return <ChecklistDetail checklistId={params.id} userRole={user.role || ''} />;
}
