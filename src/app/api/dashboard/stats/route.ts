import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/auth/get-user';
import { db } from '@/db';
import { orders, candidates, organizations, events, invoices, collectors, leads } from '@/db/schema';
import { eq, and, gte, ne, count } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isClient = user.role === 'client_admin';
    const tpaOrgId = user.tpaOrgId;
    const orgId = user.orgId;

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const now = new Date();

    if (isClient) {
      const [totalResult, completedResult, monthResult, candidateResult] = await Promise.all([
        db.select({ count: count() }).from(orders).where(eq(orders.orgId, orgId!)),
        db.select({ count: count() }).from(orders).where(and(eq(orders.orgId, orgId!), eq(orders.status, 'complete'))),
        db.select({ count: count() }).from(orders).where(and(eq(orders.orgId, orgId!), gte(orders.createdAt, startOfMonth))),
        db.select({ count: count() }).from(candidates).where(eq(candidates.orgId, orgId!)),
      ]);

      return NextResponse.json({
        stats: {
          totalOrders: totalResult[0]?.count || 0,
          completedOrders: completedResult[0]?.count || 0,
          thisMonthOrders: monthResult[0]?.count || 0,
          activeCandidates: candidateResult[0]?.count || 0,
        },
      });
    } else if (tpaOrgId) {
      const [
        openOrdersResult,
        eventsThisWeekResult,
        pendingResultsResult,
        billingQueueResult,
        activeCollectorsResult,
        openLeadsResult,
        totalOrdersResult,
        completedOrdersResult,
        thisMonthOrdersResult,
        totalClientsResult,
      ] = await Promise.all([
        db.select({ count: count() }).from(orders).where(
          and(eq(orders.tpaOrgId, tpaOrgId), ne(orders.status, 'complete'), ne(orders.status, 'cancelled'))
        ),
        db.select({ count: count() }).from(events).where(
          and(eq(events.tpaOrgId, tpaOrgId), gte(events.scheduledDate, now))
        ),
        db.select({ count: count() }).from(orders).where(
          and(eq(orders.tpaOrgId, tpaOrgId), eq(orders.resultStatus, 'pending'), eq(orders.status, 'in_progress'))
        ),
        db.select({ count: count() }).from(invoices).where(
          and(eq(invoices.tpaOrgId, tpaOrgId), eq(invoices.status, 'pending'))
        ),
        db.select({ count: count() }).from(collectors).where(
          and(eq(collectors.tpaOrgId, tpaOrgId), eq(collectors.isAvailable, true), eq(collectors.isActive, true))
        ),
        db.select({ count: count() }).from(leads).where(
          and(eq(leads.tpaOrgId, tpaOrgId), ne(leads.stage, 'closed_won'), ne(leads.stage, 'closed_lost'))
        ),
        db.select({ count: count() }).from(orders).where(eq(orders.tpaOrgId, tpaOrgId)),
        db.select({ count: count() }).from(orders).where(
          and(eq(orders.tpaOrgId, tpaOrgId), eq(orders.status, 'complete'))
        ),
        db.select({ count: count() }).from(orders).where(
          and(eq(orders.tpaOrgId, tpaOrgId), gte(orders.createdAt, startOfMonth))
        ),
        db.select({ count: count() }).from(organizations).where(
          and(eq(organizations.type, 'client'), eq(organizations.tpaOrgId, tpaOrgId))
        ),
      ]);

      return NextResponse.json({
        stats: {
          totalOrders: totalOrdersResult[0]?.count || 0,
          completedOrders: completedOrdersResult[0]?.count || 0,
          openOrders: openOrdersResult[0]?.count || 0,
          thisMonthOrders: thisMonthOrdersResult[0]?.count || 0,
          eventsThisWeek: eventsThisWeekResult[0]?.count || 0,
          pendingResults: pendingResultsResult[0]?.count || 0,
          billingQueue: billingQueueResult[0]?.count || 0,
          activeCollectors: activeCollectorsResult[0]?.count || 0,
          openLeads: openLeadsResult[0]?.count || 0,
          totalClients: totalClientsResult[0]?.count || 0,
        },
      });
    } else {
      const [totalOrders, totalTpas, totalClients] = await Promise.all([
        db.select({ count: count() }).from(orders),
        db.select({ count: count() }).from(organizations).where(eq(organizations.type, 'tpa')),
        db.select({ count: count() }).from(organizations).where(eq(organizations.type, 'client')),
      ]);

      return NextResponse.json({
        stats: {
          totalOrders: totalOrders[0]?.count || 0,
          totalTpas: totalTpas[0]?.count || 0,
          totalClients: totalClients[0]?.count || 0,
        },
      });
    }
  } catch (error) {
    console.error('Failed to fetch dashboard stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
