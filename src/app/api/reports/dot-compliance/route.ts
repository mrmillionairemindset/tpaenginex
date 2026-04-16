import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/auth/api-middleware';
import { generateDotComplianceReport } from '@/lib/reports/dot-compliance';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// ============================================================================
// GET /api/reports/dot-compliance - Generate DOT compliance report
// ============================================================================

export const GET = withAuth(async (req, user) => {
  // Role check: tpa_admin, tpa_records, platform_admin
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

  return NextResponse.json({ report });
});
