import pdf from 'pdf-parse';

interface PDFValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  extractedText?: string;
}

interface ValidateConcentraAuthOptions {
  pdfBuffer: Buffer;
  candidateFirstName: string;
  candidateLastName: string;
  orderNumber?: string;
}

/**
 * Validates that a PDF is a legitimate Concentra authorization form
 * Checks for:
 * 1. Concentra branding/markers
 * 2. Candidate name match
 * 3. Key authorization fields
 */
export async function validateConcentraAuthForm(
  options: ValidateConcentraAuthOptions
): Promise<PDFValidationResult> {
  const { pdfBuffer, candidateFirstName, candidateLastName, orderNumber } = options;

  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Extract text from PDF
    const data = await pdf(pdfBuffer);
    const text = data.text.toLowerCase();
    const originalText = data.text; // Keep original case for name matching

    // Check 1: Look for Concentra branding/indicators
    const concentraMarkers = [
      'concentra',
      'employer authorization',
      'authorization form',
      'occupational health',
    ];

    const hasConcentraMarker = concentraMarkers.some(marker =>
      text.includes(marker.toLowerCase())
    );

    if (!hasConcentraMarker) {
      errors.push('PDF does not appear to be a Concentra authorization form. Missing expected Concentra branding or authorization form markers.');
    }

    // Check 2: Verify candidate name appears in the document
    const firstNameVariations = [
      candidateFirstName.toLowerCase(),
      candidateFirstName.toLowerCase().substring(0, 1), // First initial
    ];

    const lastNameVariations = [
      candidateLastName.toLowerCase(),
    ];

    // Look for full name, last name first, or first name first
    const hasFirstName = firstNameVariations.some(variation => text.includes(variation));
    const hasLastName = lastNameVariations.some(variation => text.includes(variation));

    if (!hasFirstName && !hasLastName) {
      errors.push(`Candidate name "${candidateFirstName} ${candidateLastName}" not found in the PDF. Please verify this is the correct authorization form for this candidate.`);
    } else if (!hasFirstName) {
      warnings.push(`First name "${candidateFirstName}" not found in PDF. Found last name "${candidateLastName}". Please verify the name is correct.`);
    } else if (!hasLastName) {
      warnings.push(`Last name "${candidateLastName}" not found in PDF. Found first name "${candidateFirstName}". Please verify the name is correct.`);
    }

    // Check 3: Look for key authorization fields/terms
    const authorizationTerms = [
      'authorization',
      'authorize',
      'test',
      'exam',
      'screening',
      'drug',
      'physical',
    ];

    const hasAuthTerms = authorizationTerms.some(term => text.includes(term));
    if (!hasAuthTerms) {
      warnings.push('PDF does not contain typical authorization language (authorize, test, screening, etc.). Please verify this is an authorization form.');
    }

    // Check 4: Look for date fields
    const hasDatePatterns = /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(originalText);
    if (!hasDatePatterns) {
      warnings.push('No date found in PDF. Authorization forms typically include dates.');
    }

    // Check 5: If order number provided, check if it appears
    if (orderNumber) {
      const orderNumInDoc = originalText.includes(orderNumber);
      if (orderNumInDoc) {
        // Good - order number found
      } else {
        warnings.push(`Order number ${orderNumber} not found in PDF. This may be expected if Concentra uses their own authorization numbers.`);
      }
    }

    // Check 6: Minimum content length (authorization forms should have substantial content)
    if (text.length < 100) {
      errors.push('PDF appears to have very little content. Authorization forms should contain detailed information.');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      extractedText: originalText,
    };

  } catch (error) {
    console.error('Error validating PDF:', error);
    return {
      isValid: false,
      errors: ['Failed to read PDF content. The file may be corrupted or password-protected.'],
      warnings: [],
    };
  }
}

/**
 * Validates custom authorization form
 * Less strict than Concentra validation since we generate these
 */
export async function validateCustomAuthForm(
  options: ValidateConcentraAuthOptions
): Promise<PDFValidationResult> {
  const { pdfBuffer, candidateFirstName, candidateLastName } = options;

  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const data = await pdf(pdfBuffer);
    const text = data.text.toLowerCase();

    // Check candidate name
    const hasFirstName = text.includes(candidateFirstName.toLowerCase());
    const hasLastName = text.includes(candidateLastName.toLowerCase());

    if (!hasFirstName || !hasLastName) {
      errors.push(`Candidate name "${candidateFirstName} ${candidateLastName}" not found in the PDF.`);
    }

    // Check minimum content
    if (text.length < 50) {
      errors.push('PDF appears to have very little content.');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      extractedText: data.text,
    };

  } catch (error) {
    console.error('Error validating PDF:', error);
    return {
      isValid: false,
      errors: ['Failed to read PDF content. The file may be corrupted or password-protected.'],
      warnings: [],
    };
  }
}
