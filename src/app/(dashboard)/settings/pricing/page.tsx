import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { PricingSettingsForm } from '@/components/settings/pricing-settings-form';

export default async function PricingSettingsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  if (user.role !== 'tpa_admin') {
    redirect('/dashboard');
  }

  return (
    <div>
      <PageHeader
        title="Pricing"
        description="Configure service rates and billing defaults for auto-generated invoices"
      />

      <div className="mt-6 max-w-2xl">
        <PricingSettingsForm />
      </div>
    </div>
  );
}
