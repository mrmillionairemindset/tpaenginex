'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, Mail, Building2 } from 'lucide-react';

interface ProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    name: string | null;
    email: string;
    role: string | null;
    organization: {
      id: string;
      name: string;
      type: 'platform' | 'tpa' | 'client';
      slug: string;
    } | null;
  };
}

export function ProfileModal({ open, onOpenChange, user }: ProfileModalProps) {
  const [name, setName] = useState(user.name || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Profile updated successfully' });
        // Refresh the page to update the header
        setTimeout(() => window.location.reload(), 1000);
      } else {
        setMessage({ type: 'error', text: 'Failed to update profile' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred' });
    } finally {
      setSaving(false);
    }
  };

  const getRoleLabel = (role: string | null) => {
    if (!role) return 'No role assigned';
    const roleMap: Record<string, string> = {
      platform_admin: 'Platform Admin',
      tpa_admin: 'TPA Admin',
      tpa_staff: 'TPA Staff',
      tpa_records: 'TPA Records',
      tpa_billing: 'TPA Billing',
      client_admin: 'Client Admin',
    };
    return roleMap[role] || role;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Profile Settings</DialogTitle>
          <DialogDescription>
            Manage your personal information and account settings
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profile">
              <User className="mr-2 h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="account">
              <Building2 className="mr-2 h-4 w-4" />
              Account
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4 mt-4">
            {message && (
              <div
                className={`rounded-md p-3 text-sm ${
                  message.type === 'success'
                    ? 'bg-green-50 text-green-800'
                    : 'bg-red-50 text-red-800'
                }`}
              >
                {message.text}
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your full name"
                />
              </div>

              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={user.email}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Email cannot be changed
                </p>
              </div>

              <div>
                <Label htmlFor="role">Role</Label>
                <Input
                  id="role"
                  value={getRoleLabel(user.role)}
                  disabled
                  className="bg-muted"
                />
              </div>

              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="account" className="space-y-4 mt-4">
            {user.organization ? (
              <div className="space-y-4">
                <div>
                  <Label>Organization Name</Label>
                  <Input
                    value={user.organization.name}
                    disabled
                    className="bg-muted"
                  />
                </div>

                <div>
                  <Label>Organization Type</Label>
                  <Input
                    value={user.organization.type === 'tpa' ? 'TPA' : user.organization.type === 'client' ? 'Client' : 'Platform'}
                    disabled
                    className="bg-muted capitalize"
                  />
                </div>

                <div>
                  <Label>Organization Slug</Label>
                  <Input
                    value={user.organization.slug}
                    disabled
                    className="bg-muted"
                  />
                </div>

                <p className="text-xs text-muted-foreground">
                  Organization settings can only be changed by administrators
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                You are not currently associated with an organization
              </p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
