import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { ResultsUpload } from '@/components/results/results-upload';

interface ResultsPageProps {
  params: {
    id: string;
  };
}

export default async function ResultsUploadPage({ params }: ResultsPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  // Only providers can upload results
  if (!user.role?.startsWith('tpa_') && user.role !== 'platform_admin') {
    redirect('/dashboard');
  }

  return (
    <div>
      <Link href="/results">
        <Button variant="ghost" size="sm" className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Results
        </Button>
      </Link>

      <ResultsUpload orderId={params.id} />
    </div>
  );
}
