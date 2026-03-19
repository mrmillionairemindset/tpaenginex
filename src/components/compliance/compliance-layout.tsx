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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          {description && (
            <p className="mt-2 text-lg text-muted-foreground">{description}</p>
          )}
          <p className="mt-4 text-sm text-muted-foreground">
            Last Updated: {lastUpdated}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-lg border bg-card p-8 shadow-sm">
          <div className="prose prose-gray max-w-none">{children}</div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t bg-card">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
          <Separator className="mb-6" />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} TPAEngineX. All rights reserved.
            </p>
            <div className="flex gap-4">
              <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground">
                Privacy
              </Link>
              <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground">
                Terms
              </Link>
              <Link href="/hipaa" className="text-sm text-muted-foreground hover:text-foreground">
                HIPAA
              </Link>
              <Link href="/baa" className="text-sm text-muted-foreground hover:text-foreground">
                BAA
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
