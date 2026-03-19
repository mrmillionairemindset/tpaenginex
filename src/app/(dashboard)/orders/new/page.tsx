import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { NewOrderForm } from '@/components/orders/new-order-form';

export default async function NewOrderPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  // Only TPA staff and admins can create orders
  const canCreate = user.role === 'tpa_admin' || user.role === 'tpa_staff' || user.role === 'platform_admin';
  if (!canCreate) {
    redirect('/dashboard');
  }

  return (
    <div>
      <PageHeader
        title="Create New Order"
        description="Submit a new screening order"
      />

      <div className="mt-6 max-w-2xl">
        <NewOrderForm orgId={user.orgId} userRole={user.role || ''} />
      </div>
    </div>
  );
}
