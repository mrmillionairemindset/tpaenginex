'use client';

import { useEffect, useState, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/use-toast';
import { Building2, Users, FileText, UserPlus, AlertCircle, MapPin, Mail, Phone, CalendarDays, FileDown, Bell, ClipboardList, Upload, Archive, FolderOpen, CheckSquare, Plus, Trash2, RotateCcw, Pencil, ChevronUp, ChevronDown, GripVertical } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useRouter } from 'next/navigation';
import { SERVICE_TYPE_CHECKLISTS } from '@/lib/service-templates';

interface ClientDetailProps {
  clientOrgId: string;
  userRole: string;
}

const CLIENT_DOC_KIND_LABELS: Record<string, string> = {
  contract: 'Contract',
  sop: 'SOP',
  baa: 'BAA',
  coc_template: 'COC Template',
  general: 'General',
};

const CLIENT_DOC_KIND_COLORS: Record<string, string> = {
  contract: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  sop: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  baa: 'bg-red-500/10 text-red-600 dark:text-red-400',
  coc_template: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  general: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
};

export function ClientDetail({ clientOrgId, userRole }: ClientDetailProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteFirstName, setInviteFirstName] = useState('');
  const [inviteLastName, setInviteLastName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  // Client doc upload state
  const [showDocUpload, setShowDocUpload] = useState(false);
  const [docKind, setDocKind] = useState('general');
  const [docNotes, setDocNotes] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Location management state
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [locationForm, setLocationForm] = useState({ name: '', address: '', city: '', state: '', zip: '', phone: '', notes: '' });
  const [savingLocation, setSavingLocation] = useState(false);

  // Checklist template editor state
  const [editingServiceType, setEditingServiceType] = useState<string | null>(null);
  const [editItems, setEditItems] = useState<string[]>([]);
  const [savingChecklist, setSavingChecklist] = useState(false);

  const isAdmin = userRole === 'tpa_admin' || userRole === 'platform_admin';
  const canUploadDocs = userRole === 'tpa_admin' || userRole === 'tpa_staff' || userRole === 'platform_admin';

  const fetchClient = async () => {
    try {
      const response = await fetch(`/api/clients/${clientOrgId}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      } else {
        setError('Client not found');
      }
    } catch (err) {
      setError('Failed to load client');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClient();
  }, [clientOrgId]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);

    try {
      const res = await fetch(`/api/clients/${clientOrgId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: inviteFirstName,
          lastName: inviteLastName,
          email: inviteEmail,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        toast({ title: 'User Invited', description: result.message });
        setShowInvite(false);
        setInviteFirstName('');
        setInviteLastName('');
        setInviteEmail('');
        const refreshRes = await fetch(`/api/clients/${clientOrgId}`);
        if (refreshRes.ok) setData(await refreshRes.json());
      } else {
        const err = await res.json();
        toast({ title: 'Error', description: err.error, variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to invite user', variant: 'destructive' });
    } finally {
      setInviting(false);
    }
  };

  const handleDocUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docFile) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', docFile);
      formData.append('kind', docKind);
      if (docNotes) formData.append('notes', docNotes);

      const res = await fetch(`/api/clients/${clientOrgId}/documents`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        toast({ title: 'Document Uploaded', description: `${docFile.name} has been uploaded.` });
        setShowDocUpload(false);
        setDocFile(null);
        setDocKind('general');
        setDocNotes('');
        if (fileInputRef.current) fileInputRef.current.value = '';
        // Refresh data
        const refreshRes = await fetch(`/api/clients/${clientOrgId}`);
        if (refreshRes.ok) setData(await refreshRes.json());
      } else {
        const err = await res.json();
        toast({ title: 'Upload Failed', description: err.error, variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to upload document', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleArchiveDoc = async (docId: string, fileName: string) => {
    if (!confirm(`Archive "${fileName}"? It will no longer be visible to the client.`)) return;

    try {
      const res = await fetch(`/api/clients/${clientOrgId}/documents/${docId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast({ title: 'Document Archived', description: `${fileName} has been archived.` });
        const refreshRes = await fetch(`/api/clients/${clientOrgId}`);
        if (refreshRes.ok) setData(await refreshRes.json());
      } else {
        const err = await res.json();
        toast({ title: 'Error', description: err.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to archive document', variant: 'destructive' });
    }
  };

  const handleDownloadClientDoc = async (docId: string) => {
    try {
      const res = await fetch(`/api/clients/${clientOrgId}/documents/${docId}`);
      if (res.ok) {
        const { url } = await res.json();
        window.open(url, '_blank');
      } else {
        toast({ title: 'Error', description: 'Failed to get download link', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to download', variant: 'destructive' });
    }
  };

  const SERVICE_TYPE_LABELS: Record<string, string> = {
    pre_employment: 'Pre-Employment',
    random: 'Random',
    post_accident: 'Post-Accident',
    reasonable_suspicion: 'Reasonable Suspicion',
    physical: 'Physical',
    other: 'Other',
    drug_screen: 'Drug Screen',
  };

  const getClientTemplate = (serviceType: string) => {
    if (!data?.checklistTemplates) return null;
    return data.checklistTemplates.find(
      (t: any) => t.serviceType === serviceType && t.isActive
    );
  };

  const handleStartEditChecklist = (serviceType: string) => {
    const clientTemplate = getClientTemplate(serviceType);
    const items = clientTemplate
      ? clientTemplate.items
      : SERVICE_TYPE_CHECKLISTS[serviceType] || [];
    setEditItems([...items]);
    setEditingServiceType(serviceType);
  };

  const handleSaveChecklist = async () => {
    if (!editingServiceType) return;
    setSavingChecklist(true);

    try {
      const filteredItems = editItems.filter(item => item.trim() !== '');
      if (filteredItems.length === 0) {
        toast({ title: 'Error', description: 'At least one checklist item is required', variant: 'destructive' });
        setSavingChecklist(false);
        return;
      }

      const res = await fetch(`/api/clients/${clientOrgId}/checklist-templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceType: editingServiceType,
          items: filteredItems,
        }),
      });

      if (res.ok) {
        toast({ title: 'Checklist Saved', description: `Custom checklist for ${SERVICE_TYPE_LABELS[editingServiceType] || editingServiceType} has been saved.` });
        setEditingServiceType(null);
        setEditItems([]);
        // Refresh data
        const refreshRes = await fetch(`/api/clients/${clientOrgId}`);
        if (refreshRes.ok) setData(await refreshRes.json());
      } else {
        const err = await res.json();
        toast({ title: 'Error', description: err.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to save checklist', variant: 'destructive' });
    } finally {
      setSavingChecklist(false);
    }
  };

  const handleResetChecklist = async (serviceType: string) => {
    const clientTemplate = getClientTemplate(serviceType);
    if (!clientTemplate) return;

    if (!confirm(`Reset "${SERVICE_TYPE_LABELS[serviceType] || serviceType}" to the default checklist? The custom template will be deleted.`)) return;

    try {
      const res = await fetch(`/api/clients/${clientOrgId}/checklist-templates/${clientTemplate.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast({ title: 'Reset to Default', description: `${SERVICE_TYPE_LABELS[serviceType] || serviceType} checklist has been reset to default.` });
        // Refresh data
        const refreshRes = await fetch(`/api/clients/${clientOrgId}`);
        if (refreshRes.ok) setData(await refreshRes.json());
      } else {
        const err = await res.json();
        toast({ title: 'Error', description: err.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to reset checklist', variant: 'destructive' });
    }
  };

  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingLocation(true);
    try {
      const method = editingLocationId ? 'PATCH' : 'POST';
      const body = editingLocationId
        ? { locationId: editingLocationId, ...locationForm }
        : locationForm;

      const res = await fetch(`/api/clients/${clientOrgId}/locations`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast({ title: editingLocationId ? 'Location Updated' : 'Location Added' });
        setShowLocationForm(false);
        setEditingLocationId(null);
        setLocationForm({ name: '', address: '', city: '', state: '', zip: '', phone: '', notes: '' });
        fetchClient();
      } else {
        const err = await res.json();
        toast({ title: 'Error', description: err.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to save location', variant: 'destructive' });
    } finally {
      setSavingLocation(false);
    }
  };

  const handleDeleteLocation = async (locationId: string, name: string) => {
    if (!confirm(`Delete location "${name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/clients/${clientOrgId}/locations`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId }),
      });
      if (res.ok) {
        toast({ title: 'Location Deleted' });
        fetchClient();
      } else {
        const err = await res.json();
        toast({ title: 'Error', description: err.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to delete location', variant: 'destructive' });
    }
  };

  const startEditLocation = (loc: any) => {
    setEditingLocationId(loc.id);
    setLocationForm({
      name: loc.name || '',
      address: loc.address || '',
      city: loc.city || '',
      state: loc.state || '',
      zip: loc.zip || '',
      phone: loc.phone || '',
      notes: loc.notes || '',
    });
    setShowLocationForm(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Client Not Found"
        description={error || 'The client you are looking for does not exist'}
      />
    );
  }

  const {
    client,
    members,
    recentOrders,
    events: clientEvents,
    documents: orderDocuments,
    clientDocuments: clientDocs,
    communications,
    serviceRequests,
    checklistTemplates,
    locations,
    stats,
  } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{client.name}</h1>
          {(client.city || client.state) && (
            <p className="text-muted-foreground mt-1 flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {[client.city, client.state].filter(Boolean).join(', ')}
            </p>
          )}
        </div>
        <Badge variant={client.isActive ? 'default' : 'secondary'}>
          {client.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-primary">{stats.totalOrders}</p>
          <p className="text-xs text-muted-foreground">Total Orders</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-amber-500">{stats.openOrders}</p>
          <p className="text-xs text-muted-foreground">Open</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-green-500">{stats.completedOrders}</p>
          <p className="text-xs text-muted-foreground">Completed</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold">{stats.totalUsers}</p>
          <p className="text-xs text-muted-foreground">Portal Users</p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Client Info */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Company Info</h2>
          </div>
          <dl className="space-y-3">
            {client.contactEmail && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{client.contactEmail}</span>
              </div>
            )}
            {client.contactPhone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{client.contactPhone}</span>
              </div>
            )}
            {client.address && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <span className="text-sm">
                  {client.address}
                  {client.city && <>, {client.city}</>}
                  {client.state && <>, {client.state}</>}
                  {client.zip && <> {client.zip}</>}
                </span>
              </div>
            )}
            <div>
              <span className="text-xs text-muted-foreground">
                Added {format(new Date(client.createdAt), 'PPP')}
              </span>
            </div>
          </dl>
        </Card>

        {/* Portal Users */}
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Portal Users ({members.length})</h2>
            </div>
            {isAdmin && (
              <Button
                size="sm"
                onClick={() => setShowInvite(!showInvite)}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Invite User
              </Button>
            )}
          </div>

          {/* Invite Form */}
          {showInvite && (
            <form onSubmit={handleInvite} className="mb-4 rounded-lg border border-border bg-secondary p-4 space-y-3">
              <p className="text-sm font-medium">Invite a contact from this company to the client portal</p>
              <div className="grid gap-3 md:grid-cols-3">
                <input
                  type="text"
                  value={inviteFirstName}
                  onChange={(e) => setInviteFirstName(e.target.value)}
                  placeholder="First name"
                  required
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <input
                  type="text"
                  value={inviteLastName}
                  onChange={(e) => setInviteLastName(e.target.value)}
                  placeholder="Last name"
                  required
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="Email address"
                  required
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={inviting}>
                  {inviting ? 'Sending Invite...' : 'Send Invite'}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setShowInvite(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {members.length > 0 ? (
            <div className="space-y-2">
              {members.map((member: any) => (
                <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{member.user.name || 'No name'}</p>
                    <p className="text-xs text-muted-foreground">{member.user.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {member.user.lastLoginAt ? (
                      <span className="text-xs text-muted-foreground">
                        Last login {formatDistanceToNow(new Date(member.user.lastLoginAt), { addSuffix: true })}
                      </span>
                    ) : (
                      <span className="text-xs text-amber-500">Never logged in</span>
                    )}
                    <Badge variant={member.isActive ? 'default' : 'secondary'} className="text-xs">
                      {member.role === 'client_admin' ? 'Admin' : member.role}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No portal users yet. Click &quot;Invite User&quot; to give this client access to view their orders and results.
            </p>
          )}
        </Card>
      </div>

      {/* Locations / Plants */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Locations ({locations?.length || 0})</h2>
          </div>
          {canUploadDocs && (
            <Button
              size="sm"
              onClick={() => {
                setEditingLocationId(null);
                setLocationForm({ name: '', address: '', city: '', state: '', zip: '', phone: '', notes: '' });
                setShowLocationForm(!showLocationForm);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Location
            </Button>
          )}
        </div>

        {showLocationForm && (
          <form onSubmit={handleSaveLocation} className="mb-4 rounded-lg border border-border bg-secondary p-4 space-y-3">
            <p className="text-sm font-medium">{editingLocationId ? 'Edit Location' : 'Add a new plant or location for this client'}</p>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Location Name *</label>
                <input
                  type="text"
                  value={locationForm.name}
                  onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
                  placeholder="e.g. Main Plant, Warehouse B"
                  required
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Phone</label>
                <input
                  type="text"
                  value={locationForm.phone}
                  onChange={(e) => setLocationForm({ ...locationForm, phone: e.target.value })}
                  placeholder="(555) 123-4567"
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Address *</label>
              <input
                type="text"
                value={locationForm.address}
                onChange={(e) => setLocationForm({ ...locationForm, address: e.target.value })}
                placeholder="Street address"
                required
                className="rounded-md border border-input bg-background px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">City *</label>
                <input
                  type="text"
                  value={locationForm.city}
                  onChange={(e) => setLocationForm({ ...locationForm, city: e.target.value })}
                  required
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">State *</label>
                <input
                  type="text"
                  value={locationForm.state}
                  onChange={(e) => setLocationForm({ ...locationForm, state: e.target.value.toUpperCase().slice(0, 2) })}
                  placeholder="TX"
                  required
                  maxLength={2}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">ZIP *</label>
                <input
                  type="text"
                  value={locationForm.zip}
                  onChange={(e) => setLocationForm({ ...locationForm, zip: e.target.value })}
                  required
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
              <input
                type="text"
                value={locationForm.notes}
                onChange={(e) => setLocationForm({ ...locationForm, notes: e.target.value })}
                placeholder="Optional notes about this location..."
                className="rounded-md border border-input bg-background px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={savingLocation}>
                {savingLocation ? 'Saving...' : editingLocationId ? 'Update Location' : 'Add Location'}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => { setShowLocationForm(false); setEditingLocationId(null); }}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        {locations && locations.length > 0 ? (
          <div className="space-y-2">
            {locations.map((loc: any) => (
              <div key={loc.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{loc.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {loc.address}, {loc.city}, {loc.state} {loc.zip}
                  </p>
                  {loc.phone && (
                    <p className="text-xs text-muted-foreground">{loc.phone}</p>
                  )}
                  {loc.notes && (
                    <p className="text-xs text-muted-foreground italic mt-0.5">{loc.notes}</p>
                  )}
                </div>
                {canUploadDocs && (
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEditLocation(loc)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-500 hover:text-red-600"
                      onClick={() => handleDeleteLocation(loc.id, loc.name)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No locations added yet. Add plant locations for this client to use when placing orders.</p>
        )}
      </Card>

      {/* Recent Orders */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Recent Orders ({stats.totalOrders})</h2>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push('/orders/new')}
          >
            New Order
          </Button>
        </div>

        {recentOrders.length > 0 ? (
          <div className="space-y-2">
            {recentOrders.map((order: any) => (
              <div
                key={order.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted cursor-pointer"
                onClick={() => router.push(`/orders/${order.id}`)}
              >
                <div>
                  <p className="font-medium text-sm">{order.orderNumber}</p>
                  {order.candidate && (
                    <p className="text-xs text-muted-foreground">
                      {order.candidate.firstName} {order.candidate.lastName}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}
                  </span>
                  <StatusBadge status={order.status} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No orders yet for this client.</p>
        )}
      </Card>

      {/* Service Events */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Service Events ({clientEvents?.length || 0})</h2>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push('/events/new')}
          >
            New Event
          </Button>
        </div>

        {clientEvents && clientEvents.length > 0 ? (
          <div className="space-y-2">
            {clientEvents.map((event: any) => (
              <div
                key={event.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted cursor-pointer"
                onClick={() => router.push(`/events/${event.id}`)}
              >
                <div>
                  <p className="font-medium text-sm">{event.eventNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    {event.serviceType?.replace(/_/g, ' ')} &middot; {format(new Date(event.scheduledDate), 'MMM d, yyyy')}
                    {event.collector && ` \u00b7 ${event.collector.firstName} ${event.collector.lastName}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">
                    <span className="text-green-500">{event.totalCompleted}</span>
                    /{event.totalOrdered}
                    {event.totalPending > 0 && <span className="text-amber-500 ml-1">({event.totalPending} pending)</span>}
                  </span>
                  <StatusBadge status={event.status} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No events yet for this client.</p>
        )}
      </Card>

      {/* Client Documents (contracts, SOPs, BAAs) */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Client Documents ({clientDocs?.length || 0})</h2>
          </div>
          {canUploadDocs && (
            <Button
              size="sm"
              onClick={() => setShowDocUpload(!showDocUpload)}
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload Document
            </Button>
          )}
        </div>

        {/* Upload Form */}
        {showDocUpload && (
          <form onSubmit={handleDocUpload} className="mb-4 rounded-lg border border-border bg-secondary p-4 space-y-3">
            <p className="text-sm font-medium">Upload a document for this client (contract, SOP, BAA, etc.)</p>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">File</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                  required
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Document Type</label>
                <select
                  value={docKind}
                  onChange={(e) => setDocKind(e.target.value)}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="contract">Contract</option>
                  <option value="sop">SOP</option>
                  <option value="baa">BAA</option>
                  <option value="coc_template">COC Template</option>
                  <option value="general">General</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Notes (optional)</label>
              <input
                type="text"
                value={docNotes}
                onChange={(e) => setDocNotes(e.target.value)}
                placeholder="Add notes about this document..."
                className="rounded-md border border-input bg-background px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={uploading || !docFile}>
                {uploading ? 'Uploading...' : 'Upload'}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => { setShowDocUpload(false); setDocFile(null); }}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        {clientDocs && clientDocs.length > 0 ? (
          <div className="space-y-2">
            {clientDocs.map((doc: any) => (
              <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{doc.fileName}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className={`text-xs ${CLIENT_DOC_KIND_COLORS[doc.kind] || ''}`}>
                      {CLIENT_DOC_KIND_LABELS[doc.kind] || doc.kind}
                    </Badge>
                    {doc.uploadedByUser && (
                      <span className="text-xs text-muted-foreground">
                        by {doc.uploadedByUser.name || doc.uploadedByUser.email}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(doc.createdAt), 'MMM d, yyyy')}
                    </span>
                  </div>
                  {doc.notes && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">{doc.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownloadClientDoc(doc.id)}
                  >
                    <FileDown className="h-4 w-4" />
                  </Button>
                  {isAdmin && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-500 hover:text-red-600"
                      onClick={() => handleArchiveDoc(doc.id, doc.fileName)}
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No client documents uploaded yet. Upload contracts, SOPs, or BAAs above.</p>
        )}
      </Card>

      {/* Checklist Templates */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <CheckSquare className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Checklist Templates</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Customize the checklist items that are auto-populated when creating orders for this client. Service types without a custom template use the system defaults.
        </p>

        <div className="space-y-3">
          {Object.keys(SERVICE_TYPE_CHECKLISTS).map(serviceType => {
            const defaultItems = SERVICE_TYPE_CHECKLISTS[serviceType] || [];
            const clientTemplate = getClientTemplate(serviceType);
            const displayItems = clientTemplate ? clientTemplate.items : defaultItems;
            const isEditing = editingServiceType === serviceType;

            if (defaultItems.length === 0 && !clientTemplate) return null;

            return (
              <div key={serviceType} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-sm">
                      {SERVICE_TYPE_LABELS[serviceType] || serviceType}
                    </h3>
                    <Badge
                      variant="secondary"
                      className={clientTemplate
                        ? 'bg-primary/10 text-primary text-xs'
                        : 'bg-gray-500/10 text-gray-500 text-xs'
                      }
                    >
                      {clientTemplate ? 'Custom' : 'Using default'}
                    </Badge>
                  </div>
                  {isAdmin && !isEditing && (
                    <div className="flex items-center gap-2">
                      {clientTemplate && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={() => handleResetChecklist(serviceType)}
                        >
                          <RotateCcw className="mr-1 h-3 w-3" />
                          Reset to Default
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={() => handleStartEditChecklist(serviceType)}
                      >
                        Customize
                      </Button>
                    </div>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-2 mt-3">
                    {editItems.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <div className="flex flex-col">
                          <button
                            type="button"
                            disabled={idx === 0}
                            className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5"
                            onClick={() => {
                              const updated = [...editItems];
                              [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
                              setEditItems(updated);
                            }}
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === editItems.length - 1}
                            className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5"
                            onClick={() => {
                              const updated = [...editItems];
                              [updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]];
                              setEditItems(updated);
                            }}
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <span className="text-xs text-muted-foreground w-6 text-right">{idx + 1}.</span>
                        <input
                          type="text"
                          value={item}
                          onChange={(e) => {
                            const updated = [...editItems];
                            updated[idx] = e.target.value;
                            setEditItems(updated);
                          }}
                          className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-red-500 hover:text-red-600 h-8 w-8 p-0"
                          onClick={() => {
                            const updated = editItems.filter((_, i) => i !== idx);
                            setEditItems(updated);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => setEditItems([...editItems, ''])}
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      Add Item
                    </Button>
                    <div className="flex gap-2 pt-2 border-t">
                      <Button
                        size="sm"
                        disabled={savingChecklist}
                        onClick={handleSaveChecklist}
                      >
                        {savingChecklist ? 'Saving...' : 'Save Custom Checklist'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setEditingServiceType(null); setEditItems([]); }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <ul className="space-y-1 mt-2">
                    {displayItems.map((item: string, idx: number) => (
                      <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-xs mt-0.5 opacity-50">{idx + 1}.</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Order Documents */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileDown className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Order Documents ({stats.totalDocuments || 0})</h2>
        </div>

        {orderDocuments && orderDocuments.length > 0 ? (
          <div className="space-y-2">
            {orderDocuments.map((doc: any) => (
              <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium text-sm">{doc.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    <Badge variant="secondary" className="text-xs mr-2">{doc.kind}</Badge>
                    Order {doc.orderNumber} &middot; {format(new Date(doc.createdAt), 'MMM d, yyyy')}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      const res = await fetch(`/api/files/${doc.id}`);
                      if (res.ok) {
                        const { url } = await res.json();
                        window.open(url, '_blank');
                      }
                    } catch {
                      toast({ title: 'Error', description: 'Failed to download', variant: 'destructive' });
                    }
                  }}
                >
                  Download
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No order documents uploaded yet.</p>
        )}
      </Card>

      {/* Service Requests */}
      {serviceRequests && serviceRequests.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <ClipboardList className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Service Requests ({serviceRequests.length})</h2>
          </div>

          <div className="space-y-2">
            {serviceRequests.map((req: any) => (
              <div key={req.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium text-sm">
                    {req.donorFirstName} {req.donorLastName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {req.serviceType?.replace(/_/g, ' ')} &middot; {format(new Date(req.createdAt), 'MMM d, yyyy')}
                  </p>
                </div>
                <Badge
                  variant="secondary"
                  className={
                    req.status === 'submitted' ? 'bg-amber-500/10 text-amber-500'
                    : req.status === 'accepted' ? 'bg-primary/10 text-primary'
                    : req.status === 'converted' ? 'bg-green-500/10 text-green-500'
                    : req.status === 'declined' ? 'bg-red-500/10 text-red-500'
                    : ''
                  }
                >
                  {req.status}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Communications */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Communications ({communications?.length || 0})</h2>
        </div>

        {communications && communications.length > 0 ? (
          <div className="space-y-2">
            {communications.map((comm: any) => (
              <div key={comm.id} className="flex items-start gap-3 p-3 border rounded-lg">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 flex-shrink-0 mt-0.5">
                  <Bell className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{comm.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{comm.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(comm.createdAt), { addSuffix: true })}
                  </p>
                </div>
                <Badge variant="secondary" className="text-xs flex-shrink-0">
                  {comm.type?.replace(/_/g, ' ')}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No communications logged yet.</p>
        )}
      </Card>
    </div>
  );
}
