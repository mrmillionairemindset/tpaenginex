# Edge Runtime Compatibility Fix

## The Problem

When using NextAuth.js v5 with middleware, we encountered Edge Runtime compatibility issues:

1. **dotenv with process.cwd()** - The database client was importing `dotenv` which uses `process.cwd()`, not supported in Edge Runtime
2. **bcrypt native module** - The `bcrypt` package (used for password hashing) is a Node.js native module that cannot run in Edge Runtime

## The Solution

We split the NextAuth configuration into **two separate files**:

### 1. `src/auth.config.ts` (Edge Runtime Compatible)
- Lightweight configuration for middleware
- **NO** database imports
- **NO** bcrypt imports
- **NO** Node.js-only modules
- Only contains JWT callbacks and route authorization logic

### 2. `src/auth.ts` (Node.js Runtime)
- Full NextAuth configuration with Drizzle adapter
- Includes Credentials provider with bcrypt password hashing
- Used by API routes and server components (Node.js runtime)
- Imports and extends `authConfig` from `auth.config.ts`

## File Structure

```
src/
├── auth.config.ts    # Edge-compatible (used in middleware)
├── auth.ts           # Node.js only (API routes & server components)
├── middleware.ts     # Uses auth.config.ts
└── db/
    └── client.ts     # Removed dotenv import
```

## Key Changes

### `src/auth.config.ts` (NEW FILE)
```typescript
import type { NextAuthConfig } from "next-auth";

// Edge-compatible config - NO Node.js dependencies
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/auth/signin", ... },
  callbacks: {
    authorized({ request, auth }) { ... },
    jwt({ token, user }) { ... },
    session({ session, token }) { ... },
  },
  providers: [], // Empty - providers added in full config
};
```

### `src/auth.ts`
```typescript
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcrypt"; // OK - runs in Node.js
import { authConfig } from "./auth.config"; // Import base config

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig, // Extend Edge-compatible config
  adapter: DrizzleAdapter(db, { ... }),
  providers: [
    Credentials({ /* bcrypt logic here */ }),
  ],
});
```

### `src/middleware.ts`
```typescript
import NextAuth from "next-auth";
import { authConfig } from "@/auth.config"; // Import Edge-compatible config

export const { auth: middleware } = NextAuth(authConfig);
```

### `src/db/client.ts`
```typescript
// Removed this:
// import { config } from 'dotenv';
// config({ path: '.env.local' });

// Next.js loads .env.local automatically, no need for dotenv
```

## Why This Works

1. **Middleware** (`src/middleware.ts`) runs in Edge Runtime
   - Only imports `auth.config.ts` (no Node.js dependencies)
   - Can perform auth checks and redirects efficiently

2. **API Routes & Server Components** use `src/auth.ts`
   - Run in Node.js runtime
   - Have full access to database, bcrypt, etc.
   - Can authenticate users with password hashing

3. **Shared Logic**
   - Both configs share the same JWT/session callbacks
   - Auth state is consistent across Edge and Node.js runtimes

## Benefits

✅ Middleware runs in fast Edge Runtime
✅ API routes have full Node.js capabilities
✅ No Edge Runtime errors
✅ Same auth behavior across all environments
✅ Clean separation of concerns

## Testing

Visit http://localhost:3001:
- Home page loads ✅
- Middleware protects routes ✅
- Auth API works (`/api/auth/session`) ✅
- Sign in/out functionality works ✅

## References

- [Next.js Edge Runtime](https://nextjs.org/docs/app/building-your-application/rendering/edge-and-nodejs-runtimes)
- [NextAuth.js v5 with Edge](https://authjs.dev/getting-started/migrating-to-v5#edge-compatibility)
