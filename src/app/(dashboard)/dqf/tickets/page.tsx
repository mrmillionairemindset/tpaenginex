import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { TicketFormsTable } from '@/components/dqf/ticket-forms-table';

export default async function PublicTicketFormsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signin');
  if (!user.role?.startsWith('tpa_') && user.role !== 'platform_admin') redirect('/dashboard');

  return (
    <div>
      <PageHeader title="Public Ticket Forms" description="Manage embeddable driver application intake forms" />
      <div className="mt-6">
        <TicketFormsTable />
      </div>
    </div>
  );
}
