import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PhysicalExamFlow } from '@/components/occ/physical-exam-flow';

export default async function PhysicalExamFlowPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signin');
  if (!user.role?.startsWith('tpa_') && user.role !== 'platform_admin') redirect('/dashboard');

  return (
    <div>
      <PhysicalExamFlow
        examId={params.id}
        userRole={user.role || ''}
        hasNrcme={Boolean(user.nrcmeNumber)}
      />
    </div>
  );
}
