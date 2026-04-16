import sgMail from '@sendgrid/mail';
import { getEmailTemplate, interpolate } from './email-templates';

// Initialize SendGrid client
sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

interface SendAuthorizationFormEmailOptions {
  to: string[];
  orderNumber: string;
  personName: string;
  employerName: string;
  pdfBuffer: Buffer;
}

/**
 * Send authorization form PDF via email
 */
export async function sendAuthorizationFormEmail(options: SendAuthorizationFormEmailOptions) {
  const { to, orderNumber, personName, employerName, pdfBuffer } = options;

  try {
    const msg = {
      to,
      from: 'TPAEngineX <noreply@tpaenginex.com>',
      subject: `Authorization Form for ${personName} - Order ${orderNumber}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; background-color: #f9fafb; }
              .footer { padding: 20px; text-align: center; font-size: 12px; color: #6b7280; }
              .button { display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
              .info-box { background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 15px; margin: 15px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Authorization Form Ready</h1>
              </div>

              <div class="content">
                <h2>Hello,</h2>

                <p>The custom authorization form for <strong>${personName}</strong> has been generated and is ready for use.</p>

                <div class="info-box">
                  <p><strong>Order Number:</strong> ${orderNumber}</p>
                  <p><strong>Person:</strong> ${personName}</p>
                  <p><strong>Employer:</strong> ${employerName}</p>
                </div>

                <p>The authorization form PDF is attached to this email. Please review and provide it to the person to use at their chosen testing location.</p>

                <p><strong>Next Steps:</strong></p>
                <ul>
                  <li>Review the attached authorization form</li>
                  <li>Forward to the person or provide instructions</li>
                  <li>Person can choose any certified testing facility</li>
                  <li>Testing facility will submit results per standard procedures</li>
                </ul>
              </div>

              <div class="footer">
                <p>This is an automated message from TPAEngineX.</p>
                <p>If you have questions, please contact your provider administrator.</p>
              </div>
            </div>
          </body>
        </html>
      `,
      attachments: [
        {
          filename: `Authorization_${orderNumber}.pdf`,
          content: pdfBuffer.toString('base64'),
          type: 'application/pdf',
          disposition: 'attachment',
        },
      ],
    };

    const response = await sgMail.send(msg);

    return { success: true, emailId: response[0].headers['x-message-id'] };
  } catch (error) {
    console.error('Error in sendAuthorizationFormEmail:', error);
    throw error;
  }
}

// ============================================================================
// TPA Email Templates
// ============================================================================

const DEFAULT_FROM = 'TPAEngineX <noreply@tpaenginex.com>';

export interface TpaBranding {
  brandName?: string | null;
  replyToEmail?: string | null;
}

function buildFrom(branding?: TpaBranding): string {
  const name = branding?.brandName || 'TPAEngineX';
  return `${name} <noreply@tpaenginex.com>`;
}

function buildReplyTo(branding?: TpaBranding): string | undefined {
  return branding?.replyToEmail || undefined;
}

/**
 * Collector assignment confirmation email to client contact
 */
