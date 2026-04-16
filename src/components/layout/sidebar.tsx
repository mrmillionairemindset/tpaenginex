'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FileText,
  Users,
  Settings,
  Building2,
  Plus,
  ChevronDown,
  ChevronRight,
  UserCheck,
  CalendarDays,
  DollarSign,
  Target,
  Mail,
  ClipboardList,
  Shield,
  Clock,
  Bell,
  User,
  KeyRound,
  Webhook,
  BarChart3,
  Shuffle,
  Stethoscope,
  Wind,
  Syringe,
  ShieldAlert,
  FileSearch,
  HeartPulse,
  BookMarked,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: string[]; // Which roles can see this
  moduleKey?: string; // If set, only shown when this module is enabled
  children?: NavItem[]; // Nested items
}

// TPA staff navigation (tpa_admin, tpa_staff, tpa_records, tpa_billing)
const tpaNav: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: ['tpa_admin', 'tpa_staff', 'tpa_records', 'tpa_billing'],
  },
  {
    label: 'Schedule',
    href: '/schedule',
    icon: Clock,
    roles: ['tpa_admin', 'tpa_staff', 'tpa_records'],
    moduleKey: 'drug_testing',
  },
  {
    label: 'Orders',
    href: '/orders',
    icon: FileText,
    roles: ['tpa_admin', 'tpa_staff', 'tpa_records', 'tpa_billing'],
    moduleKey: 'drug_testing',
  },
  {
    label: 'Events',
    href: '/events',
    icon: CalendarDays,
    roles: ['tpa_admin', 'tpa_staff'],
    moduleKey: 'drug_testing',
  },
  {
    label: 'Random Programs',
    href: '/random/programs',
    icon: Shuffle,
    roles: ['tpa_admin', 'tpa_staff', 'tpa_records'],
    moduleKey: 'drug_testing',
    children: [
      {
        label: 'All Pools',
        href: '/random/pools',
        icon: Shuffle,
        roles: ['tpa_admin', 'tpa_staff', 'tpa_records'],
      },
    ],
  },
  {
    label: 'Persons',
    href: '/candidates',
    icon: Users,
    roles: ['tpa_admin', 'tpa_staff', 'tpa_records'],
    moduleKey: 'drug_testing',
  },
  {
    label: 'Collectors',
    href: '/collectors',
    icon: UserCheck,
    roles: ['tpa_admin', 'tpa_staff'],
    moduleKey: 'drug_testing',
  },
  {
    label: 'Clients',
    href: '/clients',
    icon: Building2,
    roles: ['tpa_admin', 'tpa_staff'],
  },
  {
    label: 'Billing',
    href: '/billing',
    icon: DollarSign,
    roles: ['tpa_admin', 'tpa_billing'],
    moduleKey: 'drug_testing',
  },
  {
    label: 'Reports',
    href: '/reports/dot-compliance',
    icon: FileText,
    roles: ['tpa_admin', 'tpa_records'],
    moduleKey: 'drug_testing',
  },
  {
    label: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
    roles: ['tpa_admin', 'tpa_staff', 'tpa_records'],
  },
  {
    label: 'Leads & Pipeline',
    href: '/leads',
    icon: Target,
    roles: ['tpa_admin', 'tpa_staff'],
    moduleKey: 'drug_testing',
    children: [
      {
        label: 'Lead Templates',
        href: '/settings/lead-templates',
        icon: Mail,
        roles: ['tpa_admin'],
      },
    ],
  },
  {
    label: 'Service Requests',
    href: '/service-requests',
    icon: ClipboardList,
    roles: ['tpa_admin', 'tpa_staff'],
    moduleKey: 'drug_testing',
  },
  {
    label: 'Physicals',
    href: '/occ/physicals',
    icon: Stethoscope,
    roles: ['tpa_admin', 'tpa_staff', 'tpa_records'],
    moduleKey: 'occupational_health',
  },
  {
    label: 'BAT Tests',
    href: '/occ/bat-tests',
    icon: Wind,
    roles: ['tpa_admin', 'tpa_staff', 'tpa_records'],
    moduleKey: 'occupational_health',
  },
  {
    label: 'Vaccinations',
    href: '/occ/vaccinations',
    icon: Syringe,
    roles: ['tpa_admin', 'tpa_staff', 'tpa_records'],
    moduleKey: 'occupational_health',
  },
  {
    label: 'Fit Tests',
    href: '/occ/fit-tests',
    icon: ShieldAlert,
    roles: ['tpa_admin', 'tpa_staff', 'tpa_records'],
    moduleKey: 'occupational_health',
  },
  {
    label: 'DQF Drivers',
    href: '/dqf/drivers',
    icon: Users,
    roles: ['tpa_admin', 'tpa_staff', 'tpa_records'],
    moduleKey: 'dqf',
  },
  {
    label: 'Applications',
    href: '/dqf/applications',
    icon: ClipboardList,
    roles: ['tpa_admin', 'tpa_staff'],
    moduleKey: 'dqf',
  },
  {
    label: 'Annual Reviews',
    href: '/dqf/reviews',
    icon: CalendarDays,
    roles: ['tpa_admin', 'tpa_staff', 'tpa_records'],
    moduleKey: 'dqf',
  },
  {
    label: 'Checklists',
    href: '/dqf/checklists',
    icon: ClipboardList,
    roles: ['tpa_admin'],
    moduleKey: 'dqf',
  },
  {
    label: 'Compliance',
    href: '/dqf/compliance',
    icon: Shield,
    roles: ['tpa_admin', 'tpa_staff', 'tpa_records'],
    moduleKey: 'dqf',
  },
  {
    label: 'Ticket Forms',
    href: '/dqf/tickets',
    icon: FileText,
    roles: ['tpa_admin', 'tpa_staff'],
    moduleKey: 'dqf',
  },
  {
    label: 'Background Checks',
    href: '/background/checks',
    icon: FileSearch,
    roles: ['tpa_admin', 'tpa_staff', 'tpa_records'],
    moduleKey: 'background_screening',
  },
  {
    label: 'Injuries',
    href: '/injury/incidents',
    icon: HeartPulse,
    roles: ['tpa_admin', 'tpa_staff', 'tpa_records'],
    moduleKey: 'injury_care',
  },
  {
    label: 'OSHA 300 Log',
    href: '/injury/osha-300',
    icon: BookMarked,
    roles: ['tpa_admin', 'tpa_staff', 'tpa_records'],
    moduleKey: 'injury_care',
  },
  {
    label: 'BG Packages',
    href: '/background/packages',
    icon: ClipboardList,
    roles: ['tpa_admin'],
    moduleKey: 'background_screening',
  },
  {
    label: 'Notifications',
    href: '/settings/notifications',
    icon: Bell,
    roles: ['tpa_admin', 'tpa_staff', 'tpa_records', 'tpa_billing'],
  },
  {
    label: 'Security',
    href: '/settings/security',
    icon: Shield,
    roles: ['tpa_admin', 'tpa_staff', 'tpa_records', 'tpa_billing'],
  },
  {
    label: 'Account',
    href: '/settings/account',
    icon: User,
    roles: ['tpa_admin', 'tpa_staff', 'tpa_records', 'tpa_billing'],
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
    roles: ['tpa_admin'],
    children: [
      {
        label: 'Organization',
        href: '/settings/organization',
        icon: Building2,
        roles: ['tpa_admin'],
      },
      {
        label: 'Automations',
        href: '/settings/automations',
        icon: Settings,
        roles: ['tpa_admin'],
      },
      {
        label: 'Pricing',
        href: '/settings/pricing',
        icon: DollarSign,
        roles: ['tpa_admin'],
      },
      {
        label: 'DQF Settings',
        href: '/settings/dqf',
        icon: Settings,
        roles: ['tpa_admin'],
        moduleKey: 'dqf',
      },
      {
        label: 'Background Screening',
        href: '/background/settings',
        icon: FileSearch,
        roles: ['tpa_admin'],
        moduleKey: 'background_screening',
      },
      {
        label: 'Email Templates',
        href: '/settings/email-templates',
        icon: Mail,
        roles: ['tpa_admin'],
      },
      {
        label: 'Audit Logs',
        href: '/settings/audit-logs',
        icon: Shield,
        roles: ['tpa_admin'],
      },
      {
        label: 'API Keys',
        href: '/settings/api-keys',
        icon: KeyRound,
        roles: ['tpa_admin'],
      },
      {
        label: 'SSO',
        href: '/settings/sso',
        icon: Shield,
        roles: ['tpa_admin'],
      },
      {
        label: 'Webhooks',
        href: '/settings/webhooks',
        icon: Webhook,
        roles: ['tpa_admin'],
      },
    ],
  },
];

