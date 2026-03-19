import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { OrdersTable } from '@/components/orders/orders-table';

export default async function ClientPortalOrdersPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  if (user.role !== 'client_admin') {
    redirect('/dashboard');
  }

  return (
    <div>
      <PageHeader
        title="My Orders"
        description="View your screening orders"
      />

      <div className="mt-6">
        <OrdersTable userRole={user.role || ''} />
      </div>
    </div>
  );
}
