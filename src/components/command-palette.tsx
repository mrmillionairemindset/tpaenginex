'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  Users,
  Building2,
  CalendarDays,
  DollarSign,
  Target,
  UserCheck,
  ClipboardList,
  Shield,
  Settings,
  Plus,
  Search,
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface CommandItem {
  id: string;
  label: string;
  icon: React.ElementType;
  href?: string;
  action?: () => void;
  group: 'Navigation' | 'Quick Actions' | 'Persons' | 'Orders' | 'Drivers';
  shortcut?: string;
  roles?: string[];
  moduleKey?: string;
}

interface CommandPaletteProps {
  userRole: string;
  enabledModules?: string[];
}

const BASE_ITEMS: CommandItem[] = [
  // Navigation
  { id: 'nav-dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard', group: 'Navigation', roles: ['tpa_admin', 'tpa_staff', 'tpa_records', 'tpa_billing'] },
  { id: 'nav-orders', label: 'Orders', icon: FileText, href: '/orders', group: 'Navigation', roles: ['tpa_admin', 'tpa_staff', 'tpa_records', 'tpa_billing'], moduleKey: 'drug_testing' },
  { id: 'nav-events', label: 'Events', icon: CalendarDays, href: '/events', group: 'Navigation', roles: ['tpa_admin', 'tpa_staff'], moduleKey: 'drug_testing' },
  { id: 'nav-persons', label: 'Persons', icon: Users, href: '/candidates', group: 'Navigation', roles: ['tpa_admin', 'tpa_staff', 'tpa_records'], moduleKey: 'drug_testing' },
  { id: 'nav-collectors', label: 'Collectors', icon: UserCheck, href: '/collectors', group: 'Navigation', roles: ['tpa_admin', 'tpa_staff'], moduleKey: 'drug_testing' },
  { id: 'nav-clients', label: 'Clients', icon: Building2, href: '/clients', group: 'Navigation', roles: ['tpa_admin', 'tpa_staff'] },
  { id: 'nav-billing', label: 'Billing', icon: DollarSign, href: '/billing', group: 'Navigation', roles: ['tpa_admin', 'tpa_billing'], moduleKey: 'drug_testing' },
  { id: 'nav-leads', label: 'Leads', icon: Target, href: '/leads', group: 'Navigation', roles: ['tpa_admin', 'tpa_staff'], moduleKey: 'drug_testing' },
  { id: 'nav-dqf-drivers', label: 'DQF Drivers', icon: Users, href: '/dqf/drivers', group: 'Navigation', roles: ['tpa_admin', 'tpa_staff', 'tpa_records'], moduleKey: 'dqf' },
  { id: 'nav-dqf-applications', label: 'DQF Applications', icon: ClipboardList, href: '/dqf/applications', group: 'Navigation', roles: ['tpa_admin', 'tpa_staff'], moduleKey: 'dqf' },
  { id: 'nav-reports', label: 'Reports', icon: FileText, href: '/reports/dot-compliance', group: 'Navigation', roles: ['tpa_admin', 'tpa_records'], moduleKey: 'drug_testing' },
  { id: 'nav-settings', label: 'Settings', icon: Settings, href: '/settings/organization', group: 'Navigation', roles: ['tpa_admin', 'platform_admin'] },

  // Quick Actions
  { id: 'action-create-order', label: 'Create Order', icon: Plus, href: '/orders/new', group: 'Quick Actions', roles: ['tpa_admin', 'tpa_staff'], moduleKey: 'drug_testing' },
  { id: 'action-create-lead', label: 'Create Lead', icon: Plus, href: '/leads/new', group: 'Quick Actions', roles: ['tpa_admin', 'tpa_staff'], moduleKey: 'drug_testing' },
  { id: 'action-create-client', label: 'Create Client', icon: Plus, href: '/clients/new', group: 'Quick Actions', roles: ['tpa_admin'] },
  { id: 'action-schedule-review', label: 'Schedule Review', icon: Plus, href: '/dqf/reviews', group: 'Quick Actions', roles: ['tpa_admin', 'tpa_staff'], moduleKey: 'dqf' },
];

interface SearchResults {
  persons: Array<{ id: string; firstName: string; lastName: string; email: string; personType: string }>;
  orders: Array<{ id: string; orderNumber: string; status: string; jobsiteLocation: string }>;
  drivers: Array<{ id: string; firstName: string; lastName: string; email: string }>;
}

