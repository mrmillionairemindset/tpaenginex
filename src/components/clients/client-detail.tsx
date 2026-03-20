'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/use-toast';
import { Building2, Users, FileText, UserPlus, AlertCircle, MapPin, Mail, Phone } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useRouter } from 'next/navigation';

interface ClientDetailProps {
  clientOrgId: string;
  userRole: string;
}

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

  const isAdmin = userRole === 'tpa_admin' || userRole === 'platform_admin';

  useEffect(() => {
    async function fetchClient() {
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
    }

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
        // Refresh data
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

  const { client, members, recentOrders, stats } = data;

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
              No portal users yet. Click "Invite User" to give this client access to view their orders and results.
            </p>
          )}
        </Card>
      </div>

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
    </div>
  );
}
