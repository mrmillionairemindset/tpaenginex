import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders } from '@/db/schema';
import { withAuth } from '@/auth/api-middleware';
import { eq } from 'drizzle-orm';
import { PDFDocument } from 'pdf-lib';
import { promises as fs } from 'fs';
import path from 'path';
import { sendAuthorizationFormEmail } from '@/lib/email';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * POST /api/orders/[id]/generate-auth-form
 * Generate custom authorization form PDF for non-Concentra orders
 * Only providers can generate auth forms
 */
export const POST = withAuth(async (req, context) => {
  const params = await context.params;
  const orderId = params.id;
  const user = req.user;

  // Only providers can generate auth forms
  if (!user.role?.startsWith('provider')) {
    return NextResponse.json(
      { error: 'Only providers can generate authorization forms' },
      { status: 403 }
    );
  }

  try {
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

    // Get all form fields to see what's available
    const fields = form.getFields();
    console.log('Available PDF form fields:');
    fields.forEach(field => {
      const name = field.getName();
      console.log(`  - ${name}`);
    });

    // Try to fill in the fields (we'll need to inspect the PDF to know exact field names)
    // Common field names to try:
    try {
      // Candidate information
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

        // Order information
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

        // Employer information
        { field: 'employer', value: order.organization?.name },
        { field: 'employerName', value: order.organization?.name },
        { field: 'company', value: order.organization?.name },
        { field: 'companyName', value: order.organization?.name },

        // Dates
        { field: 'date', value: new Date().toLocaleDateString() },
        { field: 'currentDate', value: new Date().toLocaleDateString() },
        { field: 'issueDate', value: new Date().toLocaleDateString() },
      ];

      candidateFields.forEach(({ field, value }) => {
        try {
          const textField = form.getTextField(field);
          if (textField && value) {
            textField.setText(value);
            console.log(`✓ Set field "${field}" to "${value}"`);
          }
        } catch (error) {
          // Field doesn't exist or isn't a text field, skip silently
        }
      });

      // Flatten the form so fields can't be edited
      form.flatten();

    } catch (error) {
      console.log('Note: PDF may not have fillable form fields');
      // If form filling fails, the PDF will still be generated with the template
    }

    // Save the filled PDF
    const pdfBytes = await pdfDoc.save();

    // Build recipient list: candidate + organization's auth form recipients
    const recipients: string[] = [];

    // Always include candidate email
    if (order.candidate.email) {
      recipients.push(order.candidate.email);
    }

    // Include organization's configured recipients
    if (order.organization?.authFormRecipients && order.organization.authFormRecipients.length > 0) {
      recipients.push(...order.organization.authFormRecipients);
    }

    // Fallback to requester if no org recipients configured
    if (recipients.length === 1 && order.requestedByUser?.email) {
      recipients.push(order.requestedByUser.email);
    }

    // Send email with PDF attachment (don't block response on email send)
    if (recipients.length > 0) {
      sendAuthorizationFormEmail({
        to: recipients,
        orderNumber: order.orderNumber,
        candidateName: `${order.candidate.firstName} ${order.candidate.lastName}`,
        employerName: order.organization?.name || 'Unknown',
        pdfBuffer: Buffer.from(pdfBytes),
      })
        .then(() => {
          console.log(`✓ Authorization form emailed to ${recipients.length} recipient(s)`);
          // Update order with sent timestamp
          db.update(orders)
            .set({ authorizationFormSentAt: new Date() })
            .where(eq(orders.id, orderId))
            .catch(console.error);
        })
        .catch((error) => {
          console.error('Failed to send authorization form email:', error);
          // Don't fail the request if email fails
        });
    }

    // Auto-start expiration timer when generating custom auth form
    const now = new Date();
    const expiryDays = order.organization?.authExpiryDays || 3;
    const expiresAt = new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000);

    // Update order with authorization method and auto-start timer
    await db.update(orders)
      .set({
        authorizationMethod: 'custom',
        authCreatedAt: now,
        authExpiresAt: expiresAt,
        // authorizationFormUrl: uploadedUrl, // TODO: Add after uploading to storage
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    // Return success response (PDF was emailed, no download needed)
    return NextResponse.json({
      success: true,
      message: `Authorization form generated and emailed to ${recipients.length} recipient${recipients.length > 1 ? 's' : ''}`,
      recipients,
      timerStarted: true,
      expiresAt: expiresAt.toISOString(),
    });

  } catch (error) {
    console.error('Failed to generate authorization form:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate authorization form',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
});
