'use client';

import { useState } from 'react';
import { Header } from './header';
import { Sidebar } from './sidebar';
import { BrandingProvider, type BrandingConfig } from './branding-provider';
import { UnverifiedEmailBanner } from './unverified-email-banner';
import { ImpersonationBanner } from './impersonation-banner';
import { CommandPalette } from '@/components/command-palette';
import { SessionTimeoutMonitor } from '@/components/session-timeout-monitor';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: React.ReactNode;
  user: {
    id: string;
    name: string | null;
    email: string;
    role: string | null;
    organization: {
      id: string;
      name: string;
      type: 'platform' | 'tpa' | 'client';
      slug: string;
    } | null;
  };
  enabledModules?: string[];
  branding?: BrandingConfig;
  emailVerified?: boolean;
  impersonation?: {
    targetName: string | null;
    targetEmail: string;
    actualEmail: string | null;
  } | null;
}

export function DashboardLayout({ children, user, enabledModules, branding, emailVerified = true, impersonation = null }: DashboardLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const brandingConfig = branding || { brandName: null, logoUrl: null, faviconUrl: null, primaryColor: null };

  return (
    <BrandingProvider branding={brandingConfig}>
    <div className="flex min-h-screen flex-col">
      <SessionTimeoutMonitor />
      <CommandPalette userRole={user.role || ''} enabledModules={enabledModules} />
      {impersonation && <ImpersonationBanner impersonation={impersonation} />}
      {!emailVerified && <UnverifiedEmailBanner />}
      <Header user={user} onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)} />

      <div className="flex flex-1">
        {/* Desktop Sidebar */}
        <Sidebar userRole={user.role || ''} enabledModules={enabledModules} className="hidden lg:flex" />

        {/* Mobile Sidebar */}
        {mobileMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <Sidebar
              userRole={user.role || ''}
              enabledModules={enabledModules}
              className={cn(
                'fixed left-0 top-16 z-50 h-[calc(100vh-4rem)] lg:hidden',
                mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
              )}
            />
          </>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-muted">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
    </BrandingProvider>
  );
}
