import { Resend } from 'resend';

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

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
    const { data, error } = await resend.emails.send({
      from: 'WorkSafe Now <noreply@worksafenow.com>',
      to,
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
                <p>This is an automated message from WorkSafe Now Portal.</p>
                <p>If you have questions, please contact your provider administrator.</p>
              </div>
            </div>
          </body>
        </html>
      `,
      attachments: [
        {
          filename: `Authorization_${orderNumber}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    if (error) {
      console.error('Error sending email:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }

    return { success: true, emailId: data?.id };
  } catch (error) {
    console.error('Error in sendAuthorizationFormEmail:', error);
    throw error;
  }
}

/**
 * Send test email to verify configuration
 */
export async function sendTestEmail(to: string) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'WorkSafe Now <noreply@worksafenow.com>',
      to: [to],
      subject: 'Test Email from WorkSafe Now',
      html: '<p>This is a test email from WorkSafe Now Portal. Email configuration is working correctly!</p>',
    });

    if (error) {
      throw new Error(`Failed to send test email: ${error.message}`);
    }

    return { success: true, emailId: data?.id };
  } catch (error) {
    console.error('Error sending test email:', error);
    throw error;
  }
}
