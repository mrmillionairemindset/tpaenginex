import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { orders, documents } from '@/db/schema';
import { eq, and, or, like } from 'drizzle-orm';

// POST /api/webhooks/inbound-email - Receive emails from SendGrid Inbound Parse
export async function POST(req: NextRequest) {
  try {
    // Parse multipart form data from SendGrid
    const formData = await req.formData();

    const to = formData.get('to') as string;
    const from = formData.get('from') as string;
    const subject = formData.get('subject') as string;
    const text = formData.get('text') as string; // Plain text body
    const html = formData.get('html') as string; // HTML body
    const envelope = formData.get('envelope') as string;

    console.log('Received inbound email:', { to, from, subject });

    // Only process emails sent to auth@wsnportal.com
    if (!to || !to.includes('auth@wsnportal.com')) {
      return NextResponse.json({
        message: 'Email not sent to auth@wsnportal.com, ignoring'
      }, { status: 200 });
    }

    // Parse email to extract authorization details
    const authDetails = await parseAuthorizationEmail(subject, text, html);

    if (!authDetails) {
      console.error('Failed to parse authorization details from email');
      return NextResponse.json({
        error: 'Could not parse authorization details'
      }, { status: 400 });
    }

    // Try to match to an order
    const matchedOrder = await findMatchingOrder(authDetails);

    if (!matchedOrder) {
      console.error('No matching order found for authorization:', authDetails);
      // TODO: Send alert to admin/provider that manual matching is needed
      return NextResponse.json({
        error: 'No matching order found',
        details: authDetails
      }, { status: 404 });
    }

    // Check if timer already started
    if (matchedOrder.authCreatedAt) {
      console.log('Timer already started for order:', matchedOrder.id);
      return NextResponse.json({
        message: 'Timer already started, ignoring duplicate email',
        orderId: matchedOrder.id
      }, { status: 200 });
    }

    // Start the timer automatically
    const authCreatedAt = new Date();
    const authExpiryDays = matchedOrder.organization.authExpiryDays || 3;
    const authExpiresAt = new Date(authCreatedAt.getTime() + authExpiryDays * 24 * 60 * 60 * 1000);

    await db
      .update(orders)
      .set({
        authCreatedAt,
        authExpiresAt,
        authConfirmationEmail: text || html || subject,
        authNumber: authDetails.authNumber,
        autoTimerStarted: true,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, matchedOrder.id));

    console.log('Timer started automatically for order:', matchedOrder.id);

    // TODO: Send notification to employer and provider
    // TODO: Store email attachments as documents if present

    return NextResponse.json({
      message: 'Authorization timer started successfully',
      orderId: matchedOrder.id,
      orderNumber: matchedOrder.orderNumber,
      authCreatedAt: authCreatedAt.toISOString(),
      authExpiresAt: authExpiresAt.toISOString(),
      expiresInDays: authExpiryDays,
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error processing inbound email:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process email' },
      { status: 500 }
    );
  }
}

// Helper function to parse authorization details from email
async function parseAuthorizationEmail(subject: string, text: string, html: string) {
  const content = text || html || '';

  // Common patterns in Concentra confirmation emails
  // This is a simplified version - you'll need to adjust based on actual email format

  const authNumberMatch = content.match(/(?:Authorization|Auth|Confirmation)\s*(?:Number|#|No\.?):?\s*([A-Z0-9-]+)/i);
  const nameMatch = content.match(/(?:Employee|Candidate|Patient)\s*(?:Name)?:?\s*([A-Za-z\s]+)/i);
  const dobMatch = content.match(/(?:DOB|Date of Birth|Birth Date):?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);

  return {
    authNumber: authNumberMatch?.[1]?.trim(),
    candidateName: nameMatch?.[1]?.trim(),
    candidateDOB: dobMatch?.[1]?.trim(),
    subject,
    rawContent: content.substring(0, 500), // Store first 500 chars for reference
  };
}

// Helper function to find matching order
async function findMatchingOrder(authDetails: any) {
  const { candidateName, candidateDOB, authNumber } = authDetails;

  if (!candidateName && !candidateDOB && !authNumber) {
    return null;
  }

  // Build search conditions
  const conditions = [];

  if (candidateName) {
    const [firstName, ...lastNameParts] = candidateName.split(' ');
    const lastName = lastNameParts.join(' ');
    // We'll need to join with candidates table
  }

  // Search for orders created in the last 7 days that don't have timer started yet
  const recentOrders = await db.query.orders.findMany({
    where: and(
      eq(orders.authCreatedAt, null), // Timer not started yet
      // Created in last 7 days
    ),
    with: {
      candidate: true,
      organization: true,
    },
    limit: 50,
  });

  // Match by candidate name and DOB
  for (const order of recentOrders) {
    const fullName = `${order.candidate.firstName} ${order.candidate.lastName}`.toLowerCase();
    const candidateFullName = candidateName?.toLowerCase() || '';

    const nameMatches = candidateFullName && fullName.includes(candidateFullName.split(' ')[0]);
    const dobMatches = candidateDOB && order.candidate.dob === candidateDOB;

    if ((nameMatches && dobMatches) || (nameMatches && !candidateDOB)) {
      return order;
    }
  }

  return null;
}
