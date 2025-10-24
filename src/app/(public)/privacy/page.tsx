import { ComplianceLayout } from '@/components/compliance/compliance-layout';

export const metadata = {
  title: 'Privacy Policy | Worksafe Now Platform',
  description: 'Privacy Policy for Worksafe Now healthcare screening platform',
};

export default function PrivacyPolicyPage() {
  return (
    <ComplianceLayout
      title="Privacy Policy"
      lastUpdated="January 2025"
      description="How we collect, use, and protect your information"
    >
      <section>
        <h2>1. Introduction</h2>
        <p>
          Worksafe Now Platform ("we," "our," or "us") is committed to protecting your privacy
          and maintaining the confidentiality of your personal information and Protected Health
          Information (PHI). This Privacy Policy explains how we collect, use, disclose, and
          safeguard your information when you use our healthcare screening platform.
        </p>
        <p>
          As a healthcare service provider, we comply with the Health Insurance Portability and
          Accountability Act (HIPAA) and other applicable privacy regulations.
        </p>
      </section>

      <section>
        <h2>2. Information We Collect</h2>

        <h3>2.1 Personal Information</h3>
        <ul>
          <li>Name, email address, phone number</li>
          <li>Employer information and job title</li>
          <li>Business contact details</li>
          <li>Account credentials (encrypted)</li>
        </ul>

        <h3>2.2 Protected Health Information (PHI)</h3>
        <ul>
          <li>Screening test orders and results</li>
          <li>Medical examination records</li>
          <li>Drug test results</li>
          <li>Physical examination findings</li>
          <li>Appointment scheduling information</li>
        </ul>

        <h3>2.3 Technical Information</h3>
        <ul>
          <li>IP address and device information</li>
          <li>Browser type and version</li>
          <li>Usage data and analytics</li>
          <li>Cookies and similar tracking technologies</li>
        </ul>
      </section>

      <section>
        <h2>3. How We Use Your Information</h2>

        <h3>3.1 Primary Uses</h3>
        <ul>
          <li>Process and manage screening orders</li>
          <li>Coordinate appointments with testing facilities</li>
          <li>Deliver test results to authorized parties</li>
          <li>Communicate about your orders and services</li>
          <li>Provide customer support</li>
        </ul>

        <h3>3.2 HIPAA-Permitted Uses</h3>
        <ul>
          <li><strong>Treatment:</strong> Coordinating healthcare services</li>
          <li><strong>Payment:</strong> Processing billing and payments</li>
          <li><strong>Operations:</strong> Quality assurance and business analytics</li>
        </ul>

        <h3>3.3 Legal Compliance</h3>
        <ul>
          <li>Comply with legal obligations and court orders</li>
          <li>Prevent fraud and ensure platform security</li>
          <li>Protect the rights and safety of our users</li>
        </ul>
      </section>

      <section>
        <h2>4. Information Sharing and Disclosure</h2>

        <p>We do not sell your personal information or PHI. We share information only:</p>

        <h3>4.1 With Your Consent</h3>
        <ul>
          <li>Employers who ordered the screening (results only)</li>
          <li>Testing facilities where appointments are scheduled</li>
          <li>Healthcare providers conducting examinations</li>
        </ul>

        <h3>4.2 Service Providers</h3>
        <ul>
          <li>Cloud hosting and storage services (AWS, Vercel)</li>
          <li>Email and SMS notification services</li>
          <li>Payment processors</li>
          <li>Analytics providers (anonymized data only)</li>
        </ul>
        <p>
          All service providers sign Business Associate Agreements (BAAs) ensuring
          HIPAA compliance.
        </p>

        <h3>4.3 Legal Requirements</h3>
        <ul>
          <li>When required by law or court order</li>
          <li>To protect against fraud or security threats</li>
          <li>In response to valid government requests</li>
        </ul>
      </section>

      <section>
        <h2>5. Data Security</h2>

        <p>We implement industry-standard security measures:</p>
        <ul>
          <li><strong>Encryption:</strong> All data encrypted in transit (TLS 1.3) and at rest (AES-256)</li>
          <li><strong>Access Controls:</strong> Role-based permissions and multi-factor authentication</li>
          <li><strong>Audit Logs:</strong> Comprehensive logging of all PHI access</li>
          <li><strong>Regular Audits:</strong> Security assessments and penetration testing</li>
          <li><strong>Employee Training:</strong> HIPAA compliance training for all staff</li>
          <li><strong>Incident Response:</strong> Breach notification procedures per HIPAA requirements</li>
        </ul>
      </section>

      <section>
        <h2>6. Your Rights</h2>

        <p>Under HIPAA and other privacy laws, you have the right to:</p>
        <ul>
          <li><strong>Access:</strong> Request copies of your health information</li>
          <li><strong>Amendment:</strong> Request corrections to inaccurate information</li>
          <li><strong>Accounting:</strong> Receive a list of disclosures we've made</li>
          <li><strong>Restrictions:</strong> Request limits on how we use your information</li>
          <li><strong>Confidential Communications:</strong> Request we contact you via specific methods</li>
          <li><strong>Revocation:</strong> Withdraw consent for certain uses (where applicable)</li>
        </ul>

        <p>
          To exercise these rights, contact us at <a href="mailto:privacy@rapidscreen.com">privacy@rapidscreen.com</a>
        </p>
      </section>

      <section>
        <h2>7. Data Retention</h2>

        <ul>
          <li><strong>PHI:</strong> Retained for 7 years as required by law</li>
          <li><strong>Account Data:</strong> Retained while your account is active</li>
          <li><strong>Audit Logs:</strong> Retained for 6 years per HIPAA requirements</li>
          <li><strong>Deleted Data:</strong> Securely destroyed using certified methods</li>
        </ul>
      </section>

      <section>
        <h2>8. Cookies and Tracking</h2>

        <p>We use cookies for:</p>
        <ul>
          <li>Authentication and session management</li>
          <li>Security and fraud prevention</li>
          <li>Analytics (anonymized data only)</li>
          <li>User preferences and settings</li>
        </ul>
        <p>
          You can control cookies through your browser settings. Note that disabling
          cookies may affect platform functionality.
        </p>
      </section>

      <section>
        <h2>9. Children's Privacy</h2>

        <p>
          Our platform is not intended for individuals under 18 years of age. We do not
          knowingly collect information from minors. If you believe we have collected
          information from a minor, please contact us immediately.
        </p>
      </section>

      <section>
        <h2>10. Changes to This Policy</h2>

        <p>
          We may update this Privacy Policy periodically. Material changes will be
          communicated via email or prominent notice on our platform. Continued use
          after changes constitutes acceptance of the updated policy.
        </p>
      </section>

      <section>
        <h2>11. Contact Information</h2>

        <p>For privacy-related questions or concerns:</p>
        <ul>
          <li><strong>Email:</strong> <a href="mailto:privacy@rapidscreen.com">privacy@rapidscreen.com</a></li>
          <li><strong>Phone:</strong> (888) 555-0100</li>
          <li><strong>Mail:</strong> Worksafe Now Platform, Privacy Officer, [Address]</li>
        </ul>

        <p>
          To report a HIPAA violation or file a complaint:
        </p>
        <ul>
          <li>U.S. Department of Health and Human Services</li>
          <li>Office for Civil Rights</li>
          <li>Website: <a href="https://www.hhs.gov/ocr/privacy" target="_blank" rel="noopener noreferrer">www.hhs.gov/ocr/privacy</a></li>
        </ul>
      </section>
    </ComplianceLayout>
  );
}
