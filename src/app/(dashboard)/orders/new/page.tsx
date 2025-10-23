import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { NewOrderForm } from '@/components/orders/new-order-form';

export default async function NewOrderPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  // Only employers can create orders
  if (!user.role?.startsWith('employer')) {
    redirect('/dashboard');
  }

  return (
    <div>
      <PageHeader
        title="Create New Order"
        description="Submit a new screening order"
      />

      <div className="mt-6 max-w-2xl">
        <NewOrderForm orgId={user.orgId} />
      </div>
    </div>
  );
}