export function CommandPalette({ userRole, enabledModules = [] }: CommandPaletteProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [results, setResults] = useState<SearchResults>({ persons: [], orders: [], drivers: [] });
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cmd+K / Ctrl+K global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Reset query/selection when closing
  useEffect(() => {
    if (!open) {
      setQuery('');
      setSelectedIndex(0);
      setResults({ persons: [], orders: [], drivers: [] });
    }
  }, [open]);

  // Debounced global search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults({ persons: [], orders: [], drivers: [] });
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search/global?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setResults({
            persons: data.persons || [],
            orders: data.orders || [],
            drivers: data.drivers || [],
          });
        }
      } catch (err) {
        console.error('Global search failed:', err);
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Filter base items by role + module + query
  const filteredBaseItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return BASE_ITEMS.filter((item) => {
      if (item.roles && !item.roles.includes(userRole)) return false;
      if (item.moduleKey && !enabledModules.includes(item.moduleKey)) return false;
      if (q.length === 0) return true;
      return item.label.toLowerCase().includes(q);
    });
  }, [query, userRole, enabledModules]);

  // Build flat list with group labels for keyboard nav
  const flatItems: CommandItem[] = useMemo(() => {
    const items: CommandItem[] = [...filteredBaseItems];

    if (query.trim().length >= 2) {
      for (const p of results.persons) {
        items.push({
          id: `person-${p.id}`,
          label: `${p.firstName} ${p.lastName}${p.email ? ` (${p.email})` : ''}`,
          icon: Users,
          href: `/candidates/${p.id}`,
          group: 'Persons',
        });
      }
      for (const o of results.orders) {
        items.push({
          id: `order-${o.id}`,
          label: `Order ${o.orderNumber}${o.jobsiteLocation ? ` - ${o.jobsiteLocation}` : ''}`,
          icon: FileText,
          href: `/orders/${o.id}`,
          group: 'Orders',
        });
      }
      for (const d of results.drivers) {
        items.push({
          id: `driver-${d.id}`,
          label: `${d.firstName} ${d.lastName}${d.email ? ` (${d.email})` : ''}`,
          icon: Shield,
          href: `/dqf/drivers/${d.id}`,
          group: 'Drivers',
        });
      }
    }

    return items;
  }, [filteredBaseItems, results, query]);

  // Reset selection if it goes out of range
  useEffect(() => {
    if (selectedIndex >= flatItems.length) setSelectedIndex(0);
  }, [flatItems.length, selectedIndex]);

  const handleSelect = useCallback(
    (item: CommandItem) => {
      if (item.action) {
        item.action();
      } else if (item.href) {
        router.push(item.href);
      }
      setOpen(false);
    },
    [router]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, flatItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = flatItems[selectedIndex];
      if (item) handleSelect(item);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  // Group items for rendering while preserving flat indices
  const groupedRender = useMemo(() => {
    const groups: Record<string, { item: CommandItem; index: number }[]> = {};
    flatItems.forEach((item, index) => {
      if (!groups[item.group]) groups[item.group] = [];
      groups[item.group].push({ item, index });
    });
    return groups;
  }, [flatItems]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg p-0 gap-0">
        <div className="border-b p-3 flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search or jump to..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            autoFocus
            className="border-0 shadow-none focus-visible:ring-0 px-0"
          />
        </div>
        <div className="max-h-[400px] overflow-y-auto p-2">
          {flatItems.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {searching ? 'Searching...' : 'No results found.'}
            </div>
          ) : (
            Object.entries(groupedRender).map(([group, entries]) => (
              <div key={group} className="mb-2">
                <div className="px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {group}
                </div>
                {entries.map(({ item, index }) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={cn(
                        'w-full text-left px-3 py-2 rounded flex items-center gap-2 text-sm',
                        index === selectedIndex ? 'bg-muted' : 'hover:bg-muted'
                      )}
                    >
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate">{item.label}</span>
                      {item.shortcut && (
                        <span className="ml-auto text-xs text-muted-foreground">{item.shortcut}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <div className="border-t p-2 text-xs text-muted-foreground flex justify-between">
          <span>↑↓ navigate · ↵ select · esc close</span>
          <span>⌘K</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
