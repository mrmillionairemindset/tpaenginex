import { ComplianceLayout } from '@/components/compliance/compliance-layout';
import Link from 'next/link';

export const metadata = {
  title: 'Help Center | TPAEngineX',
  description: 'TPAEngineX help center and frequently asked questions',
};

export default function HelpPage() {
  return (
    <ComplianceLayout
      title="Help Center"
      lastUpdated="March 2026"
      description="Answers to common questions and guides"
    >
      <section>
        <h2>Getting Started</h2>

        <h3>How do I create an account?</h3>
        <p>
          Visit our <Link href="/auth/signup">sign up page</Link> and complete the registration
          form. You'll need to provide your organization information and choose whether you're
          an employer or provider.
        </p>

        <h3>What user roles are available?</h3>
        <ul>
          <li><strong>Employer Admin:</strong> Full access to create orders, manage candidates, and organization settings</li>
          <li><strong>Employer User:</strong> Read-only access to orders and results</li>
          <li><strong>Provider Admin:</strong> Full access to manage orders, sites, and provider settings</li>
          <li><strong>Provider Agent:</strong> Assign sites, update order status, upload results</li>
        </ul>

        <h3>How do I invite team members?</h3>
        <p>
          Navigate to Organization Settings and use the "Invite Member" feature. You'll need
          to provide their email and select their role.
        </p>
      </section>

      <section>
        <h2>For Employers</h2>

        <h3>How do I create a screening order?</h3>
        <p>
          From your dashboard, click "Orders" then "New Order." Fill in the candidate information
          and select the screening type. The order will be automatically routed to your designated
          provider.
        </p>

        <h3>When will I receive results?</h3>
        <p>
          Typical turnaround times:
        </p>
        <ul>
          <li>Drug screening: 24-48 hours after appointment</li>
          <li>Physical examination: 48-72 hours after appointment</li>
          <li>Background checks: 3-5 business days</li>
        </ul>

        <h3>Can I track order status?</h3>
        <p>
          Yes! All orders show real-time status updates:
        </p>
        <ul>
          <li><strong>New:</strong> Order created, awaiting provider assignment</li>
          <li><strong>Needs Site:</strong> Provider reviewing, assigning testing location</li>
          <li><strong>Scheduled:</strong> Appointment confirmed with candidate</li>
          <li><strong>In Progress:</strong> Candidate has attended appointment</li>
          <li><strong>Complete:</strong> Results available</li>
        </ul>

        <h3>How are candidates notified?</h3>
        <p>
          Candidates receive automated email and SMS notifications when:
        </p>
        <ul>
          <li>An order is created</li>
          <li>A site is assigned and appointment is scheduled</li>
          <li>Results are ready (sent to employer only)</li>
        </ul>
      </section>

      <section>
        <h2>For Providers</h2>

        <h3>How do I manage testing sites?</h3>
        <p>
          From your dashboard, navigate to "Sites" to add, edit, or deactivate testing locations.
          Each site includes address, contact information, hours, and available screening types.
        </p>

        <h3>How do I assign a site to an order?</h3>
        <p>
          Open the order details and click "Assign Site." The platform will suggest nearby sites
          based on the candidate's location. Select a site and confirm the appointment details.
        </p>

        <h3>How do I upload results?</h3>
        <p>
          Navigate to the order and click "Upload Results." You can upload PDF documents or enter
          results manually. All uploaded documents are encrypted and stored securely.
        </p>

        <h3>Can I see performance metrics?</h3>
        <p>
          Provider admins have access to analytics including:
        </p>
        <ul>
          <li>Average turnaround time</li>
          <li>Orders by status and employer</li>
          <li>Site utilization rates</li>
          <li>Monthly volume trends</li>
        </ul>
      </section>

      <section>
        <h2>Security & Compliance</h2>

        <h3>Is TPAEngineX HIPAA compliant?</h3>
        <p>
          Yes. We implement comprehensive administrative, physical, and technical safeguards
          required by HIPAA. Learn more on our <Link href="/hipaa">HIPAA Compliance</Link> page.
        </p>

        <h3>Do I need a Business Associate Agreement?</h3>
        <p>
          If you're a covered entity or business associate handling PHI, yes. Contact us at{' '}
          <a href="mailto:compliance@tpaenginex.com">compliance@tpaenginex.com</a> to execute
          a BAA. View our template <Link href="/baa">here</Link>.
        </p>

        <h3>How is my data protected?</h3>
        <ul>
          <li>All data encrypted in transit (TLS 1.3) and at rest (AES-256)</li>
          <li>Role-based access controls</li>
          <li>Comprehensive audit logging</li>
          <li>SOC 2 Type II certified infrastructure</li>
          <li>Regular security assessments and penetration testing</li>
        </ul>

        <h3>What happens if there's a security incident?</h3>
        <p>
          We have a comprehensive incident response plan. Breaches affecting PHI are reported
          to covered entities within 48 hours. Report incidents to{' '}
          <a href="mailto:security@tpaenginex.com">security@tpaenginex.com</a> or call
          (888) 555-0199.
        </p>
      </section>

      <section>
        <h2>Billing & Payments</h2>

        <h3>How does billing work?</h3>
        <p>
          Pricing is established in your service agreement. Most clients are billed monthly
          based on order volume.
        </p>

        <h3>What payment methods are accepted?</h3>
        <ul>
          <li>ACH/bank transfer</li>
          <li>Credit card (Visa, Mastercard, Amex)</li>
          <li>Wire transfer (for enterprise clients)</li>
        </ul>

        <h3>Can I get invoices for accounting?</h3>
        <p>
          Yes. Invoices are automatically generated and sent to your billing email address.
          You can also download past invoices from Organization Settings.
        </p>
      </section>

      <section>
        <h2>Technical Support</h2>

        <h3>What browsers are supported?</h3>
        <p>
          TPAEngineX works best with modern browsers:
        </p>
        <ul>
          <li>Chrome (recommended)</li>
          <li>Firefox</li>
          <li>Safari</li>
          <li>Edge</li>
        </ul>
        <p>
          Internet Explorer is not supported. We recommend always using the latest browser version.
        </p>

        <h3>Is there a mobile app?</h3>
        <p>
          Not currently, but our platform is fully responsive and works on mobile browsers.
          A native mobile app is on our roadmap.
        </p>

        <h3>Can I integrate TPAEngineX with my existing systems?</h3>
        <p>
          Yes. We offer API access for enterprise clients to integrate with HR systems, ATS
          platforms, and other tools. Contact{' '}
          <a href="mailto:sales@tpaenginex.com">sales@tpaenginex.com</a> to discuss integration options.
        </p>

        <h3>I'm experiencing technical issues. Who do I contact?</h3>
        <p>
          For technical support:
        </p>
        <ul>
          <li>Email: <a href="mailto:support@tpaenginex.com">support@tpaenginex.com</a></li>
          <li>Phone: (888) 555-0100</li>
          <li>Emergency hotline: (888) 555-0199 (24/7)</li>
        </ul>
      </section>

      <section>
        <h2>Still Have Questions?</h2>
        <p>
          Can't find what you're looking for? We're here to help:
        </p>
        <ul>
          <li>Visit our <Link href="/faq">FAQ page</Link></li>
          <li>Email us at <a href="mailto:support@tpaenginex.com">support@tpaenginex.com</a></li>
          <li>Call (888) 555-0100</li>
          <li>Check our <Link href="/contact">contact page</Link> for department-specific contacts</li>
        </ul>
      </section>
    </ComplianceLayout>
  );
}
