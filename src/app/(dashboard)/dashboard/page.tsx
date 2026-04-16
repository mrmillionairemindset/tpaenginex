import { getCurrentUser } from '@/auth/get-user';
import { getEnabledModules } from '@/auth/rbac';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { DashboardStats } from '@/components/dashboard/dashboard-stats';
import { RecentActivity } from '@/components/dashboard/recent-activity';
import { UpcomingSchedule } from '@/components/dashboard/upcoming-schedule';
import { OrderVolumeChart } from '@/components/dashboard/order-volume-chart';
import { ComplianceDistributionChart } from '@/components/dashboard/compliance-distribution-chart';

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const isTpaUser = user.role?.startsWith('tpa_') || user.role === 'platform_admin';
  const enabledModules = await getEnabledModules(user.tpaOrgId);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${user.name || user.email.split('@')[0]}`}
      />

      <DashboardStats userRole={user.role || ''} enabledModules={enabledModules} />

      {isTpaUser && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-2">Order Volume (30 days)</h3>
            <OrderVolumeChart />
          </Card>
          {enabledModules?.includes('dqf') && (
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-2">Compliance Distribution</h3>
              <ComplianceDistributionChart />
            </Card>
          )}
        </div>
      )}

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
