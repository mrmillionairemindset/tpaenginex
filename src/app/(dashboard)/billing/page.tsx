import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { BillingTable } from '@/components/billing/billing-table';

export default async function BillingPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  const hasAccess =
    user.role === 'tpa_admin' ||
    user.role === 'tpa_billing' ||
    user.role === 'platform_admin';

  if (!hasAccess) {
    redirect('/dashboard');
  }

  return (
    <div>
      <PageHeader
        title="Billing Queue"
        description="Track invoices and payment status"
      />

      <div className="mt-6">
        <BillingTable />
      </div>
    </div>
  );
}
