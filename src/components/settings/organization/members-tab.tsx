'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Plus, UserMinus, X } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Member {
  id: string;
  userId: string;
  role: string;
  isActive: boolean;
  joinedAt: string;
  user: { id: string; email: string; name: string | null; lastLoginAt: string | null };
  invitedBy: { id: string; email: string; name: string | null } | null;
}

const roleLabels: Record<string, string> = {
  tpa_admin: 'Admin',
  tpa_staff: 'Staff',
  tpa_records: 'Records',
  tpa_billing: 'Billing',
  client_admin: 'Client Admin',
  platform_admin: 'Platform Admin',
  collector: 'Collector',
};

const roleColors: Record<string, string> = {
  tpa_admin: 'bg-purple-100 text-purple-800',
  tpa_staff: 'bg-blue-100 text-blue-800',
  tpa_records: 'bg-green-100 text-green-800',
  tpa_billing: 'bg-amber-100 text-amber-800',
  collector: 'bg-teal-100 text-teal-800',
};

interface MembersTabProps {
  orgId: string;
  currentUserId: string;
}

export function MembersTab({ orgId, currentUserId }: MembersTabProps) {
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);
  const [removing, setRemoving] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    firstName: '', lastName: '', email: '', role: '',
  });

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch(`/api/organizations/${orgId}/members`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
      }
    } catch (err) {
      console.error('Failed to fetch members:', err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    try {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...inviteForm, orgId }),
      });
      if (res.ok) {
        toast({ title: 'Invitation Sent', description: `${inviteForm.firstName} ${inviteForm.lastName} has been invited` });
        setInviteForm({ firstName: '', lastName: '', email: '', role: '' });
        setShowInvite(false);
        fetchMembers();
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'Failed to send invitation', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'An unexpected error occurred', variant: 'destructive' });
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async () => {
    if (!memberToRemove) return;
    setRemoving(true);
    try {
      const res = await fetch(`/api/organizations/${orgId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: memberToRemove.userId }),
      });
      if (res.ok) {
        toast({ title: 'Member Removed', description: `${memberToRemove.user.name || memberToRemove.user.email} has been removed` });
        setMemberToRemove(null);
        fetchMembers();
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'Failed to remove member', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'An unexpected error occurred', variant: 'destructive' });
    } finally {
      setRemoving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>;

  return (
    <>
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="font-semibold">Team Members</h4>
            <p className="text-sm text-muted-foreground">{members.length} member{members.length !== 1 ? 's' : ''}</p>
          </div>
          <Button size="sm" onClick={() => setShowInvite(!showInvite)}>
            {showInvite ? <><X className="h-4 w-4 mr-1" /> Cancel</> : <><Plus className="h-4 w-4 mr-1" /> Add Member</>}
          </Button>
        </div>

        {showInvite && (
          <form onSubmit={handleInvite} className="mb-6 p-4 rounded-lg border bg-muted/30 space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="invFirstName">First Name *</Label>
                <Input id="invFirstName" required value={inviteForm.firstName} onChange={(e) => setInviteForm({ ...inviteForm, firstName: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="invLastName">Last Name *</Label>
                <Input id="invLastName" required value={inviteForm.lastName} onChange={(e) => setInviteForm({ ...inviteForm, lastName: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="invEmail">Email *</Label>
                <Input id="invEmail" type="email" required value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="invRole">Role *</Label>
                <select id="invRole" required value={inviteForm.role} onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })} className="w-full h-9 rounded-md border bg-background px-3 text-sm">
                  <option value="">Select role</option>
                  <option value="tpa_admin">Admin</option>
                  <option value="tpa_staff">Staff</option>
                  <option value="tpa_records">Records</option>
                  <option value="tpa_billing">Billing</option>
                  <option value="collector">Collector</option>
                </select>
              </div>
            </div>
            <Button type="submit" size="sm" disabled={inviting}>
              {inviting ? 'Sending...' : 'Send Invitation'}
            </Button>
          </form>
        )}

        <div className="space-y-2">
          {members.map((member) => {
            const initials = member.user.name
              ? member.user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
              : member.user.email[0].toUpperCase();
            const isSelf = member.userId === currentUserId;

            return (
              <div key={member.id} className="flex items-center gap-3 p-3 rounded-md border">
                <div className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 text-primary text-sm font-semibold shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {member.user.name || member.user.email}
                    </span>
                    <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${roleColors[member.role] || ''}`}>
                      {roleLabels[member.role] || member.role}
                    </Badge>
                    {isSelf && <Badge variant="outline" className="text-[10px] px-1.5 py-0">You</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{member.user.email}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] text-muted-foreground">
                    {member.user.lastLoginAt
                      ? `Last login ${new Date(member.user.lastLoginAt).toLocaleDateString()}`
                      : 'Never logged in'}
                  </p>
                </div>
                {!isSelf && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-500" onClick={() => setMemberToRemove(member)}>
                    <UserMinus className="h-4 w-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <AlertDialog open={!!memberToRemove} onOpenChange={() => setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{memberToRemove?.user.name || memberToRemove?.user.email}</strong>? They will lose access to this organization.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove} disabled={removing} className="bg-red-600 hover:bg-red-700">
              {removing ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
