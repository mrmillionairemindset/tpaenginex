import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { CollectorsTable } from '@/components/collectors/collectors-table';

export default async function CollectorsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  const canManage = user.role === 'tpa_admin' || user.role === 'tpa_staff' || user.role === 'platform_admin';
  if (!canManage) {
    redirect('/dashboard');
  }

  return (
    <div>
      <PageHeader
        title="Collectors"
        description="Manage your mobile PRN collectors"
      >
        {user.role === 'tpa_admin' && (
          <Link href="/collectors/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Collector
            </Button>
          </Link>
        )}
      </PageHeader>

      <div className="mt-6">
        <CollectorsTable />
      </div>
    </div>
  );
}
