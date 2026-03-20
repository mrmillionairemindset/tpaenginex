import { ComplianceLayout } from '@/components/compliance/compliance-layout';
import Link from 'next/link';

export const metadata = {
  title: 'FAQ | TPAEngineX',
  description: 'Frequently asked questions about TPAEngineX',
};

export default function FAQPage() {
  return (
    <ComplianceLayout
      title="Frequently Asked Questions"
      lastUpdated="January 2025"
      description="Quick answers to common questions"
    >
      <section>
        <h2>General Questions</h2>

        <h3>What is TPAEngineX?</h3>
        <p>
          TPAEngineX is a healthcare screening coordination platform that connects employers,
          screening providers, and testing facilities. We streamline the entire pre-employment
          and employee screening process from order creation to result delivery.
        </p>

        <h3>Who uses TPAEngineX?</h3>
        <ul>
          <li><strong>Employers:</strong> Companies requiring pre-employment or employee health screenings</li>
          <li><strong>Screening Providers:</strong> Organizations that coordinate drug tests, physicals, and other screenings</li>
          <li><strong>Testing Facilities:</strong> Clinics and labs (like Concentra) where appointments take place</li>
        </ul>

        <h3>How much does TPAEngineX cost?</h3>
        <p>
          Pricing varies based on order volume and service level. Contact{' '}
          <a href="mailto:sales@tpaenginex.com">sales@tpaenginex.com</a> for a custom quote.
        </p>

        <h3>Is there a free trial?</h3>
        <p>
          Yes! We offer a 30-day trial for new organizations. Sign up at{' '}
          <Link href="/auth/signup">our registration page</Link>.
        </p>
      </section>

      <section>
        <h2>Account & Setup</h2>

        <h3>How long does setup take?</h3>
        <p>
          Most organizations are up and running within 24-48 hours. Setup includes:
        </p>
        <ul>
          <li>Account creation and user onboarding</li>
          <li>Configuring organization settings</li>
          <li>Establishing provider/employer relationships</li>
          <li>Executing Business Associate Agreements (if applicable)</li>
        </ul>

        <h3>Can I have multiple organizations?</h3>
        <p>
          Yes! Users can belong to multiple organizations and switch between them using the
          organization switcher in the header.
        </p>

        <h3>How do I invite team members?</h3>
        <p>
          Navigate to Organization Settings → Team Members → Invite. Enter their email and
          select their role. They'll receive an invitation email with setup instructions.
        </p>

        <h3>Can I change my organization type?</h3>
        <p>
          Organization type (employer or provider) cannot be changed after creation. If you
          need both, create separate organizations.
        </p>
      </section>

      <section>
        <h2>Orders & Screening</h2>

        <h3>What types of screenings are supported?</h3>
        <ul>
          <li>Pre-employment drug testing (urine, hair, saliva)</li>
          <li>DOT drug and alcohol testing</li>
          <li>Pre-employment physical examinations</li>
          <li>Fit-for-duty evaluations</li>
          <li>TB testing</li>
          <li>Respirator fit testing</li>
        </ul>

        <h3>How quickly can screenings be scheduled?</h3>
        <p>
          Most appointments are scheduled within 24-48 hours of order creation, depending on
          candidate availability and testing site capacity.
        </p>

        <h3>Can candidates choose their testing location?</h3>
        <p>
          Providers suggest nearby testing sites based on the candidate's address. While
          candidates can request alternatives, the provider makes the final assignment based
          on availability and network agreements.
        </p>

        <h3>What if a candidate misses their appointment?</h3>
        <p>
          Candidates can reschedule through the notification link or by contacting the provider.
          Repeated no-shows may result in order cancellation at the employer's discretion.
        </p>

        <h3>How are results delivered?</h3>
        <p>
          Results are securely uploaded to the platform and made available to the employer.
          Employers receive an email notification when results are ready. Candidates do not
          receive results directly (results go to the employer only).
        </p>
      </section>

      <section>
        <h2>Privacy & Security</h2>

        <h3>Is my data secure?</h3>
        <p>
          Absolutely. We implement:
        </p>
        <ul>
          <li>End-to-end encryption (TLS 1.3 in transit, AES-256 at rest)</li>
          <li>Role-based access controls</li>
          <li>Comprehensive audit logging</li>
          <li>Regular security audits and penetration testing</li>
          <li>SOC 2 Type II certified infrastructure</li>
        </ul>

        <h3>Are you HIPAA compliant?</h3>
        <p>
          Yes. We comply with all HIPAA Privacy, Security, and Breach Notification Rules.
          Learn more on our <Link href="/hipaa">HIPAA Compliance page</Link>.
        </p>

        <h3>Do you sell my data?</h3>
        <p>
          Never. We do not sell, rent, or share your data with third parties except as
          necessary to provide our services (e.g., with testing facilities for appointments)
          or as required by law.
        </p>

        <h3>How long do you retain data?</h3>
        <ul>
          <li>Protected Health Information (PHI): 7 years (legal requirement)</li>
          <li>Account data: Duration of active account</li>
          <li>Audit logs: 6 years (HIPAA requirement)</li>
        </ul>

        <h3>Can I request data deletion?</h3>
        <p>
          Yes, but PHI retention is governed by legal requirements. Contact{' '}
          <a href="mailto:privacy@tpaenginex.com">privacy@tpaenginex.com</a> to discuss
          data deletion requests.
        </p>
      </section>

      <section>
        <h2>Technical</h2>

        <h3>Do you have an API?</h3>
        <p>
          Yes! API access is available for enterprise clients. Our REST API supports:
        </p>
        <ul>
          <li>Creating and managing orders programmatically</li>
          <li>Retrieving order status and results</li>
          <li>Webhook notifications for status changes</li>
          <li>Candidate management</li>
        </ul>
        <p>
          Contact <a href="mailto:sales@tpaenginex.com">sales@tpaenginex.com</a> for API documentation.
        </p>

        <h3>Can I integrate with my ATS/HR system?</h3>
        <p>
          Yes. We offer pre-built integrations with popular ATS platforms and can develop
          custom integrations via our API.
        </p>

        <h3>What browsers are supported?</h3>
        <p>
          Chrome, Firefox, Safari, and Edge (latest versions). Internet Explorer is not supported.
        </p>

        <h3>Is there a mobile app?</h3>
        <p>
          Not currently, but our web platform is fully responsive and works on mobile devices.
          A native app is on our roadmap for 2025.
        </p>

        <h3>What happens if the platform goes down?</h3>
        <p>
          We maintain 99.9% uptime SLA with redundant infrastructure. In the unlikely event
          of an outage:
        </p>
        <ul>
          <li>Our team is alerted immediately</li>
          <li>Status updates posted at status.tpaenginex.com</li>
          <li>Critical workflows (notifications, result uploads) prioritized</li>
          <li>Scheduled maintenance announced 7 days in advance</li>
        </ul>
      </section>

      <section>
        <h2>Billing & Payments</h2>

        <h3>How am I billed?</h3>
        <p>
          Most clients are billed monthly based on order volume. Enterprise clients may have
          custom billing arrangements.
        </p>

        <h3>What payment methods do you accept?</h3>
        <ul>
          <li>ACH/bank transfer</li>
          <li>Credit card (Visa, Mastercard, Amex)</li>
          <li>Wire transfer (enterprise only)</li>
        </ul>

        <h3>Can I get a refund?</h3>
        <p>
          Refund eligibility depends on the circumstances. Services already rendered are
          generally non-refundable. Contact{' '}
          <a href="mailto:billing@tpaenginex.com">billing@tpaenginex.com</a> for specific requests.
        </p>

        <h3>What happens if my payment fails?</h3>
        <p>
          We'll notify you via email and attempt to retry the payment. After 3 failed attempts,
          your account may be suspended. Update your payment method to restore access.
        </p>
      </section>

      <section>
        <h2>Support</h2>

        <h3>How do I get help?</h3>
        <ul>
          <li>Email: <a href="mailto:support@tpaenginex.com">support@tpaenginex.com</a></li>
          <li>Phone: (888) 555-0100 (Mon-Fri, 8 AM - 6 PM EST)</li>
          <li>Emergency: (888) 555-0199 (24/7 for critical issues)</li>
          <li>Help Center: <Link href="/help">help center</Link></li>
        </ul>

        <h3>What are your support hours?</h3>
        <ul>
          <li><strong>Standard Support:</strong> Monday-Friday, 8 AM - 6 PM EST</li>
          <li><strong>Emergency Support:</strong> 24/7 via hotline (888) 555-0199</li>
          <li><strong>Email Support:</strong> Monitored 24/7, typical response within 4 hours</li>
        </ul>

        <h3>Do you offer training?</h3>
        <p>
          Yes! All new clients receive:
        </p>
        <ul>
          <li>Live onboarding session (1 hour)</li>
          <li>Role-specific training materials</li>
          <li>Video tutorials</li>
          <li>Access to help documentation</li>
        </ul>
        <p>
          Additional training sessions can be scheduled as needed.
        </p>
      </section>

      <section>
        <h2>Still Have Questions?</h2>
        <p>
          Can't find what you're looking for?
        </p>
        <ul>
          <li>Check our <Link href="/help">Help Center</Link> for detailed guides</li>
          <li>Email us at <a href="mailto:support@tpaenginex.com">support@tpaenginex.com</a></li>
          <li>Call (888) 555-0100</li>
          <li>Visit our <Link href="/contact">Contact page</Link></li>
        </ul>
      </section>
    </ComplianceLayout>
  );
}
