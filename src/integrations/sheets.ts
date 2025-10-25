import { google } from 'googleapis';

// Initialize Google Sheets API with service account
const getAuth = () => {
  if (!process.env.SHEETS_SERVICE_ACCOUNT_JSON) {
    throw new Error('SHEETS_SERVICE_ACCOUNT_JSON environment variable is not set');
  }

  return new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.SHEETS_SERVICE_ACCOUNT_JSON),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
};

const getSheets = () => {
  const auth = getAuth();
  return google.sheets({ version: 'v4', auth });
};

const SPREADSHEET_ID = process.env.SHEETS_SPREADSHEET_ID;

export interface OrderSheetData {
  orderNumber: string;
  candidateFirstName: string;
  candidateLastName: string;
  candidateEmail: string;
  candidatePhone: string;
  testType: string;
  urgency: string;
  jobsiteLocation: string;
  needsMask: boolean;
  maskSize?: string;
  status: string;
  createdAt: string;
  notes?: string;
}

/**
 * Append a new order to the Google Sheet
 * Returns the row ID (row number) where the order was added
 */
export async function appendOrderToSheet(order: OrderSheetData): Promise<string | null> {
  if (!SPREADSHEET_ID) {
    console.warn('SHEETS_SPREADSHEET_ID not configured, skipping sheet sync');
    return null;
  }

  const sheets = getSheets();

  const values = [[
    order.orderNumber,
    order.candidateFirstName,
    order.candidateLastName,
    order.candidateEmail,
    order.candidatePhone,
    order.testType,
    order.urgency,
    order.jobsiteLocation,
    order.needsMask ? 'Yes' : 'No',
    order.maskSize || '',
    order.status,
    order.createdAt,
    order.notes || '',
  ]];

  try {
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Orders!A:M', // Columns A through M
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });

    // Extract row number from the updated range (e.g., "Orders!A2:M2" -> "2")
    const rowId = response.data.updates?.updatedRange?.match(/\d+/)?.[0];

    console.log(`✅ Added order ${order.orderNumber} to Google Sheet at row ${rowId}`);
    return rowId || null;
  } catch (error) {
    console.error('Failed to append order to Google Sheet:', error);
    throw error;
  }
}

/**
 * Update an existing row in the Google Sheet
 */
export async function updateSheetRow(rowId: string, order: OrderSheetData): Promise<void> {
  if (!SPREADSHEET_ID) {
    console.warn('SHEETS_SPREADSHEET_ID not configured, skipping sheet update');
    return;
  }

  const sheets = getSheets();
  const range = `Orders!A${rowId}:M${rowId}`;

  const values = [[
    order.orderNumber,
    order.candidateFirstName,
    order.candidateLastName,
    order.candidateEmail,
    order.candidatePhone,
    order.testType,
    order.urgency,
    order.jobsiteLocation,
    order.needsMask ? 'Yes' : 'No',
    order.maskSize || '',
    order.status,
    order.createdAt,
    order.notes || '',
  ]];

  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });

    console.log(`✅ Updated order ${order.orderNumber} in Google Sheet at row ${rowId}`);
  } catch (error) {
    console.error('Failed to update Google Sheet:', error);
    throw error;
  }
}

/**
 * Initialize the Google Sheet with headers if needed
 * Call this once to set up the sheet structure
 */
export async function initializeSheet(): Promise<void> {
  if (!SPREADSHEET_ID) {
    throw new Error('SHEETS_SPREADSHEET_ID not configured');
  }

  const sheets = getSheets();

  const headers = [[
    'Order Number',
    'First Name',
    'Last Name',
    'Email',
    'Phone',
    'Test Type',
    'Urgency',
    'Jobsite Location',
    'Needs Mask',
    'Mask Size',
    'Status',
    'Created At',
    'Notes',
  ]];

  try {
    // Check if headers already exist
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Orders!A1:M1',
    });

    if (response.data.values && response.data.values.length > 0) {
      console.log('✅ Sheet headers already exist');
      return;
    }

    // Add headers
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Orders!A1:M1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: headers },
    });

    console.log('✅ Initialized Google Sheet with headers');
  } catch (error) {
    console.error('Failed to initialize Google Sheet:', error);
    throw error;
  }
}
