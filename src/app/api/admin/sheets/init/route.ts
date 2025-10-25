import { NextRequest, NextResponse } from 'next/server';
import { initializeSheet } from '@/integrations/sheets';
import { withAuth } from '@/auth/api-middleware';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/sheets/init
 * Initialize Google Sheet with headers
 * Only admins can call this endpoint
 */
export const POST = withAuth(async (req, user) => {
  // Only provider admins should initialize sheets
  if (!user.role?.includes('admin')) {
    return NextResponse.json(
      { error: 'Only admins can initialize sheets' },
      { status: 403 }
    );
  }

  try {
    await initializeSheet();

    return NextResponse.json({
      success: true,
      message: 'Google Sheet initialized with headers successfully',
      spreadsheetId: process.env.SHEETS_SPREADSHEET_ID,
      headers: [
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
      ],
    });
  } catch (error) {
    console.error('Failed to initialize Google Sheet:', error);
    return NextResponse.json(
      {
        error: 'Failed to initialize sheet',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
});

/**
 * GET /api/admin/sheets/init
 * Check if sheet is initialized
 */
export const GET = withAuth(async (req, user) => {
  if (!user.role?.includes('admin')) {
    return NextResponse.json(
      { error: 'Only admins can check sheet status' },
      { status: 403 }
    );
  }

  return NextResponse.json({
    message: 'Sheet initialization endpoint is ready',
    spreadsheetId: process.env.SHEETS_SPREADSHEET_ID,
    spreadsheetUrl: process.env.SHEETS_SPREADSHEET_ID
      ? `https://docs.google.com/spreadsheets/d/${process.env.SHEETS_SPREADSHEET_ID}/edit`
      : null,
    instructions: 'Send POST request to this endpoint to initialize the sheet with headers',
  });
});