export async function sendCollectorAssignedEmail(options: {
  to: string;
  orderNumber: string;
  clientName: string;
  collectorName: string;
  scheduledDate: string;
  location: string;
  personName?: string;
  branding?: TpaBranding;
  tpaOrgId?: string;
}) {
  const { to, orderNumber, clientName, collectorName, scheduledDate, location, personName, branding, tpaOrgId } = options;

  const defaultSubject = `Collector Confirmed for Order ${orderNumber} — ${clientName}`;
  const defaultBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Collector Confirmed</h2>
        <p>A collector has been assigned to your order.</p>
        <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
          <tr><td style="padding: 8px; color: #666;">Order</td><td style="padding: 8px; font-weight: bold;">${orderNumber}</td></tr>
          <tr><td style="padding: 8px; color: #666;">Collector</td><td style="padding: 8px; font-weight: bold;">${collectorName}</td></tr>
          <tr><td style="padding: 8px; color: #666;">Scheduled</td><td style="padding: 8px; font-weight: bold;">${scheduledDate}</td></tr>
          <tr><td style="padding: 8px; color: #666;">Location</td><td style="padding: 8px; font-weight: bold;">${location}</td></tr>
        </table>
        <p>If you have questions, please contact your TPA administrator.</p>
      </div>
    `;

  const vars: Record<string, string> = {
    personName: personName ?? '',
    orderNumber,
    collectorName,
    clientName,
    scheduledDate,
    location,
  };

  let subject = defaultSubject;
  let html = defaultBody;

  if (tpaOrgId) {
    const custom = await getEmailTemplate(tpaOrgId, 'collector_assigned');
    if (custom?.subject) subject = interpolate(custom.subject, vars);
    if (custom?.bodyHtml) html = interpolate(custom.bodyHtml, vars);
  }

  const msg = {
    to,
    from: buildFrom(branding),
    replyTo: buildReplyTo(branding),
    subject,
    html,
  };

  const response = await sgMail.send(msg);
  return { success: true, emailId: response[0].headers['x-message-id'] };
}

/**
 * Order completion + review request email to client
 */
export async function sendOrderCompletionEmail(options: {
  to: string;
  orderNumber: string;
  clientName: string;
  donorName: string;
  serviceType: string;
  reviewLink: string;
  branding?: TpaBranding;
  tpaOrgId?: string;
}) {
  const { to, orderNumber, clientName, donorName, serviceType, reviewLink, branding, tpaOrgId } = options;

  const defaultSubject = `Collection Complete — Order ${orderNumber} | ${clientName}`;
  const defaultBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Collection Complete</h2>
        <p>Thank you for choosing our services. The collection for the following order has been completed:</p>
        <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
          <tr><td style="padding: 8px; color: #666;">Order</td><td style="padding: 8px; font-weight: bold;">${orderNumber}</td></tr>
          <tr><td style="padding: 8px; color: #666;">Donor</td><td style="padding: 8px; font-weight: bold;">${donorName}</td></tr>
          <tr><td style="padding: 8px; color: #666;">Service</td><td style="padding: 8px; font-weight: bold;">${serviceType}</td></tr>
        </table>
        <p><strong>Next Steps:</strong> Results will be delivered within the standard turnaround time for the service type ordered.</p>
        ${reviewLink ? `<p>We'd appreciate your feedback! <a href="${reviewLink}">Leave a review</a></p>` : ''}
        <p>Thank you for your business.</p>
      </div>
    `;

  const vars: Record<string, string> = {
    personName: donorName,
    orderNumber,
    brandName: branding?.brandName || 'TPAEngineX',
    clientName,
    serviceType,
    reviewLink: reviewLink || '',
  };

  let subject = defaultSubject;
  let html = defaultBody;

  if (tpaOrgId) {
    const custom = await getEmailTemplate(tpaOrgId, 'order_completion');
    if (custom?.subject) subject = interpolate(custom.subject, vars);
    if (custom?.bodyHtml) html = interpolate(custom.bodyHtml, vars);
  }

  const msg = {
    to,
    from: buildFrom(branding),
    replyTo: buildReplyTo(branding),
    subject,
    html,
  };

  const response = await sgMail.send(msg);
  return { success: true, emailId: response[0].headers['x-message-id'] };
}

/**
 * Event completion summary email to client
 */
export async function sendEventCompletionEmail(options: {
  to: string;
  eventNumber: string;
  clientName: string;
  totalDone: number;
  totalPending: number;
  eventDate: string;
  branding?: TpaBranding;
  tpaOrgId?: string;
}) {
  const { to, eventNumber, clientName, totalDone, totalPending, eventDate, branding, tpaOrgId } = options;

  const defaultSubject = `Collection Event Summary — ${clientName} | ${eventDate}`;
  const defaultBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Event Summary — ${eventNumber}</h2>
        <p>The collection event for ${clientName} has been completed.</p>
        <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
          <tr><td style="padding: 8px; color: #666;">Event</td><td style="padding: 8px; font-weight: bold;">${eventNumber}</td></tr>
          <tr><td style="padding: 8px; color: #666;">Date</td><td style="padding: 8px; font-weight: bold;">${eventDate}</td></tr>
          <tr><td style="padding: 8px; color: #666;">Completed</td><td style="padding: 8px; font-weight: bold; color: #16a34a;">${totalDone}</td></tr>
          ${totalPending > 0 ? `<tr><td style="padding: 8px; color: #666;">Pending Results</td><td style="padding: 8px; font-weight: bold; color: #d97706;">${totalPending}</td></tr>` : ''}
        </table>
        ${totalPending > 0 ? '<p>Pending results will be delivered as they are received from the laboratory.</p>' : ''}
        <p>Thank you for your business.</p>
      </div>
    `;

  const vars: Record<string, string> = {
    clientName,
    eventNumber,
    totalDone: String(totalDone),
    totalPending: String(totalPending),
    brandName: branding?.brandName || 'TPAEngineX',
    eventDate,
  };

  let subject = defaultSubject;
  let html = defaultBody;

  if (tpaOrgId) {
    const custom = await getEmailTemplate(tpaOrgId, 'event_completion');
    if (custom?.subject) subject = interpolate(custom.subject, vars);
    if (custom?.bodyHtml) html = interpolate(custom.bodyHtml, vars);
  }

  const msg = {
    to,
    from: buildFrom(branding),
    replyTo: buildReplyTo(branding),
    subject,
    html,
  };

  const response = await sgMail.send(msg);
  return { success: true, emailId: response[0].headers['x-message-id'] };
}

/**
 * Pending results follow-up email to TPA records staff
 */
