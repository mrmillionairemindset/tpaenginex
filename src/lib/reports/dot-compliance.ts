import { db } from '@/db';
import { orders } from '@/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';

export interface DotComplianceParams {
  tpaOrgId: string | null;
  startDate: string;
  endDate: string;
  clientOrgId?: string | null;
}

export interface DotComplianceSummary {
  totalTests: number;
  completed: number;
  pending: number;
  cancelled: number;
  passRate: number;
  avgCompletionDays: number;
}

export interface DotComplianceClientRow {
  clientId: string;
  clientName: string;
  totalTests: number;
  completed: number;
  pending: number;
  cancelled: number;
  passRate: number;
  randomPoolSize: number;
  randomTestsRequired: number;
  randomTestsCompleted: number;
}

export interface DotComplianceReport {
  period: { start: string; end: string };
  generatedAt: string;
  summary: DotComplianceSummary;
  byClient: DotComplianceClientRow[];
}

export async function generateDotComplianceReport(
  params: DotComplianceParams
): Promise<DotComplianceReport> {
  const { tpaOrgId, startDate, endDate, clientOrgId } = params;

  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const baseConditions = [
    eq(orders.isDOT, true),
    gte(orders.createdAt, start),
    lte(orders.createdAt, end),
  ];

  if (tpaOrgId) {
    baseConditions.push(eq(orders.tpaOrgId, tpaOrgId));
  }

  if (clientOrgId) {
    baseConditions.push(eq(orders.clientOrgId, clientOrgId));
  }

  const whereClause = and(...baseConditions);

  const dotOrders = await db.query.orders.findMany({
    where: whereClause,
    columns: {
      id: true,
      clientOrgId: true,
      status: true,
      resultStatus: true,
      serviceType: true,
      createdAt: true,
      completedAt: true,
    },
    with: {
      clientOrg: {
        columns: { id: true, name: true },
      },
    },
  });

  const totalTests = dotOrders.length;
  const completed = dotOrders.filter((o) => o.status === 'complete').length;
  const pending = dotOrders.filter(
    (o) => !['complete', 'cancelled'].includes(o.status)
  ).length;
  const cancelled = dotOrders.filter((o) => o.status === 'cancelled').length;

  const ordersWithResults = dotOrders.filter(
    (o) => o.resultStatus && o.resultStatus !== 'pending'
  );
  const passedOrders = ordersWithResults.filter(
    (o) => o.resultStatus === 'negative' || o.resultStatus === 'pass'
  );
  const passRate =
    ordersWithResults.length > 0
      ? Math.round((passedOrders.length / ordersWithResults.length) * 1000) / 10
      : 0;

  const completedOrders = dotOrders.filter(
    (o) => o.status === 'complete' && o.completedAt && o.createdAt
  );
  let avgCompletionDays = 0;
  if (completedOrders.length > 0) {
    const totalMs = completedOrders.reduce((sum, o) => {
      const diff =
        new Date(o.completedAt!).getTime() - new Date(o.createdAt).getTime();
      return sum + diff;
    }, 0);
    avgCompletionDays =
      Math.round((totalMs / completedOrders.length / (1000 * 60 * 60 * 24)) * 10) /
      10;
  }

  const clientMap = new Map<
    string,
    {
      clientId: string;
      clientName: string;
      totalTests: number;
      completed: number;
      pending: number;
      cancelled: number;
      passCount: number;
      resultsCount: number;
      randomTotal: number;
      randomCompleted: number;
    }
  >();

  for (const order of dotOrders) {
    const cId = order.clientOrgId || 'unknown';
    const cName = order.clientOrg?.name || 'Unknown Client';

    if (!clientMap.has(cId)) {
      clientMap.set(cId, {
        clientId: cId,
        clientName: cName,
        totalTests: 0,
        completed: 0,
        pending: 0,
        cancelled: 0,
        passCount: 0,
        resultsCount: 0,
        randomTotal: 0,
        randomCompleted: 0,
      });
    }

    const entry = clientMap.get(cId)!;
    entry.totalTests++;

    if (order.status === 'complete') entry.completed++;
    else if (order.status === 'cancelled') entry.cancelled++;
    else entry.pending++;

    if (order.resultStatus && order.resultStatus !== 'pending') {
      entry.resultsCount++;
      if (order.resultStatus === 'negative' || order.resultStatus === 'pass') {
        entry.passCount++;
      }
    }

    if (order.serviceType === 'random') {
      entry.randomTotal++;
      if (order.status === 'complete') entry.randomCompleted++;
    }
  }

  const byClient: DotComplianceClientRow[] = Array.from(clientMap.values())
    .map((c) => ({
      clientId: c.clientId,
      clientName: c.clientName,
      totalTests: c.totalTests,
      completed: c.completed,
      pending: c.pending,
      cancelled: c.cancelled,
      passRate:
        c.resultsCount > 0
          ? Math.round((c.passCount / c.resultsCount) * 1000) / 10
          : 0,
      randomPoolSize: 0,
      randomTestsRequired: 0,
      randomTestsCompleted: c.randomCompleted,
    }))
    .sort((a, b) => b.totalTests - a.totalTests);

  return {
    period: { start: startDate, end: endDate },
    generatedAt: new Date().toISOString(),
    summary: {
      totalTests,
      completed,
      pending,
      cancelled,
      passRate,
      avgCompletionDays,
    },
    byClient,
  };
}
