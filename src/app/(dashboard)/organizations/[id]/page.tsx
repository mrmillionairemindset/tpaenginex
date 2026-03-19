import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { OrganizationDetails } from '@/components/organizations/organization-details';

interface OrganizationPageProps {
  params: {
    id: string;
  };
}

export default async function OrganizationPage({ params }: OrganizationPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  // Only providers can view organization details
  if (!user.role?.startsWith('tpa_') && user.role !== 'platform_admin') {
    redirect('/dashboard');
  }

  return (
    <div>
      <OrganizationDetails organizationId={params.id} />
    </div>
  );
}