export async function sendPendingResultsReminder(options: {
  to: string;
  eventNumber: string;
  pendingCount: number;
  daysSinceEvent: number;
  branding?: TpaBranding;
  tpaOrgId?: string;
}) {
  const { to, eventNumber, pendingCount, daysSinceEvent, branding, tpaOrgId } = options;

  const defaultSubject = `${pendingCount} Results Still Pending — ${eventNumber}`;
  const defaultBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #d97706;">Results Pending Action</h2>
        <p><strong>${pendingCount}</strong> result(s) are still pending for event <strong>${eventNumber}</strong>.</p>
        <p>It has been <strong>${daysSinceEvent} day(s)</strong> since the collection date.</p>
        <p>Please follow up with the laboratory or MRO to obtain the outstanding results.</p>
      </div>
    `;

  const vars: Record<string, string> = {
    eventNumber,
    resultsCount: String(pendingCount),
    brandName: branding?.brandName || 'TPAEngineX',
    daysSinceEvent: String(daysSinceEvent),
  };

  let subject = defaultSubject;
  let html = defaultBody;

  if (tpaOrgId) {
    const custom = await getEmailTemplate(tpaOrgId, 'pending_results_reminder');
    if (custom?.subject) subject = interpolate(custom.subject, vars);
    if (custom?.bodyHtml) html = interpolate(custom.bodyHtml, vars);
  }

  const msg = {
    to,
    from: buildFrom(branding),
    replyTo: buildReplyTo(branding),
    subject,
    html,
  };

  const response = await sgMail.send(msg);
  return { success: true, emailId: response[0].headers['x-message-id'] };
}

/**
 * Kit mailing reminder email to TPA scheduler
 */
export async function sendKitMailingReminder(options: {
  to: string;
  eventNumber: string;
  clientName: string;
  scheduledDate: string;
  location: string;
  branding?: TpaBranding;
  tpaOrgId?: string;
}) {
  const { to, eventNumber, clientName, scheduledDate, location, branding, tpaOrgId } = options;

  const defaultSubject = `Action Required — Mail Collection Kits for ${clientName} Event ${eventNumber}`;
  const defaultBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Mail Collection Kits Today</h2>
        <p>Collection kits need to be mailed for the following event to ensure they arrive on time:</p>
        <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
          <tr><td style="padding: 8px; color: #666;">Event</td><td style="padding: 8px; font-weight: bold;">${eventNumber}</td></tr>
          <tr><td style="padding: 8px; color: #666;">Client</td><td style="padding: 8px; font-weight: bold;">${clientName}</td></tr>
          <tr><td style="padding: 8px; color: #666;">Scheduled</td><td style="padding: 8px; font-weight: bold;">${scheduledDate}</td></tr>
          <tr><td style="padding: 8px; color: #666;">Ship To</td><td style="padding: 8px; font-weight: bold;">${location}</td></tr>
        </table>
        <p>Please ship the kits today to ensure timely arrival.</p>
      </div>
    `;

  const vars: Record<string, string> = {
    clientName,
    eventNumber,
    brandName: branding?.brandName || 'TPAEngineX',
    scheduledDate,
    location,
  };

  let subject = defaultSubject;
  let html = defaultBody;

  if (tpaOrgId) {
    const custom = await getEmailTemplate(tpaOrgId, 'kit_mailing_reminder');
    if (custom?.subject) subject = interpolate(custom.subject, vars);
    if (custom?.bodyHtml) html = interpolate(custom.bodyHtml, vars);
  }

  const msg = {
    to,
    from: buildFrom(branding),
    replyTo: buildReplyTo(branding),
    subject,
    html,
  };

  const response = await sgMail.send(msg);
  return { success: true, emailId: response[0].headers['x-message-id'] };
}

/**
 * User invitation email with login credentials
 */
export async function sendUserInviteEmail(options: {
  to: string;
  name: string;
  role: string;
  organizationName: string;
  temporaryPassword: string;
  loginUrl: string;
  branding?: TpaBranding;
}) {
  const { to, name, role, organizationName, temporaryPassword, loginUrl, branding } = options;

  const roleLabel: Record<string, string> = {
    tpa_admin: 'TPA Admin',
    tpa_staff: 'TPA Staff',
    tpa_records: 'TPA Records',
    tpa_billing: 'TPA Billing',
    client_admin: 'Client Admin',
    platform_admin: 'Platform Admin',
    collector: 'Collector',
  };

  const msg = {
    to,
    from: buildFrom(branding),
    replyTo: buildReplyTo(branding),
    subject: `You've been invited to ${organizationName} on TPAEngineX`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0B0F14; color: #FFFFFF; border-radius: 8px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #3B82F6, #8B5CF6); padding: 32px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">Welcome to TPAEngineX</h1>
        </div>
        <div style="padding: 32px;">
          <p style="color: #94A3B8; font-size: 16px;">Hi ${name},</p>
          <p style="color: #94A3B8; font-size: 14px;">
            You've been added to <strong style="color: #FFFFFF;">${organizationName}</strong> as a
            <strong style="color: #FFFFFF;">${roleLabel[role] || role}</strong>.
          </p>
          <div style="background: #111827; border: 1px solid #1E293B; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <p style="margin: 0 0 8px; color: #64748B; font-size: 12px; text-transform: uppercase;">Your login credentials</p>
            <p style="margin: 0 0 4px; color: #94A3B8; font-size: 14px;">Email: <strong style="color: #FFFFFF;">${to}</strong></p>
            <p style="margin: 0; color: #94A3B8; font-size: 14px;">Temporary Password: <strong style="color: #FFFFFF;">${temporaryPassword}</strong></p>
          </div>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #3B82F6, #8B5CF6); color: #FFFFFF; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">
              Sign In Now
            </a>
          </div>
          <p style="color: #64748B; font-size: 12px; text-align: center;">
            We recommend changing your password after your first login.
          </p>
        </div>
        <div style="border-top: 1px solid #1E293B; padding: 16px 32px; text-align: center;">
          <p style="color: #64748B; font-size: 12px; margin: 0;">
            TPAEngineX — Operations & compliance infrastructure for TPAs
          </p>
        </div>
      </div>
    `,
  };

  const response = await sgMail.send(msg);
  return { success: true, emailId: response[0].headers['x-message-id'] };
}

/**
 * Send a lead pipeline stage email (customizable template)
 */
export async function sendLeadStageEmail(options: {
  to: string;
  subject: string;
  body: string; // Already has placeholders replaced
  branding?: TpaBranding;
}) {
  const { to, subject, body, branding } = options;

  const msg = {
    to,
    from: buildFrom(branding),
    replyTo: buildReplyTo(branding),
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        ${body}
      </div>
    `,
  };

  const response = await sgMail.send(msg);
  return { success: true, emailId: response[0].headers['x-message-id'] };
}

