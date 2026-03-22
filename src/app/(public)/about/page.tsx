import { ComplianceLayout } from '@/components/compliance/compliance-layout';

export const metadata = {
  title: 'About Us | TPAEngineX',
  description: 'Learn about TPAEngineX healthcare screening platform',
};

export default function AboutPage() {
  return (
    <ComplianceLayout
      title="About TPAEngineX"
      lastUpdated="March 2026"
      description="Streamlining healthcare screening for TPAs and their clients"
    >
      <section>
        <h2>Our Mission</h2>
        <p>
          TPAEngineX was founded to modernize and streamline the drug testing and
          occupational health screening process. We connect Third Party Administrators (TPAs),
          their client companies, and collectors through a secure, HIPAA-compliant platform
          that makes coordination simple and efficient.
        </p>
      </section>

      <section>
        <h2>What We Do</h2>
        <p>
          TPAEngineX provides a comprehensive platform for managing healthcare screenings:
        </p>
        <ul>
          <li>Pre-employment drug testing and physical examinations</li>
          <li>DOT and non-DOT drug and alcohol testing</li>
          <li>Collector assignment and scheduling coordination</li>
          <li>Secure result delivery and record management</li>
          <li>Multi-tenant workflows for TPAs and their client companies</li>
        </ul>
      </section>

      <section>
        <h2>Our Values</h2>

        <h3>Security First</h3>
        <p>
          We treat Protected Health Information (PHI) with the utmost care, implementing
          comprehensive safeguards that exceed HIPAA requirements.
        </p>

        <h3>Transparency</h3>
        <p>
          Our platform provides clear visibility into screening status, timelines, and
          results for all parties involved.
        </p>

        <h3>Efficiency</h3>
        <p>
          We eliminate manual coordination, phone calls, and paperwork through automated
          workflows and integrations.
        </p>

        <h3>Compliance</h3>
        <p>
          HIPAA compliance, data security, and regulatory adherence are built into every
          aspect of our platform.
        </p>
      </section>

      <section>
        <h2>How It Works</h2>

        <h3>For TPAs</h3>
        <ol>
          <li>Manage screening orders across all your client companies</li>
          <li>Assign and coordinate collectors for on-site and mobile collections</li>
          <li>Upload results with built-in quality checks</li>
          <li>Track performance metrics and operational efficiency</li>
        </ol>

        <h3>For Client Companies</h3>
        <ol>
          <li>Submit screening orders with candidate information</li>
          <li>Receive automated status updates throughout the process</li>
          <li>Access results securely through the client portal</li>
          <li>Maintain centralized records for compliance</li>
        </ol>

        <h3>For Candidates</h3>
        <ol>
          <li>Receive clear appointment information via email/SMS</li>
          <li>Complete screenings at convenient locations</li>
          <li>Know that your health information is protected</li>
        </ol>
      </section>

      <section>
        <h2>Technology</h2>
        <p>
          Built with modern, secure technologies:
        </p>
        <ul>
          <li>Next.js 14 for performance and scalability</li>
          <li>PostgreSQL database with row-level security</li>
          <li>End-to-end encryption (TLS 1.3, AES-256)</li>
          <li>Role-based access control (RBAC)</li>
          <li>Comprehensive audit logging</li>
          <li>SOC 2 Type II certified infrastructure</li>
        </ul>
      </section>

      <section>
        <h2>Contact Us</h2>
        <p>
          We'd love to hear from you:
        </p>
        <ul>
          <li><strong>Sales:</strong> <a href="mailto:sales@tpaenginex.com">sales@tpaenginex.com</a></li>
          <li><strong>Support:</strong> <a href="mailto:support@tpaenginex.com">support@tpaenginex.com</a></li>
          <li><strong>Phone:</strong> (888) 555-0100</li>
        </ul>
      </section>
    </ComplianceLayout>
  );
}
