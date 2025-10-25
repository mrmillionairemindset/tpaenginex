import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders } from '@/db/schema';
import { withAuth } from '@/auth/api-middleware';
import { eq } from 'drizzle-orm';
import { PDFDocument } from 'pdf-lib';
import { promises as fs } from 'fs';
import path from 'path';
import { sendAuthorizationFormEmail } from '@/lib/email';
import { z } from 'zod';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

const sendAuthFormSchema = z.object({
  recipients: z.array(z.string().email()).min(1, 'At least one recipient is required'),
});

/**
 * POST /api/orders/[id]/send-auth-form
 * Generate and send custom authorization form PDF via email
 * Only providers can send auth forms
 */
export const POST = withAuth(async (req, context) => {
  const params = await context.params;
  const orderId = params.id;
  const user = req.user;

  // Only providers can send auth forms
  if (!user.role?.startsWith('provider')) {
    return NextResponse.json(
      { error: 'Only providers can send authorization forms' },
      { status: 403 }
    );
  }

  try {
    // Validate request body
    const body = await req.json();
    const validation = sendAuthFormSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { recipients } = validation.data;

    // Get the order with all related data
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: {
        candidate: true,
        organization: true,
        requestedByUser: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    if (!order.candidate) {
      return NextResponse.json(
        { error: 'Candidate information not found' },
        { status: 400 }
      );
    }

    // Load the PDF template
    const templatePath = path.join(process.cwd(), 'ConcentraEmployerAuthorizationForm-0309.pdf');
    const templateBytes = await fs.readFile(templatePath);

    // Load the PDF with pdf-lib
    const pdfDoc = await PDFDocument.load(templateBytes);

    // Get the form
    const form = pdfDoc.getForm();

    // Fill in the fields (same logic as generate endpoint)
    try {
      const candidateFields = [
        { field: 'firstName', value: order.candidate.firstName },
        { field: 'FirstName', value: order.candidate.firstName },
        { field: 'first_name', value: order.candidate.firstName },
        { field: 'lastName', value: order.candidate.lastName },
        { field: 'LastName', value: order.candidate.lastName },
        { field: 'last_name', value: order.candidate.lastName },
        { field: 'fullName', value: `${order.candidate.firstName} ${order.candidate.lastName}` },
        { field: 'name', value: `${order.candidate.firstName} ${order.candidate.lastName}` },
        { field: 'candidateName', value: `${order.candidate.firstName} ${order.candidate.lastName}` },
        { field: 'dob', value: order.candidate.dob },
        { field: 'DOB', value: order.candidate.dob },
        { field: 'dateOfBirth', value: order.candidate.dob },
        { field: 'ssn', value: `***-**-${order.candidate.ssnLast4}` },
        { field: 'SSN', value: `***-**-${order.candidate.ssnLast4}` },
        { field: 'email', value: order.candidate.email },
        { field: 'phone', value: order.candidate.phone },
        { field: 'phoneNumber', value: order.candidate.phone },
        { field: 'address', value: order.candidate.address },
        { field: 'city', value: order.candidate.city },
        { field: 'state', value: order.candidate.state },
        { field: 'zip', value: order.candidate.zip },
        { field: 'zipCode', value: order.candidate.zip },
        { field: 'orderNumber', value: order.orderNumber },
        { field: 'authNumber', value: order.orderNumber },
        { field: 'authorizationNumber', value: order.orderNumber },
        { field: 'testType', value: order.testType },
        { field: 'test', value: order.testType },
        { field: 'serviceType', value: order.testType },
        { field: 'urgency', value: order.urgency || 'standard' },
        { field: 'jobsite', value: order.jobsiteLocation },
        { field: 'jobsiteLocation', value: order.jobsiteLocation },
        { field: 'location', value: order.jobsiteLocation },
        { field: 'employer', value: order.organization?.name },
        { field: 'employerName', value: order.organization?.name },
        { field: 'company', value: order.organization?.name },
        { field: 'companyName', value: order.organization?.name },
        { field: 'date', value: new Date().toLocaleDateString() },
        { field: 'currentDate', value: new Date().toLocaleDateString() },
        { field: 'issueDate', value: new Date().toLocaleDateString() },
      ];

      candidateFields.forEach(({ field, value }) => {
        try {
          const textField = form.getTextField(field);
          if (textField && value) {
            textField.setText(value);
          }
        } catch (error) {
          // Field doesn't exist or isn't a text field, skip silently
        }
      });

      // Flatten the form so fields can't be edited
      form.flatten();

    } catch (error) {
      console.log('Note: PDF may not have fillable form fields');
    }

    // Save the filled PDF
    const pdfBytes = await pdfDoc.save();

    // Send email with PDF attachment
    await sendAuthorizationFormEmail({
      to: recipients,
      orderNumber: order.orderNumber,
      candidateName: `${order.candidate.firstName} ${order.candidate.lastName}`,
      employerName: order.organization?.name || 'Unknown',
      pdfBuffer: Buffer.from(pdfBytes),
    });

    // Update order with authorization method and sent timestamp
    await db.update(orders)
      .set({
        authorizationMethod: 'custom',
        authorizationFormSentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    return NextResponse.json({
      success: true,
      message: `Authorization form sent to ${recipients.length} recipient${recipients.length > 1 ? 's' : ''}`,
    });

  } catch (error) {
    console.error('Failed to send authorization form:', error);
    return NextResponse.json(
      {
        error: 'Failed to send authorization form',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
});
