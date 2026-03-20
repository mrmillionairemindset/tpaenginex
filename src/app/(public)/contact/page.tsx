import { ComplianceLayout } from '@/components/compliance/compliance-layout';
import { Mail, Phone, MapPin } from 'lucide-react';

export const metadata = {
  title: 'Contact Us | TPAEngineX',
  description: 'Get in touch with TPAEngineX support team',
};

export default function ContactPage() {
  return (
    <ComplianceLayout
      title="Contact Us"
      lastUpdated="January 2025"
      description="We're here to help"
    >
      <section>
        <h2>Get in Touch</h2>
        <p>
          Have questions about TPAEngineX? Need support? Want to learn more about our
          platform? We're here to help.
        </p>
      </section>

      <section>
        <h2>Contact Information</h2>

        <div className="not-prose space-y-6">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-primary/10 p-3">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Email</h3>
              <p className="text-muted-foreground mt-1">
                <a href="mailto:support@tpaenginex.com" className="text-primary hover:underline">
                  support@tpaenginex.com
                </a>
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                We typically respond within 24 hours
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-primary/10 p-3">
              <Phone className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Phone</h3>
              <p className="text-muted-foreground mt-1">
                <a href="tel:+18885550100" className="text-primary hover:underline">
                  (888) 555-0100
                </a>
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Monday - Friday, 8:00 AM - 6:00 PM EST
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-primary/10 p-3">
              <MapPin className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Address</h3>
              <p className="text-muted-foreground mt-1">
                TPAEngineX, Inc.<br />
                [Address Line 1]<br />
                [City, State ZIP]
              </p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2>Department-Specific Contacts</h2>

        <h3>Sales & New Accounts</h3>
        <p>
          Email: <a href="mailto:sales@tpaenginex.com">sales@tpaenginex.com</a>
        </p>

        <h3>Technical Support</h3>
        <p>
          Email: <a href="mailto:support@tpaenginex.com">support@tpaenginex.com</a>
        </p>

        <h3>Privacy & Compliance</h3>
        <p>
          Email: <a href="mailto:privacy@tpaenginex.com">privacy@tpaenginex.com</a>
        </p>

        <h3>Security Incidents</h3>
        <p>
          Email: <a href="mailto:security@tpaenginex.com">security@tpaenginex.com</a><br />
          Hotline: (888) 555-0199 (24/7)
        </p>

        <h3>Billing & Accounts</h3>
        <p>
          Email: <a href="mailto:billing@tpaenginex.com">billing@tpaenginex.com</a>
        </p>
      </section>

      <section>
        <h2>Emergency Support</h2>
        <p>
          For urgent technical issues affecting active screenings:
        </p>
        <ul>
          <li>Call: (888) 555-0199</li>
          <li>Available 24/7 for critical incidents</li>
        </ul>
      </section>

      <section>
        <h2>Business Associate Agreements</h2>
        <p>
          To execute a Business Associate Agreement (BAA) for HIPAA compliance:
        </p>
        <ul>
          <li>Email: <a href="mailto:compliance@tpaenginex.com">compliance@tpaenginex.com</a></li>
          <li>Template: <a href="/baa">View BAA Template</a></li>
        </ul>
      </section>
    </ComplianceLayout>
  );
}
