import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { orders, documents } from '@/db/schema';
import { generateConcentraAuthPDF } from '@/lib/pdf';
import { getUploadUrl, generateStorageKey } from '@/lib/storage';
import { getCurrentUser } from '@/auth/get-user';
import { eq } from 'drizzle-orm';

// POST /api/orders/[id]/concentra/summary - Generate Concentra authorization PDF
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only providers can generate auth PDFs
    if (!user.role?.startsWith('provider')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const order = await db.query.orders.findFirst({
      where: eq(orders.id, params.id),
      with: {
        candidate: true,
        organization: true,
        appointments: { with: { site: true } },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Map test types to service packages and components
    const servicePackages: Record<string, { package: string; components: string[] }> = {
      'Pre-Employment Drug Screen': {
        package: 'Pre-Employment Drug Screen',
        components: ['5-Panel Urine Drug Screen', 'Chain of Custody Collection'],
      },
      'DOT Drug Test': {
        package: 'DOT Drug & Alcohol Testing',
        components: ['5-Panel DOT Drug Screen (49 CFR Part 40)', 'Medical Review Officer (MRO) Services'],
      },
      'Physical Examination': {
        package: 'Employment Physical',
        components: ['Physical Examination', 'Vision Screening', 'Hearing Test', 'Vital Signs'],
      },
      'TB Test': {
        package: 'Tuberculosis Screening',
        components: ['TB Skin Test (Tuberculin/PPD)', 'Results Reading (48-72 hours)'],
      },
      'Respirator Fit Test': {
        package: 'Respirator Medical Evaluation',
        components: ['Respirator Fit Testing (Qualitative or Quantitative)', 'Medical Evaluation Questionnaire'],
      },
    };

    const serviceInfo = servicePackages[order.testType] || {
      package: order.testType,
      components: [order.testType],
    };

    // Determine geographic area based on jobsite location
    const geographicArea = order.jobsiteLocation ?
      order.jobsiteLocation.split('-')[0].trim() : // Extract city/region from jobsite
      'Nationwide';

    // Generate PDF with new format
    const pdfBuffer = await generateConcentraAuthPDF({
      orderNumber: order.orderNumber,
      companyName: order.organization.name,
      companyLocation: order.jobsiteLocation, // Use jobsite location as company location
      // No specific center - provider will choose when entering into HUB
      geographicArea: geographicArea,
      candidateFirstName: order.candidate.firstName,
      candidateLastName: order.candidate.lastName,
      candidateDOB: order.candidate.dob || undefined,
      candidatePhone: order.candidate.phone || undefined,
      candidateEmail: order.candidate.email || undefined,
      servicePackage: serviceInfo.package,
      serviceComponents: serviceInfo.components,
      validityDays: order.organization.authExpiryDays || 3, // Use org setting or default to 3 days
      specialInstructions: order.notes || undefined,
    });

    // Upload to storage
    const storageKey = generateStorageKey(order.id, 'authorization', `concentra-auth-${order.orderNumber}.pdf`);
    const uploadUrl = await getUploadUrl(storageKey, 'application/pdf');

    await fetch(uploadUrl, {
      method: 'PUT',
      body: pdfBuffer,
      headers: { 'Content-Type': 'application/pdf' },
    });

    // Create document record
    const [doc] = await db.insert(documents).values({
      orderId: order.id,
      kind: 'authorization',
      fileName: `concentra-auth-${order.orderNumber}.pdf`,
      storageUrl: storageKey,
      mimeType: 'application/pdf',
      fileSize: pdfBuffer.length,
      uploadedBy: user.id,
    }).returning();

    return NextResponse.json({
      documentId: doc.id,
      message: 'Authorization summary generated. Use this PDF to enter data into Concentra HUB.',
    });
  } catch (error: any) {
    console.error('Error generating Concentra auth PDF:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate authorization summary' },
      { status: 500 }
    );
  }
}
