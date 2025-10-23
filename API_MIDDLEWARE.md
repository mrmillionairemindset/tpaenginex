# API Route Protection Middleware

## Overview

The platform provides several middleware functions to protect API routes with authentication and authorization checks. These replace the need for Clerk's built-in middleware while providing the same functionality.

## Available Middleware

### 1. `withAuth` - Basic Authentication

Requires user to be authenticated. Use for any protected endpoint.

```typescript
import { withAuth } from '@/auth/api-middleware';

export const GET = withAuth(async (req, user) => {
  // user is guaranteed to be authenticated
  return NextResponse.json({
    message: `Hello ${user.email}`
  });
});
```

### 2. `withPermission` - Role-Based Access

Requires user to have a specific permission.

```typescript
import { withPermission } from '@/auth/api-middleware';

export const POST = withPermission('create_orders', async (req, user) => {
  // user has 'create_orders' permission
  return NextResponse.json({ success: true });
});
```

**Available Permissions:**
- `view_orders` - View orders (all roles except employer_user get this)
- `create_orders` - Create new orders (employer_admin only)
- `assign_sites` - Assign testing sites to orders (provider_admin, provider_agent)
- `manage_sites` - Manage site configurations (provider_admin only)
- `upload_results` - Upload test results (provider_admin, provider_agent)
- `manage_users` - Invite/manage users (employer_admin, provider_admin)

### 3. `withEmployerAuth` - Employer-Only Access

Requires user to be from an employer organization.

```typescript
import { withEmployerAuth } from '@/auth/api-middleware';

export const GET = withEmployerAuth(async (req, user) => {
  // user.organization.type === 'employer'
  return NextResponse.json({ orders: [...] });
});
```

### 4. `withProviderAuth` - Provider-Only Access

Requires user to be from a provider organization.

```typescript
import { withProviderAuth } from '@/auth/api-middleware';

export const POST = withProviderAuth(async (req, user) => {
  // user.organization.type === 'provider'
  return NextResponse.json({ sites: [...] });
});
```

### 5. `withAdminAuth` - Admin-Only Access

Requires user to be an admin (employer_admin or provider_admin).

```typescript
import { withAdminAuth } from '@/auth/api-middleware';

export const DELETE = withAdminAuth(async (req, user) => {
  // user.role === 'employer_admin' || 'provider_admin'
  return NextResponse.json({ success: true });
});
```

## User Object

All middleware functions provide a `user` object with the following shape:

```typescript
{
  id: string;              // Database user ID
  email: string;           // User's email
  name: string | null;     // User's name
  role: UserRole;          // 'employer_admin' | 'employer_user' | 'provider_admin' | 'provider_agent'
  orgId: string;           // Active organization ID
  organization: {
    id: string;
    name: string;
    type: 'employer' | 'provider';
  }
}
```

## Error Responses

### 401 Unauthorized
User is not authenticated (no valid session).

```json
{
  "error": "Unauthorized: Authentication required"
}
```

### 403 Forbidden
User is authenticated but lacks required permission.

```json
{
  "error": "Forbidden: Insufficient permissions",
  "required": "create_orders",
  "userRole": "employer_user"
}
```

## Examples

### Protected Order Creation

```typescript
// src/app/api/orders/route.ts
import { NextResponse } from 'next/server';
import { withPermission } from '@/auth/api-middleware';
import { db } from '@/db/client';
import { orders } from '@/db/schema';

export const POST = withPermission('create_orders', async (req, user) => {
  const body = await req.json();

  // Create order for user's organization
  const [order] = await db.insert(orders).values({
    ...body,
    orgId: user.orgId,
    requestedBy: user.id,
  }).returning();

  return NextResponse.json({ order }, { status: 201 });
});
```

### Multi-Method Protection

```typescript
// src/app/api/sites/route.ts
import { withProviderAuth, withAdminAuth } from '@/auth/api-middleware';

// Providers can view sites
export const GET = withProviderAuth(async (req, user) => {
  const sites = await db.query.sites.findMany();
  return NextResponse.json({ sites });
});

// Only provider admins can create sites
export const POST = withAdminAuth(async (req, user) => {
  if (user.organization.type !== 'provider') {
    return NextResponse.json(
      { error: 'Only provider admins can create sites' },
      { status: 403 }
    );
  }

  const body = await req.json();
  const [site] = await db.insert(sites).values(body).returning();

  return NextResponse.json({ site }, { status: 201 });
});
```

### Dynamic Route Protection

```typescript
// src/app/api/orders/[id]/route.ts
import { withAuth } from '@/auth/api-middleware';

export const GET = withAuth(async (req, user, { params }: { params: { id: string } }) => {
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, params.id),
  });

  // Ensure user can only access orders from their org
  if (order.orgId !== user.orgId) {
    return NextResponse.json(
      { error: 'Order not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({ order });
});
```

## Testing

Test API endpoint at `/api/test-auth`:

```bash
# Test basic auth (requires authentication)
curl http://localhost:3001/api/test-auth

# Test permission check (requires 'create_orders' permission)
curl -X POST http://localhost:3001/api/test-auth

# Test admin access (requires admin role)
curl -X DELETE http://localhost:3001/api/test-auth
```

## Migration from Manual Auth Checks

**Before:**
```typescript
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ... rest of handler
}
```

**After:**
```typescript
export const GET = withAuth(async (req, user) => {
  // user is guaranteed to exist
  // ... rest of handler
});
```

## Files

- `/src/auth/api-middleware.ts` - Middleware implementations
- `/src/auth/rbac.ts` - Permission definitions
- `/src/auth/get-user.ts` - User context helper
- `/src/auth/index.ts` - Exports all auth utilities