/**
 * Invoice email to client when status changes to "sent"
 */
export async function sendInvoiceEmail(options: {
  to: string;
  invoiceNumber: string;
  clientName: string;
  amount: number; // cents
  dueDate: string;
  tpaBrandName: string;
  branding?: TpaBranding;
}) {
  const { to, invoiceNumber, clientName, amount, dueDate, tpaBrandName, branding } = options;
  const formattedAmount = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount / 100);

  const msg = {
    to,
    from: buildFrom(branding),
    replyTo: buildReplyTo(branding),
    subject: `Invoice ${invoiceNumber} — ${clientName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Invoice from ${tpaBrandName}</h2>
        <p>Please find your invoice details below:</p>
        <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
          <tr><td style="padding: 8px; color: #666;">Invoice #</td><td style="padding: 8px; font-weight: bold;">${invoiceNumber}</td></tr>
          <tr><td style="padding: 8px; color: #666;">Client</td><td style="padding: 8px; font-weight: bold;">${clientName}</td></tr>
          <tr><td style="padding: 8px; color: #666;">Amount Due</td><td style="padding: 8px; font-weight: bold; color: #2563eb;">${formattedAmount}</td></tr>
          <tr><td style="padding: 8px; color: #666;">Due Date</td><td style="padding: 8px; font-weight: bold;">${dueDate}</td></tr>
        </table>
        <p>Please remit payment by the due date. If you have questions about this invoice, contact your TPA administrator.</p>
        <p>Thank you for your business.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">${tpaBrandName} — Sent via TPAEngineX</p>
      </div>
    `,
  };

  const response = await sgMail.send(msg);
  return { success: true, emailId: response[0].headers['x-message-id'] };
}

/**
 * Overdue invoice notification email to TPA billing staff
 */
export async function sendInvoiceOverdueNotification(options: {
  to: string;
  invoiceNumber: string;
  clientName: string;
  amount: number; // cents
  dueDate: string;
  daysPastDue: number;
  branding?: TpaBranding;
}) {
  const { to, invoiceNumber, clientName, amount, dueDate, daysPastDue, branding } = options;
  const formattedAmount = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount / 100);

  const msg = {
    to,
    from: buildFrom(branding),
    replyTo: buildReplyTo(branding),
    subject: `Overdue Invoice — ${invoiceNumber} | ${clientName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Invoice Overdue</h2>
        <p>The following invoice is past its due date and requires attention:</p>
        <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
          <tr><td style="padding: 8px; color: #666;">Invoice #</td><td style="padding: 8px; font-weight: bold;">${invoiceNumber}</td></tr>
          <tr><td style="padding: 8px; color: #666;">Client</td><td style="padding: 8px; font-weight: bold;">${clientName}</td></tr>
          <tr><td style="padding: 8px; color: #666;">Amount</td><td style="padding: 8px; font-weight: bold;">${formattedAmount}</td></tr>
          <tr><td style="padding: 8px; color: #666;">Due Date</td><td style="padding: 8px; font-weight: bold; color: #dc2626;">${dueDate}</td></tr>
          <tr><td style="padding: 8px; color: #666;">Days Past Due</td><td style="padding: 8px; font-weight: bold; color: #dc2626;">${daysPastDue}</td></tr>
        </table>
        <p>Please follow up with the client to collect payment.</p>
      </div>
    `,
  };

  const response = await sgMail.send(msg);
  return { success: true, emailId: response[0].headers['x-message-id'] };
}

// ============================================================================
// DQF Email Templates
// ============================================================================

/**
 * Annual review reminder email to TPA staff
 */
