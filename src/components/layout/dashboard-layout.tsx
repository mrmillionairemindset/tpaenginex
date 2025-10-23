'use client';

import { useState } from 'react';
import { Header } from './header';
import { Sidebar } from './sidebar';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: React.ReactNode;
  user: {
    name: string | null;
    email: string;
    role: string;
    organization: {
      id: string;
      name: string;
      type: 'employer' | 'provider';
    } | null;
  };
}

export function DashboardLayout({ children, user }: DashboardLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      <Header user={user} onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)} />

      <div className="flex flex-1">
        {/* Desktop Sidebar */}
        <Sidebar userRole={user.role} className="hidden lg:flex" />

        {/* Mobile Sidebar */}
        {mobileMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <Sidebar
              userRole={user.role}
              className={cn(
                'fixed left-0 top-16 z-50 h-[calc(100vh-4rem)] lg:hidden',
                mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
              )}
            />
          </>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
