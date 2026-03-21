import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { EventsTable } from '@/components/events/events-table';

export default async function EventsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  const canView = user.role === 'tpa_admin' || user.role === 'tpa_staff' || user.role === 'platform_admin';
  if (!canView) {
    redirect('/dashboard');
  }

  return (
    <div>
      <PageHeader
        title="Service Events"
        description="Manage random pulls, post-accident, and reasonable suspicion events"
      >
        <Link href="/events/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Event
          </Button>
        </Link>
      </PageHeader>

      <div className="mt-6">
        <EventsTable />
      </div>
    </div>
  );
}
