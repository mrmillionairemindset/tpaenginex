import { ComplianceLayout } from '@/components/compliance/compliance-layout';

export const metadata = {
  title: 'Business Associate Agreement | TPAEngineX',
  description: 'HIPAA Business Associate Agreement for TPAEngineX healthcare screening platform',
};

export default function BAAPage() {
  return (
    <ComplianceLayout
      title="Business Associate Agreement"
      lastUpdated="January 2025"
      description="HIPAA-compliant Business Associate Agreement template"
    >
      <section>
        <p className="text-sm italic text-muted-foreground mb-6">
          This is a template Business Associate Agreement. To execute a formal BAA for your
          organization, please contact us at{' '}
          <a href="mailto:compliance@rapidscreen.com">compliance@rapidscreen.com</a>.
        </p>
      </section>

      <section>
        <h2>Business Associate Agreement</h2>
        <p>
          This Business Associate Agreement ("Agreement") is entered into between:
        </p>
        <ul>
          <li><strong>Covered Entity</strong> ("CE"): [Organization Name]</li>
          <li><strong>Business Associate</strong> ("BA"): TPAEngineX, Inc.</li>
        </ul>
        <p>
          Effective Date: [Date]
        </p>
      </section>

      <section>
        <h2>1. Definitions</h2>

        <h3>1.1 General</h3>
        <p>
          Terms used but not otherwise defined in this Agreement shall have the meanings
          ascribed to them in the Health Insurance Portability and Accountability Act of
          1996 ("HIPAA"), the Health Information Technology for Economic and Clinical
          Health Act ("HITECH"), and their implementing regulations (collectively, "HIPAA Rules").
        </p>

        <h3>1.2 Key Terms</h3>
        <ul>
          <li>
            <strong>Protected Health Information (PHI):</strong> Information about health
            status, provision of healthcare, or payment for healthcare that can be linked
            to a specific individual, as defined in 45 CFR § 160.103.
          </li>
          <li>
            <strong>Electronic PHI (ePHI):</strong> PHI that is transmitted or maintained
            in electronic media.
          </li>
          <li>
            <strong>Breach:</strong> Unauthorized acquisition, access, use, or disclosure
            of PHI that compromises the security or privacy of the information.
          </li>
          <li>
            <strong>Security Incident:</strong> Attempted or successful unauthorized access,
            use, disclosure, modification, or destruction of information or interference
            with system operations.
          </li>
        </ul>
      </section>

      <section>
        <h2>2. Permitted Uses and Disclosures</h2>

        <h3>2.1 Services</h3>
        <p>
          BA may use and disclose PHI only to perform the following services on behalf of CE:
        </p>
        <ul>
          <li>Process and manage pre-employment and employee screening orders</li>
          <li>Coordinate appointment scheduling with third-party testing facilities</li>
          <li>Transmit screening results to CE and authorized recipients</li>
          <li>Provide technical support and customer service</li>
          <li>Perform business analytics and quality improvement activities</li>
        </ul>

        <h3>2.2 Minimum Necessary</h3>
        <p>
          BA shall limit its use and disclosure of PHI to the minimum necessary to
          accomplish the intended purpose, except where the HIPAA Rules permit
          unrestricted use or disclosure.
        </p>

        <h3>2.3 Specific Uses</h3>
        <ul>
          <li>
            <strong>Management and Administration:</strong> BA may use PHI for its proper
            management and administration or to carry out its legal responsibilities.
          </li>
          <li>
            <strong>Data Aggregation:</strong> BA may use PHI to provide data aggregation
            services for CE's healthcare operations.
          </li>
          <li>
            <strong>De-Identification:</strong> BA may de-identify PHI in accordance with
            45 CFR § 164.514(a)-(c) and use de-identified data without restriction.
          </li>
        </ul>

        <h3>2.4 Prohibited Uses</h3>
        <p>
          BA shall not:
        </p>
        <ul>
          <li>Use or disclose PHI for marketing purposes without authorization</li>
          <li>Sell PHI without authorization</li>
          <li>Use or disclose PHI in a manner that would violate the HIPAA Rules if done by CE</li>
        </ul>
      </section>

      <section>
        <h2>3. Obligations of Business Associate</h2>

        <h3>3.1 Privacy Safeguards</h3>
        <p>
          BA shall implement administrative, physical, and technical safeguards that
          reasonably and appropriately protect the confidentiality, integrity, and
          availability of PHI it creates, receives, maintains, or transmits on behalf of CE.
        </p>

        <h3>3.2 Reporting</h3>
        <ul>
          <li>
            <strong>Breaches:</strong> BA shall report any Breach of Unsecured PHI to CE
            without unreasonable delay and in no case later than 10 business days after
            discovery of the Breach.
          </li>
          <li>
            <strong>Security Incidents:</strong> BA shall report Security Incidents to CE
            within 48 hours of discovery.
          </li>
          <li>
            <strong>Unauthorized Uses:</strong> BA shall report any use or disclosure of
            PHI not permitted by this Agreement within 5 business days of discovery.
          </li>
        </ul>

        <h3>3.3 Subcontractors</h3>
        <p>
          BA shall ensure that any subcontractors or agents to whom it provides PHI agree
          to the same restrictions and conditions that apply to BA with respect to such
          information, including execution of a compliant business associate agreement.
        </p>

        <h3>3.4 Individual Rights</h3>
        <ul>
          <li>
            <strong>Access:</strong> BA shall provide access to PHI in a Designated Record
            Set to CE or, as directed by CE, to an Individual within 10 business days of
            CE's request.
          </li>
          <li>
            <strong>Amendment:</strong> BA shall make amendments to PHI in a Designated
            Record Set as directed by CE within 10 business days.
          </li>
          <li>
            <strong>Accounting:</strong> BA shall document and make available to CE
            information required to provide an accounting of disclosures within 10 business
            days of CE's request.
          </li>
          <li>
            <strong>Restrictions:</strong> BA shall comply with any restrictions on uses
            or disclosures requested by an Individual and agreed to by CE.
          </li>
        </ul>

        <h3>3.5 Availability of Records</h3>
        <p>
          BA shall make its internal practices, books, and records relating to the use and
          disclosure of PHI available to the Secretary of Health and Human Services for
          purposes of determining CE's compliance with the HIPAA Rules.
        </p>

        <h3>3.6 Return or Destruction of PHI</h3>
        <p>
          Upon termination or expiration of this Agreement:
        </p>
        <ul>
          <li>
            BA shall return or destroy all PHI received from, or created or received by BA
            on behalf of, CE that BA still maintains in any form.
          </li>
          <li>
            BA shall retain no copies of the PHI, except as required by law or as necessary
            for proper management and administration of BA.
          </li>
          <li>
            If return or destruction is infeasible, BA shall extend the protections of this
            Agreement to such PHI and limit further uses and disclosures to those purposes
            that make the return or destruction infeasible.
          </li>
        </ul>
      </section>

      <section>
        <h2>4. Obligations of Covered Entity</h2>

        <h3>4.1 Notice of Privacy Practices</h3>
        <p>
          CE shall provide BA with a copy of its Notice of Privacy Practices and any
          changes thereto.
        </p>

        <h3>4.2 Authorizations and Restrictions</h3>
        <p>
          CE shall notify BA of:
        </p>
        <ul>
          <li>Any restrictions on the use or disclosure of PHI that CE has agreed to</li>
          <li>Any changes in, or revocation of, permission by an Individual to use or disclose PHI</li>
        </ul>

        <h3>4.3 Permissible Requests</h3>
        <p>
          CE shall not request BA to use or disclose PHI in any manner that would not be
          permissible under the HIPAA Rules if done by CE.
        </p>
      </section>

      <section>
        <h2>5. Term and Termination</h2>

        <h3>5.1 Term</h3>
        <p>
          This Agreement shall be effective as of the Effective Date and shall terminate
          upon the earlier of:
        </p>
        <ul>
          <li>Termination of the underlying service agreement between the parties</li>
          <li>Termination by either party as provided in Section 5.2</li>
        </ul>

        <h3>5.2 Termination for Cause</h3>
        <p>
          Upon either party's knowledge of a material breach by the other party:
        </p>
        <ul>
          <li>
            The non-breaching party shall provide written notice to the breaching party
            describing the breach.
          </li>
          <li>
            The breaching party shall have 30 days to cure the breach or end the violation.
          </li>
          <li>
            If the breach is not cured within 30 days, the non-breaching party may
            immediately terminate this Agreement and the underlying service agreement.
          </li>
          <li>
            If termination is not feasible, CE shall report the breach to the Secretary of
            Health and Human Services.
          </li>
        </ul>

        <h3>5.3 Effect of Termination</h3>
        <p>
          Upon termination, BA shall return or destroy all PHI as described in Section 3.6.
        </p>
      </section>

      <section>
        <h2>6. Miscellaneous</h2>

        <h3>6.1 Regulatory References</h3>
        <p>
          References to regulatory provisions shall be to such provisions as in effect or
          as amended, and references to HIPAA Rules include any future guidance,
          compliance directives, or regulations issued by HHS.
        </p>

        <h3>6.2 Amendment</h3>
        <p>
          The parties agree to amend this Agreement as necessary to comply with changes
          in the HIPAA Rules or other applicable law.
        </p>

        <h3>6.3 Survival</h3>
        <p>
          The obligations of BA under Section 3.6 (Return or Destruction of PHI) shall
          survive termination of this Agreement.
        </p>

        <h3>6.4 Interpretation</h3>
        <p>
          Any ambiguity in this Agreement shall be resolved in favor of a meaning that
          permits CE to comply with the HIPAA Rules.
        </p>

        <h3>6.5 Relationship to Service Agreement</h3>
        <p>
          This Agreement supplements and is incorporated into the underlying service
          agreement between the parties. In the event of a conflict between this Agreement
          and the service agreement, this Agreement shall control with respect to the use
          and disclosure of PHI.
        </p>

        <h3>6.6 No Third-Party Beneficiaries</h3>
        <p>
          Nothing in this Agreement shall confer upon any person other than the parties
          and their respective successors or assigns, any rights, remedies, obligations,
          or liabilities whatsoever.
        </p>

        <h3>6.7 Indemnification</h3>
        <p>
          BA shall indemnify and hold harmless CE from any claims, damages, costs, or
          penalties arising from BA's breach of this Agreement or violation of the HIPAA
          Rules.
        </p>

        <h3>6.8 Governing Law</h3>
        <p>
          This Agreement shall be governed by the laws of [State], without regard to
          conflict of law principles, and by applicable federal law.
        </p>
      </section>

      <section>
        <h2>7. Signatures</h2>

        <p>
          To execute this Business Associate Agreement, please contact:
        </p>

        <div className="mt-6 rounded-lg border bg-muted p-6">
          <p className="font-semibold mb-4">TPAEngineX, Inc.</p>
          <ul className="space-y-2 text-sm">
            <li><strong>Email:</strong> <a href="mailto:compliance@rapidscreen.com">compliance@rapidscreen.com</a></li>
            <li><strong>Phone:</strong> (888) 555-0100</li>
            <li><strong>Attn:</strong> Compliance Officer</li>
          </ul>
        </div>

        <p className="mt-6 text-sm text-muted-foreground">
          We will provide a customized BAA with your organization details, signature blocks,
          and any addenda required for your specific use case.
        </p>
      </section>

      <section>
        <h2>8. Exhibits (Available Upon Request)</h2>

        <ul>
          <li><strong>Exhibit A:</strong> Description of Services</li>
          <li><strong>Exhibit B:</strong> List of Subcontractors</li>
          <li><strong>Exhibit C:</strong> Security Safeguards Documentation</li>
          <li><strong>Exhibit D:</strong> Incident Response Procedures</li>
          <li><strong>Exhibit E:</strong> Data Retention and Destruction Procedures</li>
        </ul>
      </section>

      <section className="mt-8 rounded-lg border border-primary/20 bg-primary/5 p-6">
        <h3 className="text-primary font-semibold mb-2">Need a Signed BAA?</h3>
        <p className="text-primary mb-4">
          If you are a covered entity or business associate requiring a formal Business
          Associate Agreement, please contact our compliance team:
        </p>
        <ul className="text-primary space-y-1">
          <li>Email: <a href="mailto:compliance@rapidscreen.com" className="underline">compliance@rapidscreen.com</a></li>
          <li>Phone: (888) 555-0100</li>
        </ul>
        <p className="text-sm text-primary mt-4">
          We typically execute BAAs within 3-5 business days of receiving your request.
        </p>
      </section>
    </ComplianceLayout>
  );
}
