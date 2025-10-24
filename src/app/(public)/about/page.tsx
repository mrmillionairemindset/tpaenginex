import { ComplianceLayout } from '@/components/compliance/compliance-layout';

export const metadata = {
  title: 'About Us | Worksafe Now Platform',
  description: 'Learn about Worksafe Now healthcare screening platform',
};

export default function AboutPage() {
  return (
    <ComplianceLayout
      title="About Worksafe Now"
      lastUpdated="January 2025"
      description="Streamlining healthcare screening for employers and providers"
    >
      <section>
        <h2>Our Mission</h2>
        <p>
          Worksafe Now Platform was founded to modernize and streamline the pre-employment
          and employee health screening process. We connect employers, screening providers,
          and testing facilities through a secure, HIPAA-compliant platform that makes
          coordination simple and efficient.
        </p>
      </section>

      <section>
        <h2>What We Do</h2>
        <p>
          Worksafe Now provides a comprehensive platform for managing healthcare screenings:
        </p>
        <ul>
          <li>Pre-employment drug testing and physical examinations</li>
          <li>Employee health monitoring and compliance screenings</li>
          <li>Appointment coordination with nationwide testing facilities</li>
          <li>Secure result delivery and record management</li>
          <li>Multi-tenant workflows for employers and providers</li>
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

        <h3>For Employers</h3>
        <ol>
          <li>Create screening orders with candidate information</li>
          <li>Receive automated status updates throughout the process</li>
          <li>Access results securely through the platform</li>
          <li>Maintain centralized records for compliance</li>
        </ol>

        <h3>For Providers</h3>
        <ol>
          <li>Receive new screening orders automatically</li>
          <li>Coordinate appointments at your network of testing sites</li>
          <li>Upload results with built-in quality checks</li>
          <li>Track performance metrics and operational efficiency</li>
        </ol>

        <h3>For Candidates</h3>
        <ol>
          <li>Receive clear appointment information via email/SMS</li>
          <li>Visit convenient testing locations nationwide</li>
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
          <li><strong>Sales:</strong> <a href="mailto:sales@rapidscreen.com">sales@rapidscreen.com</a></li>
          <li><strong>Support:</strong> <a href="mailto:support@rapidscreen.com">support@rapidscreen.com</a></li>
          <li><strong>Phone:</strong> (888) 555-0100</li>
        </ul>
      </section>
    </ComplianceLayout>
  );
}
