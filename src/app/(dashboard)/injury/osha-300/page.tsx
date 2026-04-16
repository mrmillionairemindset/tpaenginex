import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { Osha300Downloader } from '@/components/injury/osha-300-downloader';

export default async function Osha300Page() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/signin');
  if (!user.role?.startsWith('tpa_') && user.role !== 'platform_admin') {
    redirect('/dashboard');
  }

  return (
    <div>
      <PageHeader
        title="OSHA 300 Log"
        description="Download the annual Log of Work-Related Injuries and Illnesses (29 CFR 1904)."
      />
      <div className="mt-6">
        <Osha300Downloader />
      </div>
    </div>
  );
}
