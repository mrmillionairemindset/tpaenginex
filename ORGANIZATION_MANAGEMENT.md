# Organization Management System

## Overview

Complete organization management and switching system for the RapidScreen Platform. Users can switch between organizations, create new organizations, invite team members, and manage organization settings.

## Features

### ✅ Organization Switcher
- Dropdown component in the header
- Shows current organization
- Quick switching between organizations (when user belongs to multiple)
- Create new organization button

### ✅ Organization Creation
- Dedicated page at `/organizations/new`
- Choose organization type (Employer or Provider)
- Automatic slug generation from name
- Immediate switch to new organization after creation

### ✅ Organization Settings
- Admin-only access at `/organizations/settings`
- Three tabs: General, Members, Invitations
- Update organization name
- View organization type and slug

### ✅ User Invitations
- Invite users by email
- Assign roles (Admin or User/Agent based on org type)
- Automatic user creation with temporary password
- Role-based access control

## API Routes

### GET /api/organizations
Get list of organizations for current user

### POST /api/organizations
Create new organization
```json
{
  "name": "Acme Corp",
  "type": "employer"  // or "provider"
}
```

### PATCH /api/organizations/[id]
Update organization (admins only)
```json
{
  "name": "New Name"
}
```

### POST /api/users/switch-org
Switch user's active organization
```json
{
  "orgId": "org-uuid"
}
```

### POST /api/invitations
Invite new user to organization
```json
{
  "email": "user@example.com",
  "role": "employer_admin",  // or provider_admin, employer_user, provider_agent
  "orgId": "org-uuid"
}
```

## Components

### OrganizationSwitcher
```tsx
import { OrganizationSwitcher } from '@/components/organization-switcher';

<OrganizationSwitcher currentOrg={user.organization} />
```

### OrganizationSettings
```tsx
import { OrganizationSettings } from '@/components/organization-settings';

<OrganizationSettings organization={org} currentUser={user} />
```

## Pages

- `/organizations/new` - Create new organization
- `/organizations/settings` - Manage organization (admin only)

## Roles & Permissions

### Employer Organization
- **employer_admin** - Full access, can invite users, manage settings
- **employer_user** - Read-only access

### Provider Organization
- **provider_admin** - Full access, can invite users, manage settings
- **provider_agent** - Limited access, cannot manage users

## Usage Flow

### Creating Organization
1. User clicks "Create organization" in switcher dropdown
2. Redirected to `/organizations/new`
3. Fills in name and selects type
4. Organization created and user automatically switched to it
5. Redirected to dashboard

### Inviting Users
1. Admin navigates to `/organizations/settings`
2. Clicks "Invitations" tab
3. Enters email and selects role
4. User created with temporary password
5. In development, temp password shown in response (remove in production!)
6. TODO: Send invitation email instead

### Switching Organizations
1. User clicks organization switcher in header
2. Dropdown shows current and available organizations
3. Clicks different organization
4. API call to switch
5. Page refreshes with new organization context

## Security

- ✅ Only authenticated users can access org management
- ✅ Only admins can update organization settings
- ✅ Only admins can invite users
- ✅ Users can only invite to their own organization
- ✅ Middleware protects all routes
- ✅ Row-level filtering by orgId in queries

## Testing

### Test the Organization System

1. **Sign in** as `employer-admin@example.com` / `password123`
2. **View current org** in header (should show "Acme Corp")
3. **Create new org**:
   - Click org switcher → "Create organization"
   - Name: "Test Company"
   - Type: Employer
   - Submit
4. **Invite user**:
   - Go to `/organizations/settings`
   - Click "Invitations" tab
   - Email: `newuser@example.com`
   - Role: Admin
   - Submit
   - Note the temporary password shown
5. **Sign out** and sign in with new user
6. **Verify** new user is in the correct organization

## Multi-Organization Support ✅

Users can now belong to multiple organizations and switch between them:

### Implementation

1. **Junction Table**: `organizationMembers` table for many-to-many relationships
2. **User Memberships**: Each user can have memberships in multiple orgs with different roles
3. **Active Organization**: User's `orgId` field tracks their currently active organization
4. **Organization Switcher**: Fetches all user's organizations and allows switching

### Migration

For existing databases with users:
```bash
npx tsx src/db/migrate-org-members.ts
```

This populates the `organizationMembers` table with existing user-organization relationships.

### Schema Changes

- Added `organizationMembers` junction table with:
  - `userId` - Reference to users
  - `organizationId` - Reference to organizations
  - `role` - User's role in this organization
  - `invitedBy` - Who invited them
  - `isActive` - Whether membership is active

### API Updates

- `GET /api/organizations` - Now returns all organizations user belongs to (via junction table)
- `POST /api/organizations` - Creates org AND organizationMembers entry
- `POST /api/invitations` - Creates user AND organizationMembers entry

## Future Enhancements

- [ ] Email invitation system (replace temp passwords)
- [x] Multi-organization membership (users in multiple orgs) ✅
- [ ] Organization member list in settings
- [ ] Remove users from organization
- [ ] Transfer organization ownership
- [ ] Organization branding (logo, colors)
- [ ] Audit log for organization changes
- [ ] Invite existing users to additional organizations

## Files Created

### API Routes
- `src/app/api/organizations/route.ts`
- `src/app/api/organizations/[id]/route.ts`
- `src/app/api/users/switch-org/route.ts`
- `src/app/api/invitations/route.ts`

### Components
- `src/components/organization-switcher.tsx`
- `src/components/organization-settings.tsx`

### Pages
- `src/app/organizations/new/page.tsx`
- `src/app/organizations/settings/page.tsx`

### Updated
- `src/app/page.tsx` - Added OrganizationSwitcher to header
- `src/db/schema.ts` - Added organizationMembers junction table
- `src/db/client.ts` - Added dotenv support for standalone scripts
- `src/db/seed-nextauth.ts` - Creates organizationMembers entries

### Migration Scripts
- `src/db/migrate-org-members.ts` - Populates organizationMembers for existing users

## Notes

- Current implementation uses temporary passwords for invites
- In production, replace with email invitation flow
- Organization slug is auto-generated from name
- Users can belong to multiple organizations ✅
- All organization data is multi-tenant safe (filtered by orgId)
- User's `orgId` field tracks their currently active organization
