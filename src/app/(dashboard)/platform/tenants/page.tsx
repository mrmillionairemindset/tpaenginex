import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { TenantsTable } from '@/components/platform/tenants-table';

export default async function TenantsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  if (user.role !== 'platform_admin') {
    redirect('/dashboard');
  }

  return (
    <div>
      <PageHeader
        title="TPA Tenants"
        description="Manage all TPA organizations"
      >
        <Link href="/platform/tenants/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New TPA
          </Button>
        </Link>
      </PageHeader>

      <div className="mt-6">
        <TenantsTable />
      </div>
    </div>
  );
}