// Platform admin navigation
const platformNav: NavItem[] = [
  {
    label: 'Platform Dashboard',
    href: '/platform',
    icon: Shield,
    roles: ['platform_admin'],
  },
  {
    label: 'TPA Accounts',
    href: '/platform/tenants',
    icon: Building2,
    roles: ['platform_admin'],
    children: [
      {
        label: 'New TPA',
        href: '/platform/tenants/new',
        icon: Plus,
        roles: ['platform_admin'],
      },
    ],
  },
  {
    label: 'Notifications',
    href: '/settings/notifications',
    icon: Bell,
    roles: ['platform_admin'],
  },
  {
    label: 'Security',
    href: '/settings/security',
    icon: Shield,
    roles: ['platform_admin'],
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
    roles: ['platform_admin'],
  },
];

// Client portal navigation (client_admin)
const clientNav: NavItem[] = [
  {
    label: 'My Orders',
    href: '/client-portal/orders',
    icon: FileText,
    roles: ['client_admin'],
    moduleKey: 'drug_testing',
  },
  {
    label: 'Request Service',
    href: '/client-portal/request',
    icon: Plus,
    roles: ['client_admin'],
    moduleKey: 'drug_testing',
  },
  {
    label: 'My Requests',
    href: '/client-portal/requests',
    icon: ClipboardList,
    roles: ['client_admin'],
    moduleKey: 'drug_testing',
  },
  {
    label: 'Results',
    href: '/client-portal/results',
    icon: FileText,
    roles: ['client_admin'],
    moduleKey: 'drug_testing',
  },
  {
    label: 'Documents',
    href: '/client-portal/documents',
    icon: FileText,
    roles: ['client_admin'],
  },
  {
    label: 'Drivers',
    href: '/client-portal/dqf/drivers',
    icon: Users,
    roles: ['client_admin'],
    moduleKey: 'dqf',
  },
  {
    label: 'Compliance',
    href: '/client-portal/dqf/compliance',
    icon: Shield,
    roles: ['client_admin'],
    moduleKey: 'dqf',
  },
  {
    label: 'Submit Application',
    href: '/client-portal/dqf/submit-application',
    icon: Plus,
    roles: ['client_admin'],
    moduleKey: 'dqf',
  },
  {
    label: 'Background Checks',
    href: '/client-portal/background',
    icon: FileSearch,
    roles: ['client_admin'],
    moduleKey: 'background_screening',
  },
  {
    label: 'Notifications',
    href: '/settings/notifications',
    icon: Bell,
    roles: ['client_admin'],
  },
  {
    label: 'Security',
    href: '/settings/security',
    icon: Shield,
    roles: ['client_admin'],
  },
];

