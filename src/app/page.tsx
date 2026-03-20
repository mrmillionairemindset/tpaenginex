import { auth } from '@/auth';
import { getCurrentUser } from '@/auth/get-user';
import Link from 'next/link';
import { UserNav } from '@/components/user-nav';
import { OrganizationSwitcher } from '@/components/organization-switcher';
import { Shield, Lock, FileText, Building2, Zap, Users, CalendarDays, DollarSign, UserCheck, BarChart3 } from 'lucide-react';

export default async function HomePage() {
  const session = await auth();
  const user = session ? await getCurrentUser() : null;
  const isAuthenticated = !!session?.user;

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <img src="/tpa-engine-x-logo.png" alt="TPAEngineX" className="h-8" />
            <span className="font-semibold text-lg">TPAEngine<span className="bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] bg-clip-text text-transparent">X</span></span>
          </Link>
          <div className="flex items-center gap-4">
            {!isAuthenticated ? (
              <>
                <Link href="/how-it-works" className="text-sm text-muted-foreground hover:text-foreground hidden sm:block">
                  How It Works
                </Link>
                <Link href="/hipaa" className="text-sm text-muted-foreground hover:text-foreground hidden sm:block">
                  Compliance
                </Link>
                <Link href="/auth/signin">
                  <button className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted">
                    Sign In
                  </button>
                </Link>
                <Link href="/auth/signup">
                  <button className="rounded-md bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity">
                    Get Started
                  </button>
                </Link>
              </>
            ) : (
              <>
                <Link href="/dashboard">
                  <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">
                    Dashboard
                  </button>
                </Link>
                {user?.organization && (
                  <OrganizationSwitcher currentOrg={user.organization} />
                )}
                <UserNav user={session.user} />
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
          <div className="mx-auto max-w-7xl px-4 py-24 sm:py-32 relative">
            <div className="text-center">
              <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
                Power Your TPA
                <br />
                <span className="bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] bg-clip-text text-transparent">Operations</span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
                TPAEngineX is the platform that powers remote operations, workflow coordination, and compliance infrastructure for TPAs.
              </p>
              <div className="mt-10 flex items-center justify-center gap-x-6">
                {!isAuthenticated ? (
                  <>
                    <Link href="/auth/signup">
                      <button className="rounded-md bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] px-8 py-3 text-base font-semibold text-white shadow-lg hover:opacity-90 transition-opacity">
                        Get Started
                      </button>
                    </Link>
                    <Link href="/how-it-works" className="text-sm font-semibold text-foreground hover:text-primary transition-colors">
                      See How It Works <span aria-hidden="true">&rarr;</span>
                    </Link>
                  </>
                ) : (
                  <Link href="/dashboard">
                    <button className="rounded-md bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] px-8 py-3 text-base font-semibold text-white shadow-lg hover:opacity-90 transition-opacity">
                      Go to Dashboard
                    </button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Trust Bar */}
        <section className="border-y border-border bg-card/50">
          <div className="mx-auto max-w-5xl px-4 py-6">
            <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <span>HIPAA-ready infrastructure</span>
              </div>
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" />
                <span>End-to-end encryption</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <span>BAA available</span>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <span>Built for TPAs</span>
              </div>
            </div>
          </div>
        </section>

        {/* What We Power */}
        <section className="py-20">
          <div className="mx-auto max-w-7xl px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold">Everything a TPA Needs</h2>
              <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
                Replace legacy systems with a platform built for how TPAs actually work.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { icon: CalendarDays, title: 'Order & Event Management', description: 'Create orders, manage batch events, track random pulls — all from one dashboard.' },
                { icon: UserCheck, title: 'Collector Dispatch', description: 'Assign mobile PRN collectors with certifications, service areas, and availability tracking.' },
                { icon: Zap, title: 'Automated Workflows', description: '48-hour reminders, kit mailing alerts, pending result follow-ups — all fire automatically.' },
                { icon: BarChart3, title: 'Client Portal', description: 'Clients view their own orders and results. No calls asking for status updates.' },
                { icon: DollarSign, title: 'Billing Queue', description: 'Invoices auto-create when orders complete. Track pending, sent, paid, and overdue.' },
                { icon: Users, title: 'CRM Pipeline', description: 'Track prospective clients from lead to signed contract with a built-in pipeline.' },
              ].map((feature) => {
                const Icon = feature.icon;
                return (
                  <div key={feature.title} className="rounded-xl border border-border bg-card p-6 hover:border-primary/30 transition-colors">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 mb-4">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-base font-semibold mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Workflow Preview */}
        <section className="py-20 border-t border-border">
          <div className="mx-auto max-w-5xl px-4 text-center">
            <h2 className="text-3xl font-bold mb-4">From Intake to Invoice</h2>
            <p className="text-muted-foreground mb-12 max-w-2xl mx-auto">
              Every step connected, tracked, and automated.
            </p>
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              {['Order Intake', 'Scheduling', 'Collection', 'Results', 'Billing'].map((step, i) => (
                <div key={step} className="flex items-center gap-4">
                  <div className="flex flex-col items-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] text-white font-bold text-lg">
                      {i + 1}
                    </div>
                    <span className="mt-2 text-sm font-medium">{step}</span>
                  </div>
                  {i < 4 && (
                    <div className="hidden md:block w-12 h-0.5 bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6]" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 border-t border-border">
          <div className="mx-auto max-w-4xl px-4 text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to modernize your TPA?</h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              Replace legacy systems with a platform built for mobile collectors, batch events, and automated compliance.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link href="/auth/signup">
                <button className="rounded-md bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] px-8 py-3 text-base font-semibold text-white shadow-lg hover:opacity-90 transition-opacity">
                  Get Started
                </button>
              </Link>
              <Link href="/contact">
                <button className="rounded-md border border-border px-8 py-3 text-base font-semibold hover:bg-muted transition-colors">
                  Book a Demo
                </button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-10">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-4">
              <img src="/tpa-engine-x-logo.png" alt="TPAEngineX" className="h-6" />
              <p className="text-sm text-muted-foreground">
                Built for HIPAA-regulated workflows &middot; BAA available
              </p>
            </div>
            <div className="flex gap-6">
              <Link href="/how-it-works" className="text-sm text-muted-foreground hover:text-foreground">
                How It Works
              </Link>
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
          <div className="mt-6 text-center md:text-left">
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} TPAEngineX, Inc. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
