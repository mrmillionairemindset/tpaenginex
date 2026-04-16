import { ComplianceLayout } from '@/components/compliance/compliance-layout';

export const metadata = {
  title: 'Terms of Service | TPAEngineX',
  description: 'Terms of Service for TPAEngineX operations and compliance platform for TPAs',
};

export default function TermsOfServicePage() {
  return (
    <ComplianceLayout
      title="Terms of Service"
      lastUpdated="March 2026"
      description="Legal terms governing your use of the TPAEngineX"
    >
      <section>
        <h2>1. Acceptance of Terms</h2>
        <p>
          By accessing or using the TPAEngineX ("Platform"), you agree to be bound
          by these Terms of Service ("Terms"). If you do not agree to these Terms, you may
          not use the Platform.
        </p>
        <p>
          These Terms constitute a legally binding agreement between you and TPAEngineX
          Platform ("TPAEngineX," "we," "our," or "us").
        </p>
      </section>

      <section>
        <h2>2. Description of Service</h2>
        <p>
          TPAEngineX provides an operations, workflow coordination, and compliance platform
          designed for third-party administrators (TPAs), employers, and service providers.
        </p>
        <p>The Platform enables users to:</p>
        <ul>
          <li>Manage and coordinate screening-related workflows</li>
          <li>Facilitate scheduling and communication with third-party providers</li>
          <li>Track order status, results, and operational processes</li>
          <li>Support compliance and documentation requirements</li>
        </ul>
        <p>
          TPAEngineX provides infrastructure and coordination tools but does not provide
          medical services, clinical decisions, or testing services. All such services are
          provided by independent third-party providers.
        </p>
      </section>

      <section>
        <h2>3. User Accounts and Registration</h2>

        <h3>3.1 Account Creation</h3>
        <ul>
          <li>You must provide accurate and complete information during registration</li>
          <li>You are responsible for maintaining the confidentiality of your credentials</li>
          <li>You must notify us immediately of any unauthorized access</li>
          <li>You must be at least 18 years of age to create an account</li>
        </ul>

        <h3>3.2 Organization Accounts</h3>
        <ul>
          <li>TPA and client accounts are organization-based</li>
          <li>Organization administrators control user access and permissions</li>
          <li>You represent that you have authority to bind your organization</li>
        </ul>

        <h3>3.3 Account Termination</h3>
        <p>
          We reserve the right to suspend or terminate accounts that violate these Terms,
          engage in fraudulent activity, or pose security risks.
        </p>
      </section>

      <section>
        <h2>4. User Roles and Responsibilities</h2>

        <h3>4.1 TPA Users</h3>
        <ul>
          <li>Manage operational workflows and coordinate service execution</li>
          <li>Assign collectors and manage scheduling for service events</li>
          <li>Upload accurate and timely results</li>
          <li>Maintain HIPAA compliance and data security standards</li>
          <li>Respond promptly to order assignments and status updates</li>
        </ul>

        <h3>4.2 Client Users</h3>
        <ul>
          <li>Submit accurate service requests with complete individual information</li>
          <li>Ensure compliance with employment laws and regulations</li>
          <li>Obtain necessary individual authorizations and consents</li>
          <li>Handle screening results in accordance with applicable laws</li>
        </ul>

        <h3>4.3 All Users</h3>
        <ul>
          <li>Comply with all applicable laws and regulations</li>
          <li>Protect confidential and health information</li>
          <li>Use the Platform only for legitimate business purposes</li>
          <li>Report security vulnerabilities or data breaches immediately</li>
        </ul>
      </section>

      <section>
        <h2>5. Prohibited Conduct</h2>

        <p>You may not:</p>
        <ul>
          <li>Violate any laws or regulations</li>
          <li>Infringe on intellectual property rights</li>
          <li>Upload malicious code or attempt unauthorized access</li>
          <li>Interfere with Platform operations or other users</li>
          <li>Harvest or collect user data without authorization</li>
          <li>Misrepresent your identity or affiliation</li>
          <li>Use the Platform for discriminatory purposes</li>
          <li>Transmit spam or unsolicited communications</li>
        </ul>
      </section>

      <section>
        <h2>6. Privacy and Data Protection</h2>

        <p>
          Your use of the Platform is subject to our <a href="/privacy">Privacy Policy</a>,
          which is incorporated into these Terms by reference.
        </p>
        <p>
          We comply with HIPAA and other applicable privacy regulations. Protected Health
          Information (PHI) is handled in accordance with our
          <a href="/baa"> Business Associate Agreement</a> and
          <a href="/hipaa"> HIPAA Compliance</a> policies.
        </p>
        <p>
          Where applicable, TPAEngineX enters into Business Associate Agreements (BAAs) with
          covered entities and service providers to ensure HIPAA compliance.
        </p>
      </section>

      <section>
        <h2>7. Payment and Fees</h2>

        <h3>7.1 Service Fees</h3>
        <ul>
          <li>Pricing is established in your service agreement or order form</li>
          <li>Fees are due according to the payment terms in your agreement</li>
          <li>We reserve the right to modify pricing with 30 days' notice</li>
        </ul>

        <h3>7.2 Payment Processing</h3>
        <ul>
          <li>Payment information is processed by third-party payment processors</li>
          <li>You authorize us to charge your payment method for applicable fees</li>
          <li>Late payments may result in service suspension or termination</li>
        </ul>

        <h3>7.3 Refunds</h3>
        <ul>
          <li>Refund eligibility is determined case-by-case</li>
          <li>All fees are non-refundable unless otherwise stated in writing</li>
          <li>Contact <a href="mailto:billing@tpaenginex.com">billing@tpaenginex.com</a> for refund requests</li>
        </ul>
      </section>

      <section>
        <h2>8. Intellectual Property</h2>

        <h3>8.1 TPAEngineX IP</h3>
        <p>
          The Platform, including all content, features, and functionality, is owned by
          TPAEngineX and protected by copyright, trademark, and other intellectual
          property laws.
        </p>

        <h3>8.2 User Content</h3>
        <p>
          You retain ownership of data you submit to the Platform. By submitting content,
          you grant us a limited license to use, store, and process it to provide our
          services.
        </p>

        <h3>8.3 Feedback</h3>
        <p>
          Any feedback, suggestions, or ideas you provide may be used by TPAEngineX
          without compensation or attribution.
        </p>
      </section>

      <section>
        <h2>9. No Medical Advice</h2>
        <p>
          TPAEngineX does not provide medical advice, diagnosis, or treatment. All medical
          services are provided by independent third-party providers. Users should consult
          qualified healthcare professionals for medical decisions.
        </p>
      </section>

      <section>
        <h2>10. No Employment Decision Liability</h2>
        <p>
          TPAEngineX is not responsible for employment decisions made by client companies based on
          screening results or platform data. Client companies are solely responsible for compliance
          with employment laws, including FCRA and EEOC regulations.
        </p>
      </section>

      <section>
        <h2>11. Data Accuracy</h2>
        <p>
          TPAEngineX does not guarantee the accuracy, completeness, or timeliness of data
          provided by third-party providers or users.
        </p>
      </section>

      <section>
        <h2>12. Service Availability</h2>
        <p>
          We do not guarantee continuous, uninterrupted, or secure access to the Platform.
          Maintenance, updates, or external factors may result in temporary service
          interruptions.
        </p>
      </section>

      <section>
        <h2>13. Disclaimer of Warranties</h2>

        <p>
          THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY
          KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO:
        </p>
        <ul>
          <li>Warranties of merchantability or fitness for a particular purpose</li>
          <li>Warranties regarding accuracy, reliability, or completeness</li>
          <li>Warranties of uninterrupted or error-free operation</li>
        </ul>
        <p>
          TPAEngineX does not warrant that the Platform will meet your requirements or
          that defects will be corrected.
        </p>
      </section>

      <section>
        <h2>14. Limitation of Liability</h2>

        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, TPAENGINEX SHALL NOT BE LIABLE FOR:
        </p>
        <ul>
          <li>Indirect, incidental, special, or consequential damages</li>
          <li>Loss of profits, revenue, data, or business opportunities</li>
          <li>Damages arising from third-party services or testing facilities</li>
          <li>Damages exceeding the fees paid by you in the 12 months preceding the claim</li>
        </ul>
        <p>
          Some jurisdictions do not allow limitation of certain damages, so these
          limitations may not apply to you.
        </p>
      </section>

      <section>
        <h2>15. Indemnification</h2>

        <p>
          You agree to indemnify and hold harmless TPAEngineX from any claims, damages,
          losses, or expenses (including legal fees) arising from:
        </p>
        <ul>
          <li>Your violation of these Terms</li>
          <li>Your violation of any laws or third-party rights</li>
          <li>Your use of the Platform</li>
          <li>Content you submit to the Platform</li>
        </ul>
      </section>

      <section>
        <h2>16. Third-Party Services</h2>

        <p>
          The Platform integrates with third-party services (testing facilities, payment
          processors, etc.). We are not responsible for:
        </p>
        <ul>
          <li>The availability, accuracy, or quality of third-party services</li>
          <li>Third-party terms, policies, or practices</li>
          <li>Acts or omissions of third-party providers</li>
        </ul>
        <p>
          Your use of third-party services is subject to their respective terms and
          conditions.
        </p>
      </section>

      <section>
        <h2>17. Dispute Resolution</h2>

        <h3>13.1 Informal Resolution</h3>
        <p>
          Before filing a claim, you agree to contact us at
          <a href="mailto:legal@tpaenginex.com"> legal@tpaenginex.com</a> to seek
          informal resolution.
        </p>

        <h3>13.2 Arbitration</h3>
        <p>
          Any disputes not resolved informally shall be resolved through binding
          arbitration in accordance with the American Arbitration Association rules,
          unless you opt out within 30 days of accepting these Terms.
        </p>

        <h3>13.3 Class Action Waiver</h3>
        <p>
          You agree to resolve disputes individually and waive the right to participate
          in class actions or representative proceedings.
        </p>
      </section>

      <section>
        <h2>18. Modifications to Terms</h2>

        <p>
          We may modify these Terms at any time. Material changes will be communicated
          via email or Platform notice at least 30 days before taking effect.
        </p>
        <p>
          Continued use of the Platform after changes constitutes acceptance. If you
          disagree with changes, you may terminate your account.
        </p>
      </section>

      <section>
        <h2>19. Termination</h2>

        <h3>15.1 By You</h3>
        <p>
          You may terminate your account at any time by contacting us. Termination does
          not relieve you of payment obligations for services already rendered.
        </p>

        <h3>15.2 By TPAEngineX</h3>
        <p>
          We may suspend or terminate your access immediately for:
        </p>
        <ul>
          <li>Violation of these Terms</li>
          <li>Fraudulent or illegal activity</li>
          <li>Non-payment of fees</li>
          <li>Security threats or abuse</li>
        </ul>

        <h3>15.3 Effect of Termination</h3>
        <p>
          Upon termination, your access will cease and certain data may be deleted per
          our retention policies. Sections that by nature should survive (indemnification,
          limitation of liability, etc.) will remain in effect.
        </p>
      </section>

      <section>
        <h2>20. General Provisions</h2>

        <h3>16.1 Governing Law</h3>
        <p>
          These Terms are governed by the laws of the State of Arkansas, without regard to
          conflict of law principles.
        </p>

        <h3>16.2 Entire Agreement</h3>
        <p>
          These Terms, together with the Privacy Policy and any service agreements,
          constitute the entire agreement between you and TPAEngineX.
        </p>

        <h3>16.3 Severability</h3>
        <p>
          If any provision is found unenforceable, the remaining provisions remain in
          full effect.
        </p>

        <h3>16.4 No Waiver</h3>
        <p>
          Failure to enforce any right or provision does not constitute a waiver of that
          right or provision.
        </p>

        <h3>16.5 Assignment</h3>
        <p>
          You may not assign these Terms without our consent. We may assign our rights
          and obligations without restriction.
        </p>
      </section>

      <section>
        <h2>21. Contact Information</h2>

        <p>For questions about these Terms:</p>
        <ul>
          <li><strong>Email:</strong> <a href="mailto:legal@tpaenginex.com">legal@tpaenginex.com</a></li>
          <li><strong>Mail:</strong> TPAEngineX, Legal Department, Little Rock, AR</li>
        </ul>
      </section>
    </ComplianceLayout>
  );
}
