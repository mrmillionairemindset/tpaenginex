import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/auth/get-user';
import { db } from '@/db';
import { orders, candidates, organizations } from '@/db/schema';
import { eq, and, gte, count } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isEmployer = user.role?.startsWith('employer');
    const orgId = user.orgId;

    // Get start of current month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    if (isEmployer) {
      // Employer stats
      const [
        totalOrdersResult,
        completedOrdersResult,
        thisMonthOrdersResult,
        activeCandidatesResult,
      ] = await Promise.all([
        // Total orders
        db
          .select({ count: count() })
          .from(orders)
          .where(eq(orders.orgId, orgId)),

        // Completed orders
        db
          .select({ count: count() })
          .from(orders)
          .where(
            and(
              eq(orders.orgId, orgId),
              eq(orders.status, 'complete')
            )
          ),

        // This month orders
        db
          .select({ count: count() })
          .from(orders)
          .where(
            and(
              eq(orders.orgId, orgId),
              gte(orders.createdAt, startOfMonth)
            )
          ),

        // Active candidates (candidates with at least one order)
        db
          .select({ count: count() })
          .from(candidates)
          .where(eq(candidates.orgId, orgId)),
      ]);

      return NextResponse.json({
        stats: {
          totalOrders: totalOrdersResult[0]?.count || 0,
          completedOrders: completedOrdersResult[0]?.count || 0,
          pendingOrders: 0, // Not used for employers
          thisMonthOrders: thisMonthOrdersResult[0]?.count || 0,
          activeCandidates: activeCandidatesResult[0]?.count || 0,
        },
      });
    } else {
      // Provider stats - see all orders across all organizations
      const [
        totalOrdersResult,
        completedOrdersResult,
        pendingOrdersResult,
        thisMonthOrdersResult,
        totalOrganizationsResult,
      ] = await Promise.all([
        // Total orders
        db.select({ count: count() }).from(orders),

        // Completed orders
        db
          .select({ count: count() })
          .from(orders)
          .where(eq(orders.status, 'complete')),

        // Pending orders (not complete or cancelled)
        db
          .select({ count: count() })
          .from(orders)
          .where(
            and(
              eq(orders.status, 'new'),
            )
          ),

        // This month orders
        db
          .select({ count: count() })
          .from(orders)
          .where(gte(orders.createdAt, startOfMonth)),

        // Total employer organizations
        db
          .select({ count: count() })
          .from(organizations)
          .where(eq(organizations.type, 'employer')),
      ]);

      return NextResponse.json({
        stats: {
          totalOrders: totalOrdersResult[0]?.count || 0,
          completedOrders: completedOrdersResult[0]?.count || 0,
          pendingOrders: pendingOrdersResult[0]?.count || 0,
          thisMonthOrders: thisMonthOrdersResult[0]?.count || 0,
          totalOrganizations: totalOrganizationsResult[0]?.count || 0,
        },
      });
    }
  } catch (error) {
    console.error('Failed to fetch dashboard stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
