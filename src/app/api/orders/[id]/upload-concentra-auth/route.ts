import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders } from '@/db/schema';
import { withAuth } from '@/auth/api-middleware';
import { eq } from 'drizzle-orm';
import { sendAuthorizationFormEmail } from '@/lib/email';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * POST /api/orders/[id]/upload-concentra-auth
 * Upload Concentra authorization form PDF
 * Automatically sends email to recipients and starts timer
 * Only providers can upload
 */
export const POST = withAuth(async (req, context) => {
  const params = await context.params;
  const orderId = params.id;
  const user = req.user;

  // Only providers can upload auth forms
  if (!user.role?.startsWith('provider')) {
    return NextResponse.json(
      { error: 'Only providers can upload authorization forms' },
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

    // Parse the multipart form data
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'File must be a PDF' },
        { status: 400 }
      );
    }

    // Convert file to buffer for emailing
    const arrayBuffer = await file.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);

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
        pdfBuffer,
      })
        .then(() => {
          console.log(`✓ Concentra authorization form emailed to ${recipients.length} recipient(s)`);
          // Update order with sent timestamp
          db.update(orders)
            .set({ authorizationFormSentAt: new Date() })
            .where(eq(orders.id, orderId))
            .catch(console.error);
        })
        .catch((error) => {
          console.error('Failed to send Concentra authorization form email:', error);
          // Don't fail the request if email fails
        });
    }

    // Auto-start expiration timer when uploading Concentra auth form
    const now = new Date();
    const expiryDays = order.organization?.authExpiryDays || 3;
    const expiresAt = new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000);

    // TODO: Upload PDF to storage (Supabase/S3) and save URL
    // const uploadedUrl = await uploadToStorage(pdfBuffer, `concentra-auth-${order.orderNumber}.pdf`);

    // Update order with authorization info and auto-start timer
    await db.update(orders)
      .set({
        authorizationMethod: 'concentra',
        authCreatedAt: now,
        authExpiresAt: expiresAt,
        // authorizationFormUrl: uploadedUrl, // TODO: Add after uploading to storage
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    // Return success response
    return NextResponse.json({
      success: true,
      message: `Concentra authorization form uploaded and emailed to ${recipients.length} recipient${recipients.length > 1 ? 's' : ''}`,
      recipients,
      timerStarted: true,
      expiresAt: expiresAt.toISOString(),
    });

  } catch (error) {
    console.error('Failed to upload Concentra authorization form:', error);
    return NextResponse.json(
      {
        error: 'Failed to upload authorization form',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
});
