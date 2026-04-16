import { NextResponse } from 'next/server';
import { db } from '@/db';
import { physicalExams, physicalExamFindings, physicalExamVitals, tpaSettings } from '@/db/schema';
import { withPermission } from '@/auth/api-middleware';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { createAuditLog } from '@/lib/audit';
import {
  calculateMecDuration,
  calculateMecExpirationDate,
  generateMecCertificateNumber,
  type FindingCategory,
  type CertificationDecision,
} from '@/lib/dot-physical';
import { generateMecPdf, type MecPdfData } from '@/lib/pdf';
import { uploadFile } from '@/lib/storage';
import { enqueueWebhookEvent } from '@/lib/webhooks';

export const dynamic = 'force-dynamic';

const certifyBodySchema = z.object({
  // Examiner may override calculated duration / decision when clinically warranted
  overrideMonths: z.number().int().min(0).max(24).optional(),
  overrideDecision: z
    .enum([
      'medically_qualified',
      'qualified_with_restrictions',
      'temporarily_disqualified',
      'disqualified',
      'pending_evaluation',
    ])
    .optional(),
  overrideRestrictions: z.array(z.string().max(500)).optional(),
  examinerSignatureImage: z.string().max(500_000).optional(),
});

export const POST = withPermission('certify_physicals', async (req, user, context) => {
  if (!user.nrcmeNumber) {
    return NextResponse.json(
      {
        error:
          'Certification requires an NRCME number. Your user account does not have one on file. ' +
          'Update your profile before certifying physical exams.',
      },
      { status: 403 }
    );
  }

  const { id } = context.params;
  const tpaOrgId = user.tpaOrgId;

  const exam = await db.query.physicalExams.findFirst({
    where: tpaOrgId
      ? and(eq(physicalExams.id, id), eq(physicalExams.tpaOrgId, tpaOrgId))
      : eq(physicalExams.id, id),
    with: {
      person: true,
      findings: true,
      clientOrg: { columns: { id: true, name: true } },
    },
  });
  if (!exam) return NextResponse.json({ error: 'Exam not found' }, { status: 404 });

  if (exam.status !== 'in_progress') {
    return NextResponse.json(
      { error: `Cannot certify exam in status '${exam.status}'. Exam must be in_progress.` },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = certifyBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.errors },
      { status: 400 }
    );
  }
  const overrides = parsed.data;

  // Compute duration + decision from findings
  const findingCategories = exam.findings.map((f) => f.category as FindingCategory);
  const mecResult = calculateMecDuration(findingCategories);

  const finalMonths = overrides.overrideMonths ?? mecResult.months;
  const finalDecision: CertificationDecision = overrides.overrideDecision ?? mecResult.decision;
  const finalRestrictions = overrides.overrideRestrictions ?? mecResult.restrictions;

  const examDate = exam.examDate ?? new Date();
  const mecExpiresOn = calculateMecExpirationDate(examDate, finalMonths);
  const now = new Date();
  const certificateNumber = generateMecCertificateNumber(now);

  // Build MEC PDF
  const settings = await db.query.tpaSettings.findFirst({
    where: eq(tpaSettings.tpaOrgId, exam.tpaOrgId),
    columns: { brandName: true, dotCompanyName: true },
  });

  const pdfData: MecPdfData = {
    certificateNumber,
    driverName: `${exam.person.firstName} ${exam.person.lastName}`,
    driverDob: exam.person.dob || null,
    driverLicenseNumber: null,
    driverLicenseState: null,
    driverAddress: exam.person.address || null,
    driverCity: exam.person.city || null,
    driverState: exam.person.state || null,
    driverZip: exam.person.zip || null,
    certificationStatus: finalDecision,
    examDate,
    mecExpiresOn,
    restrictions: finalRestrictions,
    examinerName: user.name || user.email || 'Unknown Examiner',
    examinerNRCMENumber: user.nrcmeNumber,
    examinerSignatureImage: overrides.examinerSignatureImage || null,
    clinicName: settings?.brandName || settings?.dotCompanyName || null,
    clinicAddress: null,
    examType: exam.examType,
  };

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateMecPdf(pdfData);
  } catch (err) {
    console.error('[occ/certify] MEC PDF generation failed:', err);
    return NextResponse.json({ error: 'Failed to generate MEC PDF' }, { status: 500 });
  }

  // Upload to storage
  const storageKey = `mec/${exam.tpaOrgId}/${exam.id}/${certificateNumber}.pdf`;
  try {
    await uploadFile(storageKey, pdfBuffer, 'application/pdf');
  } catch (err) {
    console.error('[occ/certify] MEC PDF upload failed:', err);
    return NextResponse.json({ error: 'Failed to upload MEC PDF' }, { status: 500 });
  }

  const fmcsaStatus = exam.examType === 'dot' ? 'pending' : 'not_required';

  await db
    .update(physicalExams)
    .set({
      status: 'completed',
      certificationStatus: finalDecision,
      mecIssuedAt: now,
      mecExpiresOn: mecExpiresOn,
      certificateNumber,
      mecStorageKey: storageKey,
      restrictions: finalRestrictions,
      examinerNRCMENumber: user.nrcmeNumber,
      examinerId: user.id,
      fmcsaSubmissionStatus: fmcsaStatus,
      updatedAt: now,
    })
    .where(eq(physicalExams.id, exam.id));

  await createAuditLog({
    tpaOrgId: exam.tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'physical_exam',
    entityId: exam.id,
    action: 'physical_certified',
    diffJson: {
      durationMonths: finalMonths,
      decision: finalDecision,
      certificateNumber,
      mecExpiresOn: mecExpiresOn?.toISOString() ?? null,
      autoCalculatedMonths: mecResult.months,
      autoCalculatedDecision: mecResult.decision,
      wasOverridden: Boolean(overrides.overrideMonths || overrides.overrideDecision),
    },
  });

  // Fire webhook
  await enqueueWebhookEvent({
    tpaOrgId: exam.tpaOrgId,
    event: 'physical.certified',
    payload: {
      examId: exam.id,
      personId: exam.personId,
      certificateNumber,
      certificationStatus: finalDecision,
      mecExpiresOn: mecExpiresOn?.toISOString() ?? null,
      examDate: examDate.toISOString(),
      examinerNRCMENumber: user.nrcmeNumber,
      restrictions: finalRestrictions,
    },
  });

  const full = await db.query.physicalExams.findFirst({
    where: eq(physicalExams.id, exam.id),
    with: {
      person: { columns: { id: true, firstName: true, lastName: true } },
      examiner: { columns: { id: true, name: true, nrcmeNumber: true } },
      findings: true,
    },
  });

  return NextResponse.json({
    exam: full,
    certificate: {
      number: certificateNumber,
      decision: finalDecision,
      durationMonths: finalMonths,
      mecExpiresOn,
      restrictions: finalRestrictions,
      downloadUrl: `/api/occ/physicals/${exam.id}/mec.pdf`,
      reason: mecResult.reason,
    },
  });
});