export async function sendAnnualReviewReminder(options: {
  tpaOrgId: string;
  personName: string;
  reviewDate: string;
  recipientEmail: string;
  branding?: TpaBranding;
}) {
  const { tpaOrgId, personName, reviewDate, recipientEmail, branding } = options;

  const defaultSubject = `Annual Review Due — ${personName}`;
  const defaultBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #d97706;">Annual Review Reminder</h2>
          <p>An annual driver qualification review is coming up and requires your attention.</p>
          <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
            <tr><td style="padding: 8px; color: #666;">Driver</td><td style="padding: 8px; font-weight: bold;">${personName}</td></tr>
            <tr><td style="padding: 8px; color: #666;">Scheduled Date</td><td style="padding: 8px; font-weight: bold;">${reviewDate}</td></tr>
          </table>
          <p>Please ensure all required documentation is current and schedule the review with the driver.</p>
          <p><strong>Action Items:</strong></p>
          <ul>
            <li>Verify current qualifications are up to date</li>
            <li>Prepare review documentation</li>
            <li>Schedule meeting with driver if needed</li>
          </ul>
        </div>
      `;

  const vars: Record<string, string> = {
    personName,
    reviewDate,
    brandName: branding?.brandName || 'TPAEngineX',
  };

  let subject = defaultSubject;
  let html = defaultBody;

  if (tpaOrgId) {
    const custom = await getEmailTemplate(tpaOrgId, 'annual_review_reminder');
    if (custom?.subject) subject = interpolate(custom.subject, vars);
    if (custom?.bodyHtml) html = interpolate(custom.bodyHtml, vars);
  }

  try {
    const msg = {
      to: recipientEmail,
      from: buildFrom(branding),
      replyTo: buildReplyTo(branding),
      subject,
      html,
    };

    const response = await sgMail.send(msg);
    return { success: true, emailId: response[0].headers['x-message-id'] };
  } catch (error) {
    console.error('Error in sendAnnualReviewReminder:', error);
    throw error;
  }
}

/**
 * License/qualification expiry alert email to TPA staff and records
 */
export async function sendLicenseExpiryAlert(options: {
  tpaOrgId: string;
  personName: string;
  qualificationType: string;
  expiresAt: string;
  recipientEmails: string[];
  branding?: TpaBranding;
}) {
  const { tpaOrgId, personName, qualificationType, expiresAt, recipientEmails, branding } = options;

  const defaultSubject = `${qualificationType} Expiring — ${personName}`;
  const defaultBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">Qualification Expiring Soon</h2>
          <p>A driver qualification is approaching its expiration date and requires action.</p>
          <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
            <tr><td style="padding: 8px; color: #666;">Driver</td><td style="padding: 8px; font-weight: bold;">${personName}</td></tr>
            <tr><td style="padding: 8px; color: #666;">Qualification</td><td style="padding: 8px; font-weight: bold;">${qualificationType}</td></tr>
            <tr><td style="padding: 8px; color: #666;">Expires</td><td style="padding: 8px; font-weight: bold; color: #dc2626;">${expiresAt}</td></tr>
          </table>
          <p>Please coordinate with the driver to renew this qualification before the expiration date to maintain compliance.</p>
        </div>
      `;

  const vars: Record<string, string> = {
    personName,
    qualificationType,
    expiresAt,
    brandName: branding?.brandName || 'TPAEngineX',
  };

  let subject = defaultSubject;
  let html = defaultBody;

  if (tpaOrgId) {
    const custom = await getEmailTemplate(tpaOrgId, 'license_expiry_alert');
    if (custom?.subject) subject = interpolate(custom.subject, vars);
    if (custom?.bodyHtml) html = interpolate(custom.bodyHtml, vars);
  }

  try {
    const msg = {
      to: recipientEmails,
      from: buildFrom(branding),
      replyTo: buildReplyTo(branding),
      subject,
      html,
    };

    const response = await sgMail.send(msg);
    return { success: true, emailId: response[0].headers['x-message-id'] };
  } catch (error) {
    console.error('Error in sendLicenseExpiryAlert:', error);
    throw error;
  }
}

/**
 * Compliance report email to client admin
 */
export async function sendComplianceReport(options: {
  tpaOrgId: string;
  clientName: string;
  reportDate: string;
  recipientEmail: string;
  scores: { driverName: string; score: number }[];
  branding?: TpaBranding;
}) {
  const { clientName, reportDate, recipientEmail, scores, branding } = options;

  const scoreRows = scores
    .map(s => {
      const color = s.score >= 80 ? '#16a34a' : s.score >= 50 ? '#d97706' : '#dc2626';
      return `<tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${s.driverName}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: ${color};">${s.score}%</td>
      </tr>`;
    })
    .join('');

  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length)
    : 0;

  try {
    const msg = {
      to: recipientEmail,
      from: buildFrom(branding),
      replyTo: buildReplyTo(branding),
      subject: `Compliance Report — ${clientName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Driver Compliance Report</h2>
          <p>Here is the compliance summary for <strong>${clientName}</strong> as of ${reportDate}.</p>
          <div style="background: #eff6ff; border-left: 4px solid #2563eb; padding: 12px 16px; margin: 16px 0;">
            <strong>Average Compliance Score: ${avgScore}%</strong> (${scores.length} driver${scores.length !== 1 ? 's' : ''})
          </div>
          <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
            <thead>
              <tr style="background: #f9fafb;">
                <th style="padding: 8px; text-align: left; border-bottom: 2px solid #e5e7eb;">Driver</th>
                <th style="padding: 8px; text-align: left; border-bottom: 2px solid #e5e7eb;">Score</th>
              </tr>
            </thead>
            <tbody>
              ${scoreRows}
            </tbody>
          </table>
          <p>Drivers below 80% compliance require attention. Please contact your TPA administrator for details.</p>
        </div>
      `,
    };

    const response = await sgMail.send(msg);
    return { success: true, emailId: response[0].headers['x-message-id'] };
  } catch (error) {
    console.error('Error in sendComplianceReport:', error);
    throw error;
  }
}

/**
 * Ticket form confirmation email to applicant
 */
