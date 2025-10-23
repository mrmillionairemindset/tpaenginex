import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { OrdersTable } from '@/components/orders/orders-table';

export default async function OrdersPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  const isEmployer = user.role?.startsWith('employer');
  const isProvider = user.role?.startsWith('provider');

  return (
    <div>
      <PageHeader
        title="Orders"
        description={
          isEmployer
            ? 'Manage your screening orders'
            : 'View and manage all screening orders'
        }
      >
        {isEmployer && (
          <Link href="/orders/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Order
            </Button>
          </Link>
        )}
      </PageHeader>

      <div className="mt-6">
        <OrdersTable userRole={user.role || ''} />
      </div>
    </div>
  );
}
