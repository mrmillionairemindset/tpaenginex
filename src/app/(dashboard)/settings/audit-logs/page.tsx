import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { AuditLogTable } from '@/components/audit/audit-log-table';

export default async function AuditLogsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signin');
  if (user.role !== 'tpa_admin' && user.role !== 'platform_admin') redirect('/dashboard');
  return (
    <div>
      <PageHeader title="Audit Logs" description="Track all changes to your TPA's data" />
      <div className="mt-6"><AuditLogTable /></div>
    </div>
  );
}
