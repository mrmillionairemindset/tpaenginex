'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { OrganizationSettings } from '@/components/organization-settings';

interface OrganizationSettingsModalProps {
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
      type: 'employer' | 'provider';
      slug: string;
    } | null;
  };
}

export function OrganizationSettingsModal({
  open,
  onOpenChange,
  user
}: OrganizationSettingsModalProps) {
  if (!user.organization) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Organization Settings</DialogTitle>
          <DialogDescription>
            Manage your organization's information and members
          </DialogDescription>
        </DialogHeader>

        <OrganizationSettings
          organization={user.organization}
          currentUser={user}
        />
      </DialogContent>
    </Dialog>
  );
}
