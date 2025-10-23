import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from './get-user';
import { hasPermission } from './rbac';

export type AuthenticatedUser = Awaited<ReturnType<typeof getCurrentUser>>;

/**
 * Protect API routes with authentication
 *
 * Usage:
 * ```ts
 * export const GET = withAuth(async (req, user) => {
 *   return NextResponse.json({ message: `Hello ${user.email}` });
 * });
 * ```
 */
export function withAuth(
  handler: (req: NextRequest, user: NonNullable<AuthenticatedUser>, context?: any) => Promise<Response>
) {
  return async (req: NextRequest, context?: any) => {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }

    return handler(req, user, context);
  };
}

/**
 * Protect API routes with role-based permission
 *
 * Usage:
 * ```ts
 * export const POST = withPermission('create_orders', async (req, user) => {
 *   // Only users with create_orders permission can access this
 *   return NextResponse.json({ success: true });
 * });
 * ```
 */
export function withPermission(
  permission: Parameters<typeof hasPermission>[0],
  handler: (req: NextRequest, user: NonNullable<AuthenticatedUser>) => Promise<Response>
) {
  return async (req: NextRequest, context?: any) => {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }

    const allowed = await hasPermission(permission);
    if (!allowed) {
      return NextResponse.json(
        {
          error: 'Forbidden: Insufficient permissions',
          required: permission,
          userRole: user.role
        },
        { status: 403 }
      );
    }

    return handler(req, user);
  };
}

/**
 * Protect API routes - require user to be from an employer organization
 *
 * Usage:
 * ```ts
 * export const GET = withEmployerAuth(async (req, user) => {
 *   // Only employer users can access this
 *   return NextResponse.json({ orders: [...] });
 * });
 * ```
 */
export function withEmployerAuth(
  handler: (req: NextRequest, user: NonNullable<AuthenticatedUser>) => Promise<Response>
) {
  return async (req: NextRequest, context?: any) => {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }

    if (user.organization.type !== 'employer') {
      return NextResponse.json(
        { error: 'Forbidden: Employer access only' },
        { status: 403 }
      );
    }

    return handler(req, user);
  };
}

/**
 * Protect API routes - require user to be from a provider organization
 *
 * Usage:
 * ```ts
 * export const POST = withProviderAuth(async (req, user) => {
 *   // Only provider users can access this
 *   return NextResponse.json({ sites: [...] });
 * });
 * ```
 */
export function withProviderAuth(
  handler: (req: NextRequest, user: NonNullable<AuthenticatedUser>) => Promise<Response>
) {
  return async (req: NextRequest, context?: any) => {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }

    if (user.organization.type !== 'provider') {
      return NextResponse.json(
        { error: 'Forbidden: Provider access only' },
        { status: 403 }
      );
    }

    return handler(req, user);
  };
}

/**
 * Protect API routes - require user to be an admin (employer_admin or provider_admin)
 *
 * Usage:
 * ```ts
 * export const DELETE = withAdminAuth(async (req, user) => {
 *   // Only admins can access this
 *   return NextResponse.json({ success: true });
 * });
 * ```
 */
export function withAdminAuth(
  handler: (req: NextRequest, user: NonNullable<AuthenticatedUser>) => Promise<Response>
) {
  return async (req: NextRequest, context?: any) => {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }

    const isAdmin = user.role === 'employer_admin' || user.role === 'provider_admin';

    if (!isAdmin) {
      return NextResponse.json(
        {
          error: 'Forbidden: Admin access only',
          userRole: user.role
        },
        { status: 403 }
      );
    }

    return handler(req, user);
  };
}
