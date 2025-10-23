# NextAuth.js Quick Reference Guide

This guide provides quick examples of common auth patterns in the RapidScreen platform.

## Table of Contents
- [Authentication Basics](#authentication-basics)
- [Protecting Pages](#protecting-pages)
- [Protecting API Routes](#protecting-api-routes)
- [Getting User Data](#getting-user-data)
- [Role-Based Access Control](#role-based-access-control)
- [Client-Side Auth](#client-side-auth)

---

## Authentication Basics

### Sign In
```typescript
import { signIn } from "next-auth/react";

await signIn("credentials", {
  email: "user@example.com",
  password: "password123",
  redirect: false,
});
```

### Sign Out
```typescript
import { signOut } from "next-auth/react";

await signOut({ callbackUrl: "/" });
```

### Check Auth Status (Server)
```typescript
import { auth } from "@/auth";

const session = await auth();
const isAuthenticated = !!session?.user;
```

### Check Auth Status (Client)
```typescript
"use client";
import { useSession } from "next-auth/react";

const { data: session, status } = useSession();
const isAuthenticated = status === "authenticated";
```

---

## Protecting Pages

### Server Component (Recommended)
```typescript
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function ProtectedPage() {
  const session = await auth();

  if (!session) {
    redirect("/auth/signin");
  }

  return <div>Protected content for {session.user.email}</div>;
}
```

### Client Component
```typescript
"use client";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";

export default function ProtectedPage() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() {
      redirect("/auth/signin");
    },
  });

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  return <div>Protected content</div>;
}
```

---

## Protecting API Routes

### Basic Auth Protection
```typescript
import { auth } from "@/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ data: "Protected data" });
}
```

### Using Helper (Recommended)
```typescript
import { withAuth } from "@/auth/middleware";

export const GET = withAuth(async (req, user) => {
  // user is guaranteed to exist here
  return NextResponse.json({
    message: `Hello ${user.name}`
  });
});
```

---

## Getting User Data

### Server Component
```typescript
import { getCurrentUser } from "@/auth/get-user";

export default async function UserProfile() {
  const user = await getCurrentUser();

  if (!user) {
    return <div>Not logged in</div>;
  }

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
      <p>Role: {user.role}</p>
      <p>Organization: {user.organization?.name}</p>
    </div>
  );
}
```

### API Route
```typescript
import { getCurrentUser } from "@/auth/get-user";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    id: user.id,
    email: user.email,
    role: user.role,
    orgId: user.orgId,
  });
}
```

### Client Component
```typescript
"use client";
import { useSession } from "next-auth/react";

export default function UserInfo() {
  const { data: session } = useSession();

  return (
    <div>
      <p>Email: {session?.user?.email}</p>
      <p>Role: {session?.user?.role}</p>
      <p>Org ID: {session?.user?.orgId}</p>
    </div>
  );
}
```

---

## Role-Based Access Control

### Check Permissions (Server)
```typescript
import { hasPermission, requirePermission } from "@/auth/rbac";

// Check permission
const canCreateOrders = await hasPermission("create_orders");
if (canCreateOrders) {
  // Allow action
}

// Require permission (throws if unauthorized)
await requirePermission("manage_users");
```

### Check Role Type
```typescript
import { isProvider, isEmployer } from "@/auth/rbac";

const isProviderUser = await isProvider();
const isEmployerUser = await isEmployer();
```

### Protected API Route with Permission
```typescript
import { withPermission } from "@/auth/middleware";

export const POST = withPermission("create_orders", async (req, user) => {
  // User is guaranteed to have 'create_orders' permission
  // Create order logic here
  return NextResponse.json({ success: true });
});
```

### Conditional Rendering Based on Role
```typescript
import { getCurrentUserRole } from "@/auth/rbac";

export default async function AdminPanel() {
  const role = await getCurrentUserRole();

  const isAdmin = role === "employer_admin" || role === "provider_admin";

  if (!isAdmin) {
    return <div>Access denied</div>;
  }

  return <div>Admin controls</div>;
}
```

---

## Client-Side Auth

### Session Hook
```typescript
"use client";
import { useSession } from "next-auth/react";

export default function UserGreeting() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  if (status === "unauthenticated") {
    return <div>Please sign in</div>;
  }

  return <div>Hello, {session.user.name}!</div>;
}
```

### Conditional Rendering
```typescript
"use client";
import { useSession } from "next-auth/react";

export default function Navigation() {
  const { data: session } = useSession();

  return (
    <nav>
      {session ? (
        <>
          <Link href="/dashboard">Dashboard</Link>
          <button onClick={() => signOut()}>Sign Out</button>
        </>
      ) : (
        <Link href="/auth/signin">Sign In</Link>
      )}
    </nav>
  );
}
```

---

## Available Permissions

The platform defines these permissions:

- `view_orders` - View order list
- `create_orders` - Create new orders
- `assign_sites` - Assign testing sites to orders
- `manage_sites` - Full site management
- `upload_results` - Upload test results
- `manage_users` - User management

### Role-Permission Matrix

| Permission | Employer Admin | Employer User | Provider Admin | Provider Agent |
|------------|---------------|---------------|----------------|----------------|
| view_orders | ✅ | ✅ | ✅ | ✅ |
| create_orders | ✅ | ❌ | ❌ | ❌ |
| assign_sites | ❌ | ❌ | ✅ | ✅ |
| manage_sites | ❌ | ❌ | ✅ | ❌ |
| upload_results | ❌ | ❌ | ✅ | ✅ |
| manage_users | ✅ | ❌ | ✅ | ❌ |

---

## Common Patterns

### Redirect After Sign In
```typescript
const result = await signIn("credentials", {
  email,
  password,
  callbackUrl: "/dashboard",
});
```

### Protected API with Org Filtering
```typescript
export const GET = withAuth(async (req, user) => {
  // Automatically filter by user's organization
  const orders = await db.query.orders.findMany({
    where: eq(orders.orgId, user.orgId),
  });

  return NextResponse.json({ orders });
});
```

### Multi-Level Protection (Auth + Permission)
```typescript
import { getCurrentUser } from "@/auth/get-user";
import { requirePermission } from "@/auth/rbac";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/signin");
  }

  try {
    await requirePermission("manage_users");
  } catch {
    redirect("/dashboard"); // Redirect if insufficient permissions
  }

  return <div>Admin-only content</div>;
}
```

---

## Environment Variables Required

```bash
NEXTAUTH_URL=http://localhost:3002
NEXTAUTH_SECRET=your-secret-key-here
DATABASE_URL=postgresql://...
```

---

## Useful Links

- [NextAuth.js v5 Docs](https://authjs.dev/getting-started/introduction)
- [Session Management](https://authjs.dev/reference/nextjs#auth)
- [Callbacks](https://authjs.dev/reference/core/types#callbacks)
