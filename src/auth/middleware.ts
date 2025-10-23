import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from './get-user';
import { hasPermission } from './rbac';

/**
 * Protect API routes with authentication
 */
export async function withAuth(
  handler: (req: NextRequest, user: Awaited<ReturnType<typeof getCurrentUser>>) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return handler(req, user);
  };
}

/**
 * Protect API routes with role-based permission
 */
export async function withPermission(
  permission: Parameters<typeof hasPermission>[0],
  handler: (req: NextRequest, user: Awaited<ReturnType<typeof getCurrentUser>>) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const allowed = await hasPermission(permission);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Forbidden: insufficient permissions' },
        { status: 403 }
      );
    }

    return handler(req, user);
  };
}
