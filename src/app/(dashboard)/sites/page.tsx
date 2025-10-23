import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { SitesTable } from '@/components/sites/sites-table';

export default async function SitesPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  // Only providers can manage sites
  if (!user.role?.startsWith('provider')) {
    redirect('/dashboard');
  }

  const isAdmin = user.role === 'provider_admin';

  return (
    <div>
      <PageHeader
        title="Testing Sites"
        description="Manage screening and testing site locations"
      >
        {isAdmin && (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Site
          </Button>
        )}
      </PageHeader>

      <div className="mt-6">
        <SitesTable userRole={user.role} />
      </div>
    </div>
  );
}
