import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { ClientsTable } from '@/components/clients/clients-table';

export default async function ClientsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  const hasAccess =
    user.role === 'tpa_admin' ||
    user.role === 'tpa_staff' ||
    user.role === 'platform_admin';

  if (!hasAccess) {
    redirect('/dashboard');
  }

  const canAdd =
    user.role === 'tpa_admin' || user.role === 'tpa_staff' || user.role === 'platform_admin';

  return (
    <div>
      <PageHeader
        title="Clients"
        description="Manage your client organizations"
      >
        {canAdd && (
          <Link href="/clients/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Client
            </Button>
          </Link>
        )}
      </PageHeader>

      <div className="mt-6">
        <ClientsTable />
      </div>
    </div>
  );
}
