'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FileText,
  Users,
  MapPin,
  Settings,
  FileCheck,
  Building2,
  Plus,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: string[]; // Which roles can see this
  children?: NavItem[]; // Nested items
}

const employerNav: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: ['employer_admin', 'employer_user'],
  },
  {
    label: 'Orders',
    href: '/orders',
    icon: FileText,
    roles: ['employer_admin', 'employer_user'],
    children: [
      {
        label: 'New Order',
        href: '/orders/new',
        icon: Plus,
        roles: ['employer_admin', 'employer_user'],
      },
    ],
  },
  {
    label: 'Candidates',
    href: '/candidates',
    icon: Users,
    roles: ['employer_admin', 'employer_user'],
  },
];

const providerNav: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: ['provider_admin', 'provider_agent'],
  },
  {
    label: 'Orders',
    href: '/orders',
    icon: FileText,
    roles: ['provider_admin', 'provider_agent'],
  },
  {
    label: 'Sites',
    href: '/sites',
    icon: MapPin,
    roles: ['provider_admin'],
  },
  {
    label: 'Organizations',
    href: '/organizations',
    icon: Building2,
    roles: ['provider_admin'],
  },
  {
    label: 'Results',
    href: '/results',
    icon: FileCheck,
    roles: ['provider_admin', 'provider_agent'],
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
    roles: ['provider_admin'],
  },
];

interface SidebarProps {
  userRole: string;
  className?: string;
}

export function Sidebar({ userRole, className }: SidebarProps) {
  const pathname = usePathname();
  const isProvider = userRole.startsWith('provider');
  const navItems = isProvider ? providerNav : employerNav;

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
        'flex w-64 flex-col border-r bg-gray-50/40',
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
                      : 'text-gray-700 hover:bg-gray-100'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
                {filteredChildren.length > 0 && (
                  <button
                    onClick={() => toggleExpand(item.href)}
                    className="p-2 hover:bg-gray-100 rounded transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-gray-600" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-600" />
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
                            : 'text-gray-600 hover:bg-gray-100'
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
