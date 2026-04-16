import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { AnalyticsView } from '@/components/analytics/analytics-view';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  const hasAccess =
    user.role === 'tpa_admin' ||
    user.role === 'tpa_staff' ||
    user.role === 'tpa_records' ||
    user.role === 'platform_admin';

  if (!hasAccess) {
    redirect('/dashboard');
  }

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="API request volume and webhook delivery health for your TPA."
      />

      <div className="mt-6">
        <AnalyticsView />
      </div>
    </div>
  );
}
