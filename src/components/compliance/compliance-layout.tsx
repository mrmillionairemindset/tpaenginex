import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

interface ComplianceLayoutProps {
  children: React.ReactNode;
  title: string;
  lastUpdated: string;
  description?: string;
}

export function ComplianceLayout({
  children,
  title,
  lastUpdated,
  description,
}: ComplianceLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b bg-white">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            {title}
          </h1>
          {description && (
            <p className="mt-2 text-lg text-gray-600">{description}</p>
          )}
          <p className="mt-4 text-sm text-gray-500">
            Last Updated: {lastUpdated}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-lg border bg-white p-8 shadow-sm">
          <div className="prose prose-gray max-w-none">{children}</div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t bg-white">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
          <Separator className="mb-6" />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-500">
              © {new Date().getFullYear()} Worksafe Now Platform. All rights reserved.
            </p>
            <div className="flex gap-4">
              <Link href="/privacy" className="text-sm text-gray-600 hover:text-gray-900">
                Privacy
              </Link>
              <Link href="/terms" className="text-sm text-gray-600 hover:text-gray-900">
                Terms
              </Link>
              <Link href="/hipaa" className="text-sm text-gray-600 hover:text-gray-900">
                HIPAA
              </Link>
              <Link href="/baa" className="text-sm text-gray-600 hover:text-gray-900">
                BAA
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
