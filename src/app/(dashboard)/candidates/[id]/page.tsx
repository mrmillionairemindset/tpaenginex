import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { CandidateDetails } from '@/components/candidates/candidate-details';

interface CandidatePageProps {
  params: {
    id: string;
  };
}

export default async function CandidatePage({ params }: CandidatePageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  // Only employers can view candidates
  if (!user.role?.startsWith('employer')) {
    redirect('/dashboard');
  }

  return (
    <div>
      <Link href="/candidates">
        <Button variant="ghost" size="sm" className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Candidates
        </Button>
      </Link>

      <CandidateDetails candidateId={params.id} />
    </div>
  );
}
