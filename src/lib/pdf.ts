import PDFDocument from 'pdfkit';

export interface ConcentraAuthData {
  orderNumber: string;
  companyName: string;
  companyLocation: string; // Step 3: Company location the employee is associated with
  concentraCenter?: string; // Step 2: Designated Concentra medical center (optional - can be "Any center in geographic area")
  concentraAddress?: string; // Step 2: Center address
  concentraPhone?: string; // Step 2: Center phone number
  geographicArea?: string; // Step 2b: If no specific center, geographic area
  candidateFirstName: string; // Step 6: Employee first name
  candidateLastName: string; // Step 6: Employee last name
  candidateDOB?: string; // Step 6: Date of birth (optional but recommended)
  candidatePhone?: string; // Step 7: Mobile number for online check-in (optional)
  candidateEmail?: string; // Step 7: Email for online check-in (optional)
  servicePackage: string; // Step 4: Service package name
  serviceComponents: string[]; // Step 4a: Service components to be performed
  validityDays: number; // Step 5: Number of days authorization is valid from creation date
  specialInstructions?: string; // Step 9: Special instructions for all employees
}

export async function generateConcentraAuthPDF(data: ConcentraAuthData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margin: 50,
      autoFirstPage: true
    });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fontSize(18).fillColor('#000').text('CONCENTRA AUTHORIZATION FOR SERVICE', { align: 'center', underline: true });
    doc.moveDown();
    doc.fontSize(10).text(`Authorization Number: ${data.orderNumber}`, { align: 'right' });
    doc.text(`Generated: ${new Date().toLocaleString()}`, { align: 'right' });
    doc.moveDown(1.5);

    // Step 2: Concentra Medical Center
    doc.fontSize(13).fillColor('#000').text('CONCENTRA MEDICAL CENTER', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10);
    if (data.concentraCenter) {
      doc.text(`Center: ${data.concentraCenter}`);
      if (data.concentraAddress) {
        doc.text(`Address: ${data.concentraAddress}`);
      }
      if (data.concentraPhone) {
        doc.text(`Phone: ${data.concentraPhone}`);
      }
    } else if (data.geographicArea) {
      doc.text(`Service Area: ${data.geographicArea}`);
      doc.fontSize(9).fillColor('#666').text('(Employee may visit any Concentra center in this area)', { indent: 20 });
      doc.fillColor('#000');
    } else {
      doc.text('Any Concentra center nationwide');
    }
    doc.moveDown(1.5);

    // Step 3: Company Location
    doc.fontSize(13).text('COMPANY LOCATION', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10);
    doc.text(`Company: ${data.companyName}`);
    doc.text(`Location: ${data.companyLocation}`);
    doc.moveDown(1.5);

    // Step 6 & 7: Employee Information
    doc.fontSize(13).text('EMPLOYEE INFORMATION', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10);
    doc.text(`Name: ${data.candidateFirstName} ${data.candidateLastName}`);
    if (data.candidateDOB) {
      doc.text(`Date of Birth: ${data.candidateDOB}`);
    }
    if (data.candidatePhone) {
      doc.text(`Mobile Phone: ${data.candidatePhone}`);
      doc.fontSize(9).fillColor('#666').text('(For online check-in)', { indent: 20 });
      doc.fillColor('#000').fontSize(10);
    }
    if (data.candidateEmail) {
      doc.text(`Email: ${data.candidateEmail}`);
      if (!data.candidatePhone) {
        doc.fontSize(9).fillColor('#666').text('(For online check-in)', { indent: 20 });
        doc.fillColor('#000').fontSize(10);
      }
    }
    doc.moveDown(1.5);

    // Step 4: Service Package & Components
    doc.fontSize(13).text('SERVICE PACKAGE', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10);
    doc.text(`Package: ${data.servicePackage}`);
    doc.moveDown(0.5);
    doc.text('Service Components to be Performed:');
    doc.moveDown(0.3);
    data.serviceComponents.forEach((comp) => {
      doc.text(`  ☑ ${comp}`);
    });
    doc.moveDown(1.5);

    // Step 5: Validity Period
    doc.fontSize(13).text('AUTHORIZATION VALIDITY', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10);
    doc.text(`Valid for: ${data.validityDays} ${data.validityDays === 1 ? 'day' : 'days'} from authorization date`);
    doc.moveDown(0.3);
    doc.fontSize(9).fillColor('#666');
    doc.text('Note: Expiration countdown begins when authorization is created in Concentra HUB', { width: 500 });
    doc.fillColor('#000').fontSize(10);
    doc.moveDown(1.5);

    // Step 9: Special Instructions
    if (data.specialInstructions) {
      doc.fontSize(13).text('SPECIAL INSTRUCTIONS', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10);
      doc.text(data.specialInstructions, { width: 500 });
      doc.moveDown(1.5);
    }

    // Footer
    doc.moveDown(1);
    doc.fontSize(9).fillColor('#666');
    doc.text(
      'INSTRUCTIONS FOR PROVIDER: Copy the above information into Concentra HUB when creating the authorization. Review all details before submitting. The employee selection does not limit where the employee can receive service.',
      { align: 'center', width: 500 }
    );
    doc.moveDown(0.5);
    doc.fontSize(8).fillColor('#999');
    doc.text('Generated by WorkSafe Now Portal', { align: 'center' });

    doc.end();
  });
}
