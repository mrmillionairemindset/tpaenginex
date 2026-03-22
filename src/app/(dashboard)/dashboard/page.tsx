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

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${user.name || user.email.split('@')[0]}`}
      />

      <DashboardStats userRole={user.role || ''} />

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div>
          <UpcomingSchedule />
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
          <RecentActivity userRole={user.role || ''} />
        </div>
      </div>
    </div>
  );
}
