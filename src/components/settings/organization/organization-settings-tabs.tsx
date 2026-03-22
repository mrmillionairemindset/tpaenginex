'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GeneralTab } from './general-tab';
import { BrandingTab } from './branding-tab';
import { CommunicationsTab } from './communications-tab';
import { MembersTab } from './members-tab';
import { LocationsTab } from './locations-tab';
import { DangerZoneTab } from './danger-zone-tab';

interface OrganizationSettingsTabsProps {
  orgId: string;
  currentUserId: string;
  orgName: string;
}

export function OrganizationSettingsTabs({ orgId, currentUserId, orgName }: OrganizationSettingsTabsProps) {
  return (
    <Tabs defaultValue="general" className="space-y-6">
      <TabsList className="w-full justify-start overflow-x-auto">
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="branding">Branding</TabsTrigger>
        <TabsTrigger value="communications">Communications</TabsTrigger>
        <TabsTrigger value="members">Members</TabsTrigger>
        <TabsTrigger value="locations">Locations</TabsTrigger>
        <TabsTrigger value="danger" className="text-red-500 data-[state=active]:text-red-600">Danger Zone</TabsTrigger>
      </TabsList>

      <TabsContent value="general">
        <GeneralTab orgId={orgId} />
      </TabsContent>

      <TabsContent value="branding">
        <BrandingTab />
      </TabsContent>

      <TabsContent value="communications">
        <CommunicationsTab />
      </TabsContent>

      <TabsContent value="members">
        <MembersTab orgId={orgId} currentUserId={currentUserId} />
      </TabsContent>

      <TabsContent value="locations">
        <LocationsTab orgId={orgId} />
      </TabsContent>

      <TabsContent value="danger">
        <DangerZoneTab orgId={orgId} orgName={orgName} />
      </TabsContent>
    </Tabs>
  );
}
