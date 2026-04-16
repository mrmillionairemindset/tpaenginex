import Link from 'next/link';
import { ClipboardList, CalendarCheck, UserCheck, FileCheck, DollarSign, Shield, Zap, BarChart3, Bell, MapPin } from 'lucide-react';

export const metadata = {
  title: 'How It Works | TPAEngineX',
  description: 'See how TPAEngineX powers TPA operations — from order intake to billing, every step connected and automated.',
};

const workflowSteps = [
  {
    step: '01',
    title: 'Order Intake',
    description: 'TPA staff creates orders on behalf of clients. Individual info, service type, DOT status, and priority are captured in one form.',
    icon: ClipboardList,
  },
  {
    step: '02',
    title: 'Scheduling & Assignment',
    description: 'Assign a mobile PRN collector to the order. 48-hour confirmation reminders fire automatically. Kit mailing alerts keep logistics on track.',
    icon: CalendarCheck,
  },
  {
    step: '03',
    title: 'Collection Execution',
    description: 'Collectors complete onsite or batch collections. Events track progress in real time — X done, Y pending — with daily follow-ups until all results are in.',
    icon: UserCheck,
  },
  {
    step: '04',
    title: 'Results & Delivery',
    description: 'TPA records staff uploads results and marks orders complete. Clients get automatic completion emails with next-step timelines.',
    icon: FileCheck,
  },
  {
    step: '05',
    title: 'Billing & Closeout',
    description: 'Invoices are auto-created when orders or events complete. Billing staff tracks pending, sent, paid, and overdue — all in one queue.',
    icon: DollarSign,
  },
];

const capabilities = [
  { title: 'Remote Operations', description: 'Dispatch mobile collectors to any job site. No fixed testing locations required.', icon: MapPin },
  { title: 'Workflow Automation', description: 'Background jobs handle reminders, follow-ups, and billing entries automatically.', icon: Zap },
  { title: 'Collector Coordination', description: 'Manage your PRN collector network — certifications, availability, and assignments.', icon: UserCheck },
  { title: 'Compliance Tracking', description: 'DOT vs Non-DOT flagging, chain of custody tracking, HIPAA-ready audit logs.', icon: Shield },
  { title: 'Real-Time Notifications', description: 'Email and in-app alerts at every status change — for your staff and your clients.', icon: Bell },
  { title: 'Client Portal', description: 'Clients see their own orders and results. No calls asking for updates.', icon: BarChart3 },
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <img src="/tpa-engine-x-logo.png" alt="TPAEngineX" className="h-8" />
            <span className="font-semibold text-lg">
              TPAEngine<span className="bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] bg-clip-text text-transparent">X</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/auth/signin">
              <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                Sign In
              </button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            How TPAEngine<span className="bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] bg-clip-text text-transparent">X</span> Powers Your Operation
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            From order intake to billing, every step is connected, tracked, and automated in one platform.
          </p>
        </div>
      </section>

      {/* 5-Stage Workflow */}
      <section className="py-16 border-t border-border">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-2xl font-bold mb-16">The 5-Stage Workflow</h2>

          <div className="relative">
            {/* Connection line */}
            <div className="absolute top-12 left-0 right-0 h-0.5 bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] hidden lg:block" />

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-8">
              {workflowSteps.map((step) => {
                const Icon = step.icon;
                return (
                  <div key={step.step} className="relative text-center">
                    <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-2xl bg-card border border-border mb-6 relative z-10">
                      <Icon className="h-10 w-10 text-primary" />
                    </div>
                    <div className="text-xs font-bold text-primary mb-2">{step.step}</div>
                    <h3 className="text-base font-semibold mb-2">{step.title}</h3>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* What You Power */}
      <section className="py-16 border-t border-border">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-2xl font-bold mb-4">What We Power</h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Everything a TPA needs to run remote drug testing operations — without the legacy software.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {capabilities.map((cap) => {
              const Icon = cap.icon;
              return (
                <div key={cap.title} className="rounded-xl border border-border bg-card p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 mb-4">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-base font-semibold mb-2">{cap.title}</h3>
                  <p className="text-sm text-muted-foreground">{cap.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Dashboard Preview */}
      <section className="py-16 border-t border-border">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h2 className="text-2xl font-bold mb-4">Your Command Center</h2>
          <p className="text-muted-foreground mb-10 max-w-2xl mx-auto">
            One dashboard showing open orders, upcoming events, pending results, billing queue, active collectors, and pipeline leads — all scoped to your TPA.
          </p>
          <div className="rounded-xl border border-border bg-card p-8">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { label: 'Open Orders', value: '24' },
                { label: 'Events This Week', value: '3' },
                { label: 'Pending Results', value: '7' },
                { label: 'Billing Queue', value: '12' },
                { label: 'Active Collectors', value: '8' },
                { label: 'Open Leads', value: '15' },
              ].map((stat) => (
                <div key={stat.label} className="rounded-lg bg-secondary p-4">
                  <p className="text-2xl font-bold text-primary">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t border-border">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to modernize your TPA?</h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Replace legacy systems with a platform built for how TPAs actually work — mobile collectors, batch events, and automated compliance.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/auth/signup">
              <button className="rounded-md bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] px-8 py-3 text-base font-semibold text-white shadow-sm hover:opacity-90 transition-opacity">
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

      {/* Footer */}
      <footer className="border-t border-border bg-secondary py-8">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} TPAEngineX. HIPAA Compliant.
            </p>
            <div className="flex gap-6">
              <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground">Privacy</Link>
              <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground">Terms</Link>
              <Link href="/hipaa" className="text-sm text-muted-foreground hover:text-foreground">HIPAA</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
