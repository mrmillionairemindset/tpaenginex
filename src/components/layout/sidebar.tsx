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
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: string[]; // Which roles can see this
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
    label: 'Orders',
    href: '/orders',
    icon: FileText,
    roles: ['tpa_admin', 'tpa_staff', 'tpa_records', 'tpa_billing'],
  },
  {
    label: 'Events',
    href: '/events',
    icon: CalendarDays,
    roles: ['tpa_admin', 'tpa_staff'],
  },
  {
    label: 'Candidates',
    href: '/candidates',
    icon: Users,
    roles: ['tpa_admin', 'tpa_staff', 'tpa_records'],
  },
  {
    label: 'Collectors',
    href: '/collectors',
    icon: UserCheck,
    roles: ['tpa_admin', 'tpa_staff'],
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
  },
  {
    label: 'Leads & Pipeline',
    href: '/leads',
    icon: Target,
    roles: ['tpa_admin', 'tpa_staff'],
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
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
    roles: ['tpa_admin'],
    children: [
      {
        label: 'TPA Settings',
        href: '/settings/tpa',
        icon: Building2,
        roles: ['tpa_admin'],
      },
      {
        label: 'Automations',
        href: '/settings/automations',
        icon: Settings,
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
  },
  {
    label: 'Request Service',
    href: '/client-portal/request',
    icon: Plus,
    roles: ['client_admin'],
  },
  {
    label: 'My Requests',
    href: '/client-portal/requests',
    icon: ClipboardList,
    roles: ['client_admin'],
  },
  {
    label: 'Results',
    href: '/client-portal/results',
    icon: FileText,
    roles: ['client_admin'],
  },
  {
    label: 'Documents',
    href: '/client-portal/documents',
    icon: FileText,
    roles: ['client_admin'],
  },
];

interface SidebarProps {
  userRole: string;
  className?: string;
}

export function Sidebar({ userRole, className }: SidebarProps) {
  const pathname = usePathname();
  const isPlatformAdmin = userRole === 'platform_admin';
  const isTpaUser = userRole.startsWith('tpa_');
  const navItems = isPlatformAdmin ? platformNav : isTpaUser ? tpaNav : clientNav;

  const filteredNav = navItems.filter((item) => item.roles.includes(userRole));

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
            ? item.children.filter((child) => child.roles.includes(userRole))
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
