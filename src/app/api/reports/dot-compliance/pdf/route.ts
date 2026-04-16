import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/auth/api-middleware';
import { db } from '@/db';
import { tpaSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateDotComplianceReport } from '@/lib/reports/dot-compliance';
import { generateDotCompliancePDF } from '@/lib/pdf';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// ============================================================================
// GET /api/reports/dot-compliance/pdf - Download DOT compliance report as PDF
// ============================================================================

export const GET = withAuth(async (req, user) => {
  const allowedRoles = ['tpa_admin', 'tpa_records', 'platform_admin'];
  if (!allowedRoles.includes(user.role ?? '')) {
    return NextResponse.json(
      { error: 'Forbidden: Insufficient permissions' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const clientOrgId = searchParams.get('clientOrgId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: 'startDate and endDate query parameters are required' },
      { status: 400 }
    );
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return NextResponse.json(
      { error: 'Invalid date format. Use ISO 8601 (YYYY-MM-DD).' },
      { status: 400 }
    );
  }

  const report = await generateDotComplianceReport({
    tpaOrgId: user.tpaOrgId ?? null,
    startDate,
    endDate,
    clientOrgId,
  });

  let tpaBrandName = 'TPA';
  if (user.tpaOrgId) {
    const settings = await db.query.tpaSettings.findFirst({
      where: eq(tpaSettings.tpaOrgId, user.tpaOrgId),
    });
    if (settings?.brandName) tpaBrandName = settings.brandName;
  }

  const pdfBuffer = await generateDotCompliancePDF({
    tpaBrandName,
    period: report.period,
    generatedAt: report.generatedAt,
    summary: report.summary,
    byClient: report.byClient.map((c) => ({
      clientName: c.clientName,
      totalTests: c.totalTests,
      completed: c.completed,
      pending: c.pending,
      passRate: c.passRate,
    })),
  });

  const filename = `dot-compliance-${startDate}-to-${endDate}.pdf`;

  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
});
