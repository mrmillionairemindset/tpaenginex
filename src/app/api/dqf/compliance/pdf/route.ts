import { NextResponse } from 'next/server';
import { withAuth } from '@/auth/api-middleware';
import { generateComplianceReportPDF } from '@/lib/pdf';

export const dynamic = 'force-dynamic';

// ============================================================================
// GET /api/dqf/compliance/pdf - Download DQF compliance report as PDF
// ============================================================================

export const GET = withAuth(async (req, user) => {
  const allowedRoles = ['tpa_admin', 'tpa_staff', 'tpa_records', 'platform_admin'];
  if (!allowedRoles.includes(user.role ?? '')) {
    return NextResponse.json(
      { error: 'Forbidden: Insufficient permissions' },
      { status: 403 }
    );
  }

  if (!user.tpaOrgId) {
    return NextResponse.json(
      { error: 'Tenant context required' },
      { status: 400 }
    );
  }

  const { searchParams } = new URL(req.url);
  const clientOrgId = searchParams.get('clientOrgId') || undefined;

  const pdfBuffer = await generateComplianceReportPDF(user.tpaOrgId, clientOrgId);

  const date = new Date().toISOString().slice(0, 10);
  const filename = `compliance-report-${date}.pdf`;

  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
});