export async function sendTicketFormConfirmation(options: {
  tpaOrgId: string;
  applicantName: string;
  applicantEmail: string;
  position: string;
  branding?: TpaBranding;
}) {
  const { tpaOrgId, applicantName, applicantEmail, position, branding } = options;
  const brandName = branding?.brandName || 'TPAEngineX';

  const defaultSubject = `Application Received — ${brandName}`;
  const defaultBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Application Received</h2>
          <p>Hello ${applicantName},</p>
          <p>Thank you for submitting your driver application${position ? ` for the <strong>${position}</strong> position` : ''}. We have received your information and it is currently under review.</p>
          <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 12px 16px; margin: 16px 0;">
            <strong>What happens next?</strong>
            <ul style="margin: 8px 0 0 0; padding-left: 20px;">
              <li>Our team will review your application</li>
              <li>We may contact you for additional documentation</li>
              <li>You will be notified of any updates to your application status</li>
            </ul>
          </div>
          <p>If you have questions, please contact us at ${branding?.replyToEmail || 'the email provided by your TPA administrator'}.</p>
          <p>Thank you,<br/>${brandName}</p>
        </div>
      `;

  const vars: Record<string, string> = {
    applicantName,
    brandName,
    position: position || '',
  };

  let subject = defaultSubject;
  let html = defaultBody;

  if (tpaOrgId) {
    const custom = await getEmailTemplate(tpaOrgId, 'ticket_form_confirmation');
    if (custom?.subject) subject = interpolate(custom.subject, vars);
    if (custom?.bodyHtml) html = interpolate(custom.bodyHtml, vars);
  }

  try {
    const msg = {
      to: applicantEmail,
      from: buildFrom(branding),
      replyTo: buildReplyTo(branding),
      subject,
      html,
    };

    const response = await sgMail.send(msg);
    return { success: true, emailId: response[0].headers['x-message-id'] };
  } catch (error) {
    console.error('Error in sendTicketFormConfirmation:', error);
    throw error;
  }
}

/**
 * Weekly compliance digest email to TPA admin/records staff
 */
export async function sendWeeklyComplianceDigest(options: {
  tpaOrgId: string;
  recipientEmail: string;
  recipientName: string;
  summary: {
    expiringQualifications: number;
    overdueReviews: number;
    pendingApplications: number;
    lowComplianceDrivers: number;
    openInvestigations: number;
  };
  topAlerts: Array<{
    type: string;
    driverName: string;
    detail: string;
  }>;
  dashboardUrl?: string;
  branding?: TpaBranding;
}) {
  const { recipientEmail, recipientName, summary, topAlerts, dashboardUrl, branding } = options;
  const brandName = branding?.brandName || 'TPAEngineX';
  const link = dashboardUrl || `${process.env.NEXTAUTH_URL || 'https://tpaenginex.com'}/dqf/compliance`;

  const alertRows = topAlerts.slice(0, 10).map(a => {
    const typeLabel: Record<string, string> = {
      license_expiring: 'License Expiring',
      medical_card_expiring: 'Med Card Expiring',
      review_overdue: 'Review Overdue',
      application_pending: 'Pending Application',
      low_compliance: 'Low Compliance',
    };
    return `<tr>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${typeLabel[a.type] || a.type}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">${a.driverName}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #666;">${a.detail}</td>
    </tr>`;
  }).join('');

  try {
    const msg = {
      to: recipientEmail,
      from: buildFrom(branding),
      replyTo: buildReplyTo(branding),
      subject: `Weekly Compliance Digest — ${brandName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
          <h2>Weekly Compliance Digest</h2>
          <p>Hi ${recipientName},</p>
          <p>Here is your DQF compliance summary for the week.</p>

          <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
            <tr><td style="padding: 10px; background: #fef3c7; border-left: 4px solid #d97706;"><strong>Expiring Qualifications (next 30 days)</strong></td><td style="padding: 10px; background: #fef3c7; text-align: right; font-size: 20px; font-weight: bold; color: #d97706;">${summary.expiringQualifications}</td></tr>
            <tr><td style="padding: 10px; background: #fee2e2; border-left: 4px solid #dc2626;"><strong>Overdue Reviews</strong></td><td style="padding: 10px; background: #fee2e2; text-align: right; font-size: 20px; font-weight: bold; color: #dc2626;">${summary.overdueReviews}</td></tr>
            <tr><td style="padding: 10px; background: #eff6ff; border-left: 4px solid #2563eb;"><strong>Pending Applications</strong></td><td style="padding: 10px; background: #eff6ff; text-align: right; font-size: 20px; font-weight: bold; color: #2563eb;">${summary.pendingApplications}</td></tr>
            <tr><td style="padding: 10px; background: #fee2e2; border-left: 4px solid #dc2626;"><strong>Low Compliance Drivers (&lt; 60%)</strong></td><td style="padding: 10px; background: #fee2e2; text-align: right; font-size: 20px; font-weight: bold; color: #dc2626;">${summary.lowComplianceDrivers}</td></tr>
            <tr><td style="padding: 10px; background: #f3f4f6; border-left: 4px solid #6b7280;"><strong>Open Investigations</strong></td><td style="padding: 10px; background: #f3f4f6; text-align: right; font-size: 20px; font-weight: bold; color: #6b7280;">${summary.openInvestigations}</td></tr>
          </table>

          ${topAlerts.length > 0 ? `
            <h3>Top Alerts</h3>
            <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
              <thead>
                <tr style="background: #f9fafb;">
                  <th style="padding: 8px; text-align: left; border-bottom: 2px solid #e5e7eb;">Type</th>
                  <th style="padding: 8px; text-align: left; border-bottom: 2px solid #e5e7eb;">Driver</th>
                  <th style="padding: 8px; text-align: left; border-bottom: 2px solid #e5e7eb;">Detail</th>
                </tr>
              </thead>
              <tbody>${alertRows}</tbody>
            </table>
          ` : '<p>No urgent alerts this week.</p>'}

          <div style="text-align: center; margin: 32px 0;">
            <a href="${link}" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">View Compliance Dashboard</a>
          </div>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #9ca3af; font-size: 12px;">${brandName} — Weekly digest sent every Monday at 8am.</p>
        </div>
      `,
    };

    const response = await sgMail.send(msg);
    return { success: true, emailId: response[0].headers['x-message-id'] };
  } catch (error) {
    console.error('Error in sendWeeklyComplianceDigest:', error);
    throw error;
  }
}

/**
 * Random selection notification — sent to person selected for random drug/alcohol testing.
 * Per 49 CFR Part 382, selected employees must be notified immediately upon selection
 * and required to report for testing as directed.
 */
export async function sendRandomSelectionNotification(options: {
  tpaOrgId: string;
  recipientEmail: string;
  recipientName: string;
  selectionType: 'drug' | 'alcohol' | 'both';
  scheduledByDate: string;
  reportingInstructions?: string;
  branding?: TpaBranding;
}) {
  const {
    tpaOrgId,
    recipientEmail,
    recipientName,
    selectionType,
    scheduledByDate,
    reportingInstructions,
    branding,
  } = options;

  const testingDescription =
    selectionType === 'both'
      ? 'drug AND alcohol'
      : selectionType === 'drug'
        ? 'drug'
        : 'alcohol';

  const defaultSubject = `You have been randomly selected for ${testingDescription} testing`;
  const defaultBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Random Testing Notification</h2>
        <p>Dear ${recipientName},</p>
        <p>You have been randomly selected for <strong>${testingDescription}</strong> testing as part of
        your employer's DOT random testing program, in accordance with 49 CFR Part 382 / Part 40.</p>
        <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
          <tr><td style="padding: 8px; color: #666;">Selection Type</td><td style="padding: 8px; font-weight: bold; text-transform: uppercase;">${selectionType}</td></tr>
          <tr><td style="padding: 8px; color: #666;">Report By</td><td style="padding: 8px; font-weight: bold;">${scheduledByDate}</td></tr>
        </table>
        <p><strong>What to do next:</strong></p>
        <ol>
          <li>Proceed directly to the designated collection site as instructed.</li>
          <li>Bring valid photo ID.</li>
          <li>Do NOT delay — refusal to test is treated as a positive result under DOT regulations.</li>
        </ol>
        ${reportingInstructions ? `<p><strong>Reporting instructions:</strong> ${reportingInstructions}</p>` : ''}
        <p>If you have questions, contact your employer or supervisor immediately.</p>
        <p style="font-size: 11px; color: #999; margin-top: 24px;">
          This notification is confidential and required by federal regulation.
          Failure to comply may result in disciplinary action up to and including termination.
        </p>
      </div>
    `;

  const vars: Record<string, string> = {
    personName: recipientName,
    recipientName,
    selectionType,
    testingType: testingDescription,
    scheduledByDate,
    reportingInstructions: reportingInstructions || '',
    brandName: branding?.brandName || 'TPAEngineX',
  };

  let subject = defaultSubject;
  let html = defaultBody;

  const custom = await getEmailTemplate(tpaOrgId, 'random_selection_notification');
  if (custom?.subject) subject = interpolate(custom.subject, vars);
  if (custom?.bodyHtml) html = interpolate(custom.bodyHtml, vars);

  const msg = {
    to: recipientEmail,
    from: buildFrom(branding),
    replyTo: buildReplyTo(branding),
    subject,
    html,
  };

  const response = await sgMail.send(msg);
  return { success: true, emailId: response[0].headers['x-message-id'] };
}

/**
 * Password reset email — sent when user requests a password reset.
 */
export async function sendPasswordResetEmail(options: {
  to: string;
  name?: string | null;
  resetUrl: string;
  branding?: TpaBranding;
}) {
  const { to, name, resetUrl, branding } = options;
  const brandName = branding?.brandName || 'TPAEngineX';
  const greeting = name ? `Hi ${name},` : 'Hi,';

  const msg = {
    to,
    from: buildFrom(branding),
    replyTo: buildReplyTo(branding),
    subject: `Reset your password — ${brandName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Reset your password</h2>
        <p>${greeting}</p>
        <p>We received a request to reset the password for your ${brandName} account. Click the button below to choose a new password:</p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${resetUrl}" style="display: inline-block; background: #2563eb; color: #FFFFFF; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600;">
            Reset Password
          </a>
        </div>
        <p style="color: #666; font-size: 13px;">Or paste this link into your browser:</p>
        <p style="color: #666; font-size: 13px; word-break: break-all;">${resetUrl}</p>
        <p style="color: #666; font-size: 13px;">This link expires in 1 hour.</p>
        <p style="color: #666; font-size: 13px;">If you didn't request this, you can safely ignore this email — your password won't change.</p>
      </div>
    `,
  };

  const response = await sgMail.send(msg);
  return { success: true, emailId: response[0].headers['x-message-id'] };
}

/**
 * Email verification — sent on signup or resend request.
 */
export async function sendEmailVerification(options: {
  to: string;
  name?: string | null;
  verifyUrl: string;
  branding?: TpaBranding;
}) {
  const { to, name, verifyUrl, branding } = options;
  const brandName = branding?.brandName || 'TPAEngineX';
  const greeting = name ? `Welcome, ${name}!` : 'Welcome!';

  const msg = {
    to,
    from: buildFrom(branding),
    replyTo: buildReplyTo(branding),
    subject: `Verify your email — ${brandName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${greeting}</h2>
        <p>Please verify your email address to finish setting up your ${brandName} account.</p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${verifyUrl}" style="display: inline-block; background: #2563eb; color: #FFFFFF; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600;">
            Verify Email
          </a>
        </div>
        <p style="color: #666; font-size: 13px;">Or paste this link into your browser:</p>
        <p style="color: #666; font-size: 13px; word-break: break-all;">${verifyUrl}</p>
        <p style="color: #666; font-size: 13px;">This link expires in 24 hours.</p>
        <p style="color: #666; font-size: 13px;">If you didn't create an account, you can safely ignore this email.</p>
      </div>
    `,
  };

  const response = await sgMail.send(msg);
  return { success: true, emailId: response[0].headers['x-message-id'] };
}

/**
 * Send test email to verify configuration
 */
export async function sendTestEmail(to: string) {
  try {
    const msg = {
      to,
      from: 'TPAEngineX <noreply@tpaenginex.com>',
      subject: 'Test Email from TPAEngineX',
      html: '<p>This is a test email from TPAEngineX. Email configuration is working correctly!</p>',
    };

    const response = await sgMail.send(msg);

    return { success: true, emailId: response[0].headers['x-message-id'] };
  } catch (error) {
    console.error('Error sending test email:', error);
    throw error;
  }
}

/**
 * MEC expiry reminder — fires ~90 days before a DOT Medical Examiner's Certificate
 * expires so the TPA staff and client can schedule the next physical in time.
 */
export async function sendMecExpiryReminder(options: {
  tpaOrgId: string;
  recipientEmail: string;
  recipientName?: string;
  driverName: string;
  expiresOn: string;  // formatted date
  daysUntil: number;
  branding?: TpaBranding;
}) {
  const { tpaOrgId, recipientEmail, recipientName, driverName, expiresOn, daysUntil, branding } = options;

  const defaultSubject = `Medical Certificate Expiring — ${driverName} (${daysUntil} days)`;
  const defaultBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #d97706;">Medical Examiner's Certificate Expiring Soon</h2>
          <p>Hello${recipientName ? ` ${recipientName}` : ''},</p>
          <p>This is a courtesy reminder that a driver's DOT Medical Examiner's Certificate (MEC) is approaching its expiration date and requires action to maintain compliance.</p>
          <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
            <tr><td style="padding: 8px; color: #666;">Driver</td><td style="padding: 8px; font-weight: bold;">${driverName}</td></tr>
            <tr><td style="padding: 8px; color: #666;">Certificate Expires</td><td style="padding: 8px; font-weight: bold; color: #dc2626;">${expiresOn}</td></tr>
            <tr><td style="padding: 8px; color: #666;">Days Remaining</td><td style="padding: 8px; font-weight: bold;">${daysUntil}</td></tr>
          </table>
          <p>Please schedule the driver for a DOT physical examination with a certified medical examiner on or before the expiration date. A driver operating a commercial motor vehicle with an expired MEC is considered medically disqualified under 49 CFR 391.41.</p>
          <p><strong>Next steps:</strong></p>
          <ul>
            <li>Contact the driver to coordinate scheduling</li>
            <li>Book a DOT physical with your medical examiner</li>
            <li>Upload the new MEC to the driver's qualification file once complete</li>
          </ul>
        </div>
      `;

  const vars: Record<string, string> = {
    driverName,
    expiresOn,
    daysUntil: String(daysUntil),
    recipientName: recipientName || '',
    brandName: branding?.brandName || 'TPAEngineX',
  };

  let subject = defaultSubject;
  let html = defaultBody;

  if (tpaOrgId) {
    const custom = await getEmailTemplate(tpaOrgId, 'mec_expiry_reminder');
    if (custom?.subject) subject = interpolate(custom.subject, vars);
    if (custom?.bodyHtml) html = interpolate(custom.bodyHtml, vars);
  }

  try {
    const msg = {
      to: recipientEmail,
      from: buildFrom(branding),
      replyTo: buildReplyTo(branding),
      subject,
      html,
    };
    const response = await sgMail.send(msg);
    return { success: true, emailId: response[0].headers['x-message-id'] };
  } catch (error) {
    console.error('Error in sendMecExpiryReminder:', error);
    throw error;
  }
}