// Collector portal navigation
const collectorNav: NavItem[] = [
  {
    label: 'My Assignments',
    href: '/collector-portal',
    icon: ClipboardList,
    roles: ['collector'],
  },
  {
    label: 'My Schedule',
    href: '/collector-portal/schedule',
    icon: CalendarDays,
    roles: ['collector'],
  },
  {
    label: 'My Documents',
    href: '/collector-portal/documents',
    icon: FileText,
    roles: ['collector'],
  },
  {
    label: 'Notifications',
    href: '/settings/notifications',
    icon: Bell,
    roles: ['collector'],
  },
  {
    label: 'Security',
    href: '/settings/security',
    icon: Shield,
    roles: ['collector'],
  },
];

interface SidebarProps {
  userRole: string;
  enabledModules?: string[]; // Module IDs enabled for this tenant
  className?: string;
}

export function Sidebar({ userRole, enabledModules, className }: SidebarProps) {
  const pathname = usePathname();
  const isPlatformAdmin = userRole === 'platform_admin';
  const isCollector = userRole === 'collector';
  const isTpaUser = userRole.startsWith('tpa_');
  const navItems = isPlatformAdmin ? platformNav : isCollector ? collectorNav : isTpaUser ? tpaNav : clientNav;

  const filteredNav = navItems.filter((item) => {
    // Check role access
    if (!item.roles.includes(userRole)) return false;
    // Check module access (if item belongs to a module)
    if (item.moduleKey && enabledModules && !enabledModules.includes(item.moduleKey)) return false;
    return true;
  });

  // Track which nav items are expanded
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>(() => {
    // Auto-expand items that have active children
    const initialState: Record<string, boolean> = {};
    filteredNav.forEach((item) => {
      if (item.children) {
        const hasActiveChild = item.children.some((child) => pathname === child.href);
        initialState[item.href] = hasActiveChild;
      }
    });
    return initialState;
  });

  const toggleExpand = (href: string) => {
    setExpandedItems((prev) => ({
      ...prev,
      [href]: !prev[href],
    }));
  };

  return (
    <aside
      className={cn(
        'flex w-64 flex-col border-r bg-muted/40',
        className
      )}
    >
      <nav className="flex-1 space-y-1 p-4">
        {filteredNav.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          const hasChildren = item.children && item.children.length > 0;
          const filteredChildren = hasChildren
            ? item.children!.filter((child) => child.roles.includes(userRole))
            : [];
          const isExpanded = expandedItems[item.href] ?? false;
          const hasActiveChild = filteredChildren.some((child) => pathname === child.href);

          return (
            <div key={item.href}>
              <div className="flex items-center">
                <Link
                  href={item.href}
                  className={cn(
                    'flex flex-1 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive && !hasActiveChild
                      ? 'bg-primary text-white'
                      : 'text-foreground hover:bg-muted'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
                {filteredChildren.length > 0 && (
                  <button
                    onClick={() => toggleExpand(item.href)}
                    className="p-2 hover:bg-muted rounded transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                )}
              </div>
              {filteredChildren.length > 0 && isExpanded && (
                <div className="ml-6 mt-1 space-y-1">
                  {filteredChildren.map((child) => {
                    const ChildIcon = child.icon;
                    const isChildActive = pathname === child.href;

                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors',
                          isChildActive
                            ? 'bg-primary text-white'
                            : 'text-muted-foreground hover:bg-muted'
                        )}
                      >
                        <ChildIcon className="h-4 w-4" />
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
