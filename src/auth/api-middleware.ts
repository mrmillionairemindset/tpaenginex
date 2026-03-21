import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from './get-user';
import { hasPermission, roleHasPermission, type Permission, type UserRole } from './rbac';

export type AuthenticatedUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/**
 * Protect API routes with authentication
 */
export function withAuth(
  handler: (req: NextRequest, user: AuthenticatedUser, context?: any) => Promise<Response>
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
 */
export function withPermission(
  permission: Permission,
  handler: (req: NextRequest, user: AuthenticatedUser) => Promise<Response>
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
 * Protect API routes — require TPA staff (any tpa_* role)
 */
export function withTpaAuth(
  handler: (req: NextRequest, user: AuthenticatedUser) => Promise<Response>
) {
  return async (req: NextRequest, context?: any) => {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }

    const role = user.role as UserRole;
    const isTpa = role?.startsWith('tpa_') || role === 'platform_admin';

    if (!isTpa) {
      return NextResponse.json(
        { error: 'Forbidden: TPA access only' },
        { status: 403 }
      );
    }

    return handler(req, user);
  };
}

/**
 * Protect API routes — require client portal user
 */
export function withClientAuth(
  handler: (req: NextRequest, user: AuthenticatedUser) => Promise<Response>
) {
  return async (req: NextRequest, context?: any) => {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }

    if (user.role !== 'client_admin' && user.role !== 'platform_admin') {
      return NextResponse.json(
        { error: 'Forbidden: Client access only' },
        { status: 403 }
      );
    }

    return handler(req, user);
  };
}

/**
 * Protect API routes — require admin (tpa_admin or platform_admin)
 */
export function withAdminAuth(
  handler: (req: NextRequest, user: AuthenticatedUser) => Promise<Response>
) {
  return async (req: NextRequest, context?: any) => {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }

    const isAdmin = user.role === 'tpa_admin' || user.role === 'platform_admin';

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

/**
 * Protect API routes — require platform admin only
 */
export function withPlatformAuth(
  handler: (req: NextRequest, user: AuthenticatedUser, context?: any) => Promise<Response>
) {
  return async (req: NextRequest, context?: any) => {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }

    if (user.role !== 'platform_admin') {
      return NextResponse.json(
        { error: 'Forbidden: Platform admin access only' },
        { status: 403 }
      );
    }

    return handler(req, user, context);
  };
}
