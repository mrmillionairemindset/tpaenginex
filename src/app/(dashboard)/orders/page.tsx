import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { OrdersViewToggle } from '@/components/orders/orders-view-toggle';

export default async function OrdersPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  const isClient = user.role === 'client_admin';
  const isTpaUser = user.role?.startsWith('tpa_') || user.role === 'platform_admin';

  return (
    <div>
      <PageHeader
        title="Orders"
        description={
          isClient
            ? 'View your screening orders'
            : 'View and manage all screening orders'
        }
      >
        {isTpaUser && (
          <Link href="/orders/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Order
            </Button>
          </Link>
        )}
      </PageHeader>

      <div className="mt-6">
        <OrdersViewToggle userRole={user.role || ''} />
      </div>
    </div>
  );
}
