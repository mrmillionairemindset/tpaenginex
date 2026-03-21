'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, Building2, Users, FileText, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';

interface TenantDetailProps {
  tenantId: string;
}

interface TpaData {
  tpa: {
    id: string;
    name: string;
    slug: string;
    contactEmail: string | null;
    contactPhone: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  };
  settings: {
    brandName: string | null;
    logoUrl: string | null;
    primaryColor: string | null;
    replyToEmail: string | null;
    timezone: string | null;
    dotCompanyName: string | null;
    dotConsortiumId: string | null;
    defaultCollectionWindowHours: number | null;
  } | null;
  members: {
    id: string;
    name: string | null;
    email: string;
    role: string | null;
    isActive: boolean;
    lastLoginAt: string | null;
    createdAt: string;
  }[];
  clients: {
    id: string;
    name: string;
    contactEmail: string | null;
    contactPhone: string | null;
    isActive: boolean;
    createdAt: string;
  }[];
  stats: {
    totalOrders: number;
    totalEvents: number;
    totalClients: number;
    totalUsers: number;
  };
}

export function TenantDetail({ tenantId }: TenantDetailProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [data, setData] = useState<TpaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    async function fetchTenant() {
      try {
        const response = await fetch(`/api/platform/tenants/${tenantId}`);
        if (response.ok) {
          const result = await response.json();
          setData(result);
        }
      } catch (error) {
        console.error('Failed to fetch tenant:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchTenant();
  }, [tenantId]);

  const handleToggleActive = async () => {
    if (!data) return;
    setToggling(true);

    try {
      const response = await fetch(`/api/platform/tenants/${tenantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !data.tpa.isActive }),
      });

      if (response.ok) {
        const result = await response.json();
        setData((prev) => prev ? { ...prev, tpa: { ...prev.tpa, isActive: result.tpa.isActive } } : prev);
        toast({ title: `TPA ${result.tpa.isActive ? 'activated' : 'deactivated'}` });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-muted-foreground py-12 text-center">TPA not found.</p>;
  }

  const { tpa, settings, members, clients, stats } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/platform/tenants')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{tpa.name}</h1>
            <p className="text-muted-foreground text-sm">Slug: {tpa.slug}</p>
          </div>
          <Badge
            className={tpa.isActive
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
            }
            variant="secondary"
          >
            {tpa.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>
        <Button
          variant={tpa.isActive ? 'destructive' : 'default'}
          size="sm"
          disabled={toggling}
          onClick={handleToggleActive}
        >
          {toggling ? '...' : tpa.isActive ? 'Deactivate' : 'Activate'}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4 flex items-center gap-3">
          <Building2 className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="text-2xl font-bold">{stats.totalClients}</p>
            <p className="text-xs text-muted-foreground">Clients</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <Users className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="text-2xl font-bold">{stats.totalUsers}</p>
            <p className="text-xs text-muted-foreground">Users</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <FileText className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="text-2xl font-bold">{stats.totalOrders}</p>
            <p className="text-xs text-muted-foreground">Total Orders</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <CalendarDays className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="text-2xl font-bold">{stats.totalEvents}</p>
            <p className="text-xs text-muted-foreground">Total Events</p>
          </div>
        </Card>
      </div>

      {/* Account Info & Settings side by side */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Account Information</h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm text-muted-foreground">Contact Email</dt>
              <dd className="font-medium">{tpa.contactEmail || '-'}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Contact Phone</dt>
              <dd className="font-medium">{tpa.contactPhone || '-'}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Created</dt>
              <dd className="font-medium">{format(new Date(tpa.createdAt), 'PPP')}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Last Updated</dt>
              <dd className="font-medium">{format(new Date(tpa.updatedAt), 'PPP')}</dd>
            </div>
          </dl>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">TPA Settings</h2>
          {settings ? (
            <dl className="space-y-3">
              <div>
                <dt className="text-sm text-muted-foreground">Brand Name</dt>
                <dd className="font-medium">{settings.brandName || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Reply-To Email</dt>
                <dd className="font-medium">{settings.replyToEmail || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Timezone</dt>
                <dd className="font-medium">{settings.timezone || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">DOT Company</dt>
                <dd className="font-medium">{settings.dotCompanyName || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">DOT Consortium ID</dt>
                <dd className="font-medium">{settings.dotConsortiumId || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Collection Window</dt>
                <dd className="font-medium">{settings.defaultCollectionWindowHours || 24} hours</dd>
              </div>
            </dl>
          ) : (
            <p className="text-muted-foreground text-sm">No settings configured yet.</p>
          )}
        </Card>
      </div>

      {/* Users */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Users ({members.length})</h2>
        {members.length === 0 ? (
          <p className="text-muted-foreground text-sm">No users.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Email</th>
                  <th className="pb-2 font-medium">Role</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Last Login</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {members.map((m) => (
                  <tr key={m.id}>
                    <td className="py-2">{m.name || '-'}</td>
                    <td className="py-2 text-muted-foreground">{m.email}</td>
                    <td className="py-2">
                      <Badge variant="secondary" className="capitalize text-xs">
                        {m.role?.replace(/_/g, ' ') || '-'}
                      </Badge>
                    </td>
                    <td className="py-2">
                      <Badge
                        variant="secondary"
                        className={m.isActive
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-muted text-foreground'
                        }
                      >
                        {m.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {m.lastLoginAt ? format(new Date(m.lastLoginAt), 'MMM d, yyyy') : 'Never'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Clients */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Clients ({clients.length})</h2>
        {clients.length === 0 ? (
          <p className="text-muted-foreground text-sm">No clients onboarded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium">Company Name</th>
                  <th className="pb-2 font-medium">Contact Email</th>
                  <th className="pb-2 font-medium">Contact Phone</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {clients.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2 font-medium">{c.name}</td>
                    <td className="py-2 text-muted-foreground">{c.contactEmail || '-'}</td>
                    <td className="py-2 text-muted-foreground">{c.contactPhone || '-'}</td>
                    <td className="py-2">
                      <Badge
                        variant="secondary"
                        className={c.isActive
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-muted text-foreground'
                        }
                      >
                        {c.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {format(new Date(c.createdAt), 'MMM d, yyyy')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
