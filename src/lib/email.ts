import sgMail from '@sendgrid/mail';

// Initialize SendGrid client
sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

interface SendAuthorizationFormEmailOptions {
  to: string[];
  orderNumber: string;
  candidateName: string;
  employerName: string;
  pdfBuffer: Buffer;
}

/**
 * Send authorization form PDF via email
 */
export async function sendAuthorizationFormEmail(options: SendAuthorizationFormEmailOptions) {
  const { to, orderNumber, candidateName, employerName, pdfBuffer } = options;

  try {
    const msg = {
      to,
      from: 'TPAEngineX <noreply@tpaenginex.com>',
      subject: `Authorization Form for ${candidateName} - Order ${orderNumber}`,
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

                <p>The custom authorization form for <strong>${candidateName}</strong> has been generated and is ready for use.</p>

                <div class="info-box">
                  <p><strong>Order Number:</strong> ${orderNumber}</p>
                  <p><strong>Candidate:</strong> ${candidateName}</p>
                  <p><strong>Employer:</strong> ${employerName}</p>
                </div>

                <p>The authorization form PDF is attached to this email. Please review and provide it to the candidate to use at their chosen testing location.</p>

                <p><strong>Next Steps:</strong></p>
                <ul>
                  <li>Review the attached authorization form</li>
                  <li>Forward to the candidate or provide instructions</li>
                  <li>Candidate can choose any certified testing facility</li>
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
}) {
  const { to, orderNumber, clientName, collectorName, scheduledDate, location } = options;

  const msg = {
    to,
    from: DEFAULT_FROM,
    subject: `Collector Confirmed for Order ${orderNumber} — ${clientName}`,
    html: `
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
    `,
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
}) {
  const { to, orderNumber, clientName, donorName, serviceType, reviewLink } = options;

  const msg = {
    to,
    from: DEFAULT_FROM,
    subject: `Collection Complete — Order ${orderNumber} | ${clientName}`,
    html: `
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
    `,
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
}) {
  const { to, eventNumber, clientName, totalDone, totalPending, eventDate } = options;

  const msg = {
    to,
    from: DEFAULT_FROM,
    subject: `Collection Event Summary — ${clientName} | ${eventDate}`,
    html: `
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
    `,
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
}) {
  const { to, eventNumber, pendingCount, daysSinceEvent } = options;

  const msg = {
    to,
    from: DEFAULT_FROM,
    subject: `${pendingCount} Results Still Pending — ${eventNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #d97706;">Results Pending Action</h2>
        <p><strong>${pendingCount}</strong> result(s) are still pending for event <strong>${eventNumber}</strong>.</p>
        <p>It has been <strong>${daysSinceEvent} day(s)</strong> since the collection date.</p>
        <p>Please follow up with the laboratory or MRO to obtain the outstanding results.</p>
      </div>
    `,
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
}) {
  const { to, eventNumber, clientName, scheduledDate, location } = options;

  const msg = {
    to,
    from: DEFAULT_FROM,
    subject: `Action Required — Mail Collection Kits for ${clientName} Event ${eventNumber}`,
    html: `
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
    `,
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
}) {
  const { to, name, role, organizationName, temporaryPassword, loginUrl } = options;

  const roleLabel: Record<string, string> = {
    tpa_admin: 'TPA Admin',
    tpa_staff: 'TPA Staff',
    tpa_records: 'TPA Records',
    tpa_billing: 'TPA Billing',
    client_admin: 'Client Admin',
    platform_admin: 'Platform Admin',
  };

  const msg = {
    to,
    from: DEFAULT_FROM,
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
}) {
  const { to, subject, body } = options;

  const msg = {
    to,
    from: DEFAULT_FROM,
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
}) {
  const { to, invoiceNumber, clientName, amount, dueDate, tpaBrandName } = options;
  const formattedAmount = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount / 100);

  const msg = {
    to,
    from: DEFAULT_FROM,
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
}) {
  const { to, invoiceNumber, clientName, amount, dueDate, daysPastDue } = options;
  const formattedAmount = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount / 100);

  const msg = {
    to,
    from: DEFAULT_FROM,
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
