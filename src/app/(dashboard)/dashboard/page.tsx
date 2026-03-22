import { getCurrentUser } from '@/auth/get-user';
import { PageHeader } from '@/components/ui/page-header';
import { DashboardStats } from '@/components/dashboard/dashboard-stats';
import { RecentActivity } from '@/components/dashboard/recent-activity';
import { UpcomingSchedule } from '@/components/dashboard/upcoming-schedule';

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const isTpaUser = user.role?.startsWith('tpa_') || user.role === 'platform_admin';

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${user.name || user.email.split('@')[0]}`}
      />

      <DashboardStats userRole={user.role || ''} />

      {isTpaUser && (
        <div className="mt-6 grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <UpcomingSchedule />
          </div>
          <div className="lg:col-span-2">
            <RecentActivity userRole={user.role || ''} />
          </div>
        </div>
      )}

      {!isTpaUser && (
        <div className="mt-6">
          <RecentActivity userRole={user.role || ''} />
        </div>
      )}
    </div>
  );
}
