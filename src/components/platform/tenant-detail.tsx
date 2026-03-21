'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, Building2, Users, FileText, CalendarDays, Pencil, X, Save } from 'lucide-react';
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

  // Edit states
  const [editingInfo, setEditingInfo] = useState(false);
  const [editingSettings, setEditingSettings] = useState(false);
  const [savingInfo, setSavingInfo] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [infoForm, setInfoForm] = useState({ name: '', contactEmail: '', contactPhone: '' });
  const [settingsForm, setSettingsForm] = useState({
    brandName: '',
    replyToEmail: '',
    timezone: '',
    dotCompanyName: '',
    dotConsortiumId: '',
    defaultCollectionWindowHours: 24,
  });

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

  const startEditInfo = () => {
    if (!data) return;
    setInfoForm({
      name: data.tpa.name,
      contactEmail: data.tpa.contactEmail || '',
      contactPhone: data.tpa.contactPhone || '',
    });
    setEditingInfo(true);
  };

  const startEditSettings = () => {
    if (!data) return;
    setSettingsForm({
      brandName: data.settings?.brandName || '',
      replyToEmail: data.settings?.replyToEmail || '',
      timezone: data.settings?.timezone || 'America/Chicago',
      dotCompanyName: data.settings?.dotCompanyName || '',
      dotConsortiumId: data.settings?.dotConsortiumId || '',
      defaultCollectionWindowHours: data.settings?.defaultCollectionWindowHours || 24,
    });
    setEditingSettings(true);
  };

  const saveInfo = async () => {
    setSavingInfo(true);
    try {
      const response = await fetch(`/api/platform/tenants/${tenantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: infoForm.name,
          contactEmail: infoForm.contactEmail || null,
          contactPhone: infoForm.contactPhone || null,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setData((prev) => prev ? {
          ...prev,
          tpa: { ...prev.tpa, name: result.tpa.name, contactEmail: result.tpa.contactEmail, contactPhone: result.tpa.contactPhone, updatedAt: result.tpa.updatedAt },
        } : prev);
        setEditingInfo(false);
        toast({ title: 'Account info updated' });
      } else {
        const err = await response.json();
        toast({ title: 'Error', description: err.error || 'Failed to update', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to update', variant: 'destructive' });
    } finally {
      setSavingInfo(false);
    }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const response = await fetch(`/api/platform/tenants/${tenantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            brandName: settingsForm.brandName || null,
            replyToEmail: settingsForm.replyToEmail || null,
            timezone: settingsForm.timezone || null,
            dotCompanyName: settingsForm.dotCompanyName || null,
            dotConsortiumId: settingsForm.dotConsortiumId || null,
            defaultCollectionWindowHours: settingsForm.defaultCollectionWindowHours,
          },
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setData((prev) => prev ? {
          ...prev,
          settings: {
            brandName: result.settings?.brandName || null,
            logoUrl: result.settings?.logoUrl || null,
            primaryColor: result.settings?.primaryColor || null,
            replyToEmail: result.settings?.replyToEmail || null,
            timezone: result.settings?.timezone || null,
            dotCompanyName: result.settings?.dotCompanyName || null,
            dotConsortiumId: result.settings?.dotConsortiumId || null,
            defaultCollectionWindowHours: result.settings?.defaultCollectionWindowHours || null,
          },
        } : prev);
        setEditingSettings(false);
        toast({ title: 'Settings updated' });
      } else {
        const err = await response.json();
        toast({ title: 'Error', description: err.error || 'Failed to update', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to update', variant: 'destructive' });
    } finally {
      setSavingSettings(false);
    }
  };

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
        {/* Account Information */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Account Information</h2>
            {!editingInfo ? (
              <Button variant="ghost" size="sm" onClick={startEditInfo}>
                <Pencil className="h-4 w-4 mr-1" />
                Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditingInfo(false)} disabled={savingInfo}>
                  <X className="h-4 w-4" />
                </Button>
                <Button size="sm" onClick={saveInfo} disabled={savingInfo}>
                  <Save className="h-4 w-4 mr-1" />
                  {savingInfo ? 'Saving...' : 'Save'}
                </Button>
              </div>
            )}
          </div>
          {editingInfo ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Organization Name</Label>
                <Input
                  id="edit-name"
                  value={infoForm.name}
                  onChange={(e) => setInfoForm({ ...infoForm, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-email">Contact Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={infoForm.contactEmail}
                  onChange={(e) => setInfoForm({ ...infoForm, contactEmail: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-phone">Contact Phone</Label>
                <Input
                  id="edit-phone"
                  type="tel"
                  value={infoForm.contactPhone}
                  onChange={(e) => setInfoForm({ ...infoForm, contactPhone: e.target.value })}
                />
              </div>
            </div>
          ) : (
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
          )}
        </Card>

        {/* TPA Settings */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">TPA Settings</h2>
            {!editingSettings ? (
              <Button variant="ghost" size="sm" onClick={startEditSettings}>
                <Pencil className="h-4 w-4 mr-1" />
                Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditingSettings(false)} disabled={savingSettings}>
                  <X className="h-4 w-4" />
                </Button>
                <Button size="sm" onClick={saveSettings} disabled={savingSettings}>
                  <Save className="h-4 w-4 mr-1" />
                  {savingSettings ? 'Saving...' : 'Save'}
                </Button>
              </div>
            )}
          </div>
          {editingSettings ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-brand">Brand Name</Label>
                <Input
                  id="edit-brand"
                  value={settingsForm.brandName}
                  onChange={(e) => setSettingsForm({ ...settingsForm, brandName: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-reply">Reply-To Email</Label>
                <Input
                  id="edit-reply"
                  type="email"
                  value={settingsForm.replyToEmail}
                  onChange={(e) => setSettingsForm({ ...settingsForm, replyToEmail: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-tz">Timezone</Label>
                <Input
                  id="edit-tz"
                  value={settingsForm.timezone}
                  onChange={(e) => setSettingsForm({ ...settingsForm, timezone: e.target.value })}
                  placeholder="America/Chicago"
                />
              </div>
              <div>
                <Label htmlFor="edit-dot-company">DOT Company Name</Label>
                <Input
                  id="edit-dot-company"
                  value={settingsForm.dotCompanyName}
                  onChange={(e) => setSettingsForm({ ...settingsForm, dotCompanyName: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-dot-id">DOT Consortium ID</Label>
                <Input
                  id="edit-dot-id"
                  value={settingsForm.dotConsortiumId}
                  onChange={(e) => setSettingsForm({ ...settingsForm, dotConsortiumId: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-window">Collection Window (hours)</Label>
                <Input
                  id="edit-window"
                  type="number"
                  min={1}
                  value={settingsForm.defaultCollectionWindowHours}
                  onChange={(e) => setSettingsForm({ ...settingsForm, defaultCollectionWindowHours: parseInt(e.target.value) || 24 })}
                />
              </div>
            </div>
          ) : settings ? (
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
            <div>
              <p className="text-muted-foreground text-sm mb-3">No settings configured yet.</p>
              <Button variant="outline" size="sm" onClick={startEditSettings}>
                Configure Settings
              </Button>
            </div>
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
