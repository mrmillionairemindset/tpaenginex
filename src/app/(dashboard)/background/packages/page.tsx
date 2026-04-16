import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { PackagesTable } from '@/components/background/packages-table';

export default async function BackgroundPackagesPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signin');
  if (user.role !== 'tpa_admin' && user.role !== 'platform_admin') redirect('/background/checks');

  return (
    <div>
      <PageHeader
        title="Background Check Packages"
        description="Define the packages you resell to clients. Each maps to a Checkr package slug and sets the retail price."
      />
      <div className="mt-6">
        <PackagesTable />
      </div>
    </div>
  );
}
