import { ComplianceLayout } from '@/components/compliance/compliance-layout';

export const metadata = {
  title: 'HIPAA Compliance | TPAEngineX',
  description: 'HIPAA compliance information for TPAEngineX healthcare screening platform',
};

export default function HIPAACompliancePage() {
  return (
    <ComplianceLayout
      title="HIPAA Compliance"
      lastUpdated="January 2025"
      description="Our commitment to protecting your health information"
    >
      <section>
        <h2>1. Overview</h2>
        <p>
          TPAEngineX is committed to full compliance with the Health Insurance
          Portability and Accountability Act (HIPAA) of 1996 and its implementing regulations,
          including the Privacy Rule, Security Rule, and Breach Notification Rule.
        </p>
        <p>
          As a Business Associate to healthcare providers and covered entities, we implement
          comprehensive safeguards to protect Protected Health Information (PHI) and ensure
          the confidentiality, integrity, and availability of electronic PHI (ePHI).
        </p>
      </section>

      <section>
        <h2>2. HIPAA Roles and Responsibilities</h2>

        <h3>2.1 Business Associate Status</h3>
        <p>
          TPAEngineX operates as a Business Associate when:
        </p>
        <ul>
          <li>Processing screening orders containing PHI on behalf of covered entities</li>
          <li>Coordinating appointments with healthcare providers</li>
          <li>Transmitting screening results to authorized parties</li>
          <li>Storing and managing health information in our platform</li>
        </ul>

        <h3>2.2 Business Associate Agreements (BAAs)</h3>
        <p>
          We execute compliant BAAs with all clients and subcontractors who handle PHI.
          Our standard BAA is available at <a href="/baa">Business Associate Agreement</a>.
        </p>

        <h3>2.3 Covered Entity Obligations</h3>
        <p>
          When using our platform, covered entities (employers, providers) remain responsible for:
        </p>
        <ul>
          <li>Obtaining patient authorizations for disclosures</li>
          <li>Ensuring minimum necessary use of PHI</li>
          <li>Complying with their own HIPAA obligations</li>
          <li>Training their workforce on HIPAA requirements</li>
        </ul>
      </section>

      <section>
        <h2>3. Administrative Safeguards</h2>

        <h3>3.1 Security Management Process</h3>
        <ul>
          <li><strong>Risk Analysis:</strong> Annual comprehensive risk assessments</li>
          <li><strong>Risk Management:</strong> Implementation of security measures to reduce risks</li>
          <li><strong>Sanctions Policy:</strong> Disciplinary actions for policy violations</li>
          <li><strong>Information System Activity Review:</strong> Regular audit log reviews</li>
        </ul>

        <h3>3.2 Workforce Security</h3>
        <ul>
          <li><strong>Authorization:</strong> Role-based access controls (employer, provider, admin, user)</li>
          <li><strong>Supervision:</strong> Management oversight of PHI access</li>
          <li><strong>Termination:</strong> Immediate access revocation upon separation</li>
          <li><strong>Training:</strong> Annual HIPAA training for all employees and contractors</li>
        </ul>

        <h3>3.3 Access Management</h3>
        <ul>
          <li><strong>Unique User IDs:</strong> Individual authentication for all users</li>
          <li><strong>Emergency Access:</strong> Break-glass procedures for urgent situations</li>
          <li><strong>Automatic Logoff:</strong> Session timeouts after inactivity</li>
          <li><strong>Encryption:</strong> PHI encrypted both in transit and at rest</li>
        </ul>

        <h3>3.4 Security Awareness and Training</h3>
        <ul>
          <li>Password management and multi-factor authentication</li>
          <li>Malware and phishing prevention</li>
          <li>Incident reporting procedures</li>
          <li>Log-in monitoring and alerts</li>
        </ul>

        <h3>3.5 Contingency Planning</h3>
        <ul>
          <li><strong>Data Backup:</strong> Daily automated backups with encryption</li>
          <li><strong>Disaster Recovery:</strong> 99.9% uptime SLA with redundant infrastructure</li>
          <li><strong>Emergency Mode:</strong> Procedures for operating during system failures</li>
          <li><strong>Testing:</strong> Quarterly disaster recovery drills</li>
        </ul>
      </section>

      <section>
        <h2>4. Physical Safeguards</h2>

        <h3>4.1 Facility Access Controls</h3>
        <ul>
          <li>Cloud infrastructure hosted in SOC 2 Type II certified data centers</li>
          <li>24/7 physical security and monitoring</li>
          <li>Biometric access controls and visitor logs</li>
          <li>Redundant power and climate control systems</li>
        </ul>

        <h3>4.2 Workstation Security</h3>
        <ul>
          <li>Encrypted hard drives on all employee devices</li>
          <li>Screen privacy filters in public spaces</li>
          <li>Automatic screen locking when unattended</li>
          <li>Clean desk policy for physical documents</li>
        </ul>

        <h3>4.3 Device and Media Controls</h3>
        <ul>
          <li><strong>Disposal:</strong> Secure deletion using DOD 5220.22-M standards</li>
          <li><strong>Media Reuse:</strong> Sanitization before repurposing</li>
          <li><strong>Accountability:</strong> Tracking of all hardware containing ePHI</li>
          <li><strong>Data Backup:</strong> Encrypted backups stored in geographically dispersed locations</li>
        </ul>
      </section>

      <section>
        <h2>5. Technical Safeguards</h2>

        <h3>5.1 Access Controls</h3>
        <ul>
          <li><strong>Unique User Identification:</strong> Email-based authentication with JWT tokens</li>
          <li><strong>Emergency Access:</strong> Admin override with full audit logging</li>
          <li><strong>Auto Logoff:</strong> 30-minute inactivity timeout</li>
          <li><strong>Encryption:</strong> TLS 1.3 for transmission, AES-256 for data at rest</li>
        </ul>

        <h3>5.2 Audit Controls</h3>
        <ul>
          <li>Comprehensive logging of all PHI access and modifications</li>
          <li>Logs include: user ID, timestamp, action, IP address, affected records</li>
          <li>Tamper-proof log storage with 6-year retention</li>
          <li>Regular log review and anomaly detection</li>
        </ul>

        <h3>5.3 Integrity Controls</h3>
        <ul>
          <li>Checksums and digital signatures for data validation</li>
          <li>Version control for all PHI modifications</li>
          <li>Automated integrity verification during backups</li>
          <li>Immutable audit trails</li>
        </ul>

        <h3>5.4 Transmission Security</h3>
        <ul>
          <li><strong>Encryption:</strong> TLS 1.3 with perfect forward secrecy</li>
          <li><strong>Integrity Controls:</strong> HMAC verification for all transmissions</li>
          <li><strong>VPN:</strong> Secure remote access for administrative functions</li>
          <li><strong>Email Security:</strong> PHI never sent via unencrypted email</li>
        </ul>
      </section>

      <section>
        <h2>6. Privacy Rule Compliance</h2>

        <h3>6.1 Minimum Necessary Standard</h3>
        <p>
          We implement role-based access controls to ensure users can only access PHI
          necessary for their job functions:
        </p>
        <ul>
          <li><strong>Employer Users:</strong> View only their organization's orders and results</li>
          <li><strong>Provider Agents:</strong> Access assigned orders and upload results</li>
          <li><strong>Provider Admins:</strong> Full access to manage orders and sites</li>
        </ul>

        <h3>6.2 Individual Rights</h3>
        <p>We support the following HIPAA individual rights:</p>
        <ul>
          <li><strong>Access:</strong> Request copies of their PHI within 30 days</li>
          <li><strong>Amendment:</strong> Request corrections to inaccurate information</li>
          <li><strong>Accounting of Disclosures:</strong> List of PHI disclosures for 6 years</li>
          <li><strong>Restrictions:</strong> Request limits on uses and disclosures</li>
          <li><strong>Confidential Communications:</strong> Specify preferred contact methods</li>
        </ul>

        <h3>6.3 Uses and Disclosures</h3>
        <p>We only use and disclose PHI for:</p>
        <ul>
          <li>Treatment, payment, and healthcare operations (TPO)</li>
          <li>As directed by the covered entity in our BAA</li>
          <li>As required by law (court orders, public health reporting)</li>
          <li>With individual authorization for other purposes</li>
        </ul>
      </section>

      <section>
        <h2>7. Breach Notification</h2>

        <h3>7.1 Breach Definition</h3>
        <p>
          A breach is an unauthorized acquisition, access, use, or disclosure of PHI that
          compromises the security or privacy of the information.
        </p>

        <h3>7.2 Breach Response Procedures</h3>
        <ul>
          <li><strong>Detection:</strong> Automated monitoring and user reporting</li>
          <li><strong>Investigation:</strong> Risk assessment within 24 hours</li>
          <li><strong>Containment:</strong> Immediate measures to limit exposure</li>
          <li><strong>Notification:</strong> Covered entity notified within 60 days (or less)</li>
          <li><strong>Documentation:</strong> Detailed breach log maintained for 6 years</li>
        </ul>

        <h3>7.3 Notification Timeline</h3>
        <ul>
          <li><strong>Covered Entity:</strong> Notified without unreasonable delay (typically within 48 hours)</li>
          <li><strong>Individuals:</strong> Covered entity notifies affected individuals within 60 days</li>
          <li><strong>HHS:</strong> Breaches affecting 500+ individuals reported immediately</li>
          <li><strong>Media:</strong> Covered entity notifies media for large breaches (500+ affected)</li>
        </ul>

        <h3>7.4 Mitigation</h3>
        <p>
          We implement corrective actions to prevent recurrence, which may include:
        </p>
        <ul>
          <li>Enhanced access controls and monitoring</li>
          <li>Additional workforce training</li>
          <li>System configuration changes</li>
          <li>Third-party security assessments</li>
        </ul>
      </section>

      <section>
        <h2>8. Subcontractors and Business Associates</h2>

        <p>
          We execute BAAs with all subcontractors who may access PHI, including:
        </p>
        <ul>
          <li><strong>Cloud Hosting:</strong> AWS/Vercel (HIPAA-compliant infrastructure)</li>
          <li><strong>Database:</strong> Neon/Supabase (encrypted PostgreSQL)</li>
          <li><strong>Email/SMS:</strong> Resend/Twilio (BAA in place)</li>
          <li><strong>Payment Processing:</strong> Stripe (PCI-DSS compliant, BAA signed)</li>
          <li><strong>Monitoring:</strong> Sentry (error tracking with PHI redaction)</li>
        </ul>

        <p>
          All subcontractors are required to:
        </p>
        <ul>
          <li>Implement appropriate safeguards</li>
          <li>Report breaches to us immediately</li>
          <li>Allow audits and compliance reviews</li>
          <li>Return or destroy PHI upon contract termination</li>
        </ul>
      </section>

      <section>
        <h2>9. Compliance Monitoring and Auditing</h2>

        <h3>9.1 Internal Audits</h3>
        <ul>
          <li><strong>Quarterly:</strong> Access log reviews and permission audits</li>
          <li><strong>Annually:</strong> Comprehensive risk assessments</li>
          <li><strong>Ad Hoc:</strong> Incident investigations and spot checks</li>
        </ul>

        <h3>9.2 External Assessments</h3>
        <ul>
          <li>Annual penetration testing by certified security firms</li>
          <li>SOC 2 Type II audits (in progress)</li>
          <li>HITRUST certification (roadmap)</li>
        </ul>

        <h3>9.3 Continuous Improvement</h3>
        <ul>
          <li>Regular policy and procedure reviews</li>
          <li>Security awareness campaigns</li>
          <li>Incident response drills</li>
          <li>Technology upgrades and patch management</li>
        </ul>
      </section>

      <section>
        <h2>10. User Responsibilities</h2>

        <p>
          As a TPAEngineX user, you are responsible for:
        </p>
        <ul>
          <li><strong>Password Security:</strong> Using strong, unique passwords and enabling MFA</li>
          <li><strong>Access Controls:</strong> Not sharing credentials or accessing unauthorized PHI</li>
          <li><strong>Minimum Necessary:</strong> Accessing only the PHI needed for your role</li>
          <li><strong>Incident Reporting:</strong> Reporting suspected breaches or violations immediately</li>
          <li><strong>Training:</strong> Completing required HIPAA training (if applicable)</li>
          <li><strong>Device Security:</strong> Protecting devices used to access the platform</li>
        </ul>
      </section>

      <section>
        <h2>11. Frequently Asked Questions</h2>

        <h3>Is TPAEngineX HIPAA compliant?</h3>
        <p>
          Yes. We implement all required administrative, physical, and technical safeguards
          and execute Business Associate Agreements with our clients.
        </p>

        <h3>Do I need a BAA to use TPAEngineX?</h3>
        <p>
          If you are a covered entity or business associate handling PHI through our
          platform, yes. Contact us at <a href="mailto:compliance@tpaenginex.com">compliance@tpaenginex.com</a> to
          execute a BAA.
        </p>

        <h3>How is PHI encrypted?</h3>
        <p>
          All PHI is encrypted in transit using TLS 1.3 and at rest using AES-256 encryption.
        </p>

        <h3>Can I get a copy of your latest risk assessment?</h3>
        <p>
          Clients can request compliance documentation by contacting our compliance team.
          We provide risk assessment summaries under NDA.
        </p>

        <h3>How do I report a security incident?</h3>
        <p>
          Email <a href="mailto:security@tpaenginex.com">security@tpaenginex.com</a> immediately
          or call our 24/7 incident hotline at (888) 555-0199.
        </p>
      </section>

      <section>
        <h2>12. Contact Information</h2>

        <p>For HIPAA compliance questions:</p>
        <ul>
          <li><strong>Privacy Officer:</strong> <a href="mailto:privacy@tpaenginex.com">privacy@tpaenginex.com</a></li>
          <li><strong>Security Officer:</strong> <a href="mailto:security@tpaenginex.com">security@tpaenginex.com</a></li>
          <li><strong>Compliance Team:</strong> <a href="mailto:compliance@tpaenginex.com">compliance@tpaenginex.com</a></li>
          <li><strong>General Inquiries:</strong> (888) 555-0100</li>
          <li><strong>Incident Hotline:</strong> (888) 555-0199 (24/7)</li>
        </ul>

        <p><strong>Mailing Address:</strong></p>
        <p>
          TPAEngineX<br />
          Attn: Privacy Officer<br />
          [Address Line 1]<br />
          [City, State ZIP]
        </p>
      </section>
    </ComplianceLayout>
  );
}
