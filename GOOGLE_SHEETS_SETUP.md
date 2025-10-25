# Google Sheets Integration - Setup Guide

## ✅ What's Already Done

1. **Environment Variables Configured**
   - `SHEETS_SPREADSHEET_ID` = `1mf5NzPKwqq7R-mjZqN_lKUBqvda-xJ8-5S5lU9ZbPog`
   - `SHEETS_SERVICE_ACCOUNT_JSON` = Service account credentials
   - Available in: Production, Preview, Development, and Local

2. **Service Account Shared**
   - Email: `worksafe-now-sheet@core-access-tech-dev.iam.gserviceaccount.com`
   - Has Editor access to the spreadsheet

3. **Code Implemented**
   - Google Sheets API integration (`src/integrations/sheets.ts`)
   - Webhook endpoint (`src/app/api/webhooks/sheets/route.ts`)
   - Order creation automatically syncs to sheet

## 📋 Next Steps to Complete Setup

### Step 1: Initialize the Spreadsheet with Headers

Run this once to set up the sheet structure:

```typescript
// You can create a simple script or API endpoint to run this once
import { initializeSheet } from '@/integrations/sheets';

await initializeSheet();
```

Or manually add these headers to row 1 of your "Orders" sheet:

| Order Number | First Name | Last Name | Email | Phone | Test Type | Urgency | Jobsite Location | Needs Mask | Mask Size | Status | Created At | Notes |
|--------------|------------|-----------|-------|-------|-----------|---------|------------------|------------|-----------|--------|------------|-------|

### Step 2: Add Apps Script to Google Sheet

1. Open your Google Sheet: https://docs.google.com/spreadsheets/d/1mf5NzPKwqq7R-mjZqN_lKUBqvda-xJ8-5S5lU9ZbPog/edit

2. Click **Extensions** > **Apps Script**

3. Replace the default code with:

```javascript
const WEBHOOK_URL = 'https://worksafenow-portal-v2.vercel.app/api/webhooks/sheets';
const SECRET = 'your-signing-secret-here'; // Optional: Set SHEETS_WEBHOOK_SIGNING_SECRET in Vercel

function onEdit(e) {
  try {
    const sheet = e.source.getActiveSheet();

    // Only trigger for the "Orders" sheet
    if (sheet.getName() !== 'Orders') {
      return;
    }

    // Don't trigger for header row
    const row = e.range.getRow();
    if (row === 1) {
      return;
    }

    // Get the full row data
    const rowValues = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    const payload = {
      rowId: row,
      headers: headers,
      values: rowValues,
      signature: SECRET,
      editedBy: Session.getActiveUser().getEmail(),
      ts: new Date().toISOString(),
    };

    // Send webhook to your server
    const response = UrlFetchApp.fetch(WEBHOOK_URL, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    Logger.log('Webhook sent. Response: ' + response.getResponseCode());
  } catch (err) {
    Logger.log('Error in onEdit trigger: ' + err.toString());
  }
}
```

4. Click **Save** (disk icon)

5. Click **Run** > Select `onEdit` function

6. Authorize the script when prompted

### Step 3: (Optional) Add Webhook Signing Secret

For security, add a signing secret to verify webhook requests:

```bash
# Generate a random secret
openssl rand -hex 32

# Add to Vercel
echo "YOUR_SECRET_HERE" | vercel env add SHEETS_WEBHOOK_SIGNING_SECRET production --scope core-access-technologies
```

Update the `SECRET` constant in the Apps Script with the same value.

## 🎯 How It Works

### Order Creation → Sheet

1. User creates an order in the portal
2. Order is saved to database
3. Order data is automatically appended to Google Sheet (async)
4. The row number is stored in the database as `externalRowId`

**Sheet Columns:**
- Order Number, First Name, Last Name, Email, Phone
- Test Type, Urgency, Jobsite Location
- Needs Mask, Mask Size
- Status, Created At, Notes

### Sheet Edit → Database

1. User edits the Status or Notes column in Google Sheet
2. Apps Script `onEdit` trigger fires
3. Webhook sends the updated data to your API
4. API updates the order in the database
5. Changes are reflected in the portal immediately

## 🧪 Testing

### Test Order Creation → Sheet:

1. Go to https://worksafenow-portal-v2.vercel.app
2. Sign in as an employer
3. Create a new test order
4. Check your Google Sheet - new row should appear

### Test Sheet → Database:

1. Edit the "Status" column in a row (e.g., change "new" to "in-progress")
2. Check the order in the portal - status should update
3. View Vercel logs to see webhook processing

## 🔍 Troubleshooting

### Order not appearing in sheet?

- Check Vercel logs: `vercel logs https://worksafenow-portal-v2.vercel.app`
- Verify service account has Editor access
- Confirm sheet is named "Orders" (or update the range in code)

### Sheet edits not updating database?

- Check Apps Script logs: Extensions > Apps Script > Executions
- Test webhook endpoint: `curl https://worksafenow-portal-v2.vercel.app/api/webhooks/sheets`
- Verify Apps Script `onEdit` trigger is installed
- Check webhook signing secret matches

### View Logs:

```bash
# Production logs
vercel logs https://worksafenow-portal-v2.vercel.app --scope core-access-technologies

# Filter for Google Sheets activity
vercel logs https://worksafenow-portal-v2.vercel.app --scope core-access-technologies | grep -i sheet
```

## 📊 Sheet Status Values

Valid status values (must match exactly):
- `new` - Order created, awaiting provider assignment
- `assigned` - Site/appointment assigned
- `scheduled` - Appointment scheduled
- `in_progress` - Candidate checked in
- `completed` - Testing completed
- `results_received` - Results uploaded
- `cancelled` - Order cancelled

## ✅ Module 11 Complete!

- [x] Google Sheets API integration
- [x] Automatic order syncing
- [x] Webhook endpoint for sheet edits
- [x] Bi-directional data sync
- [x] Environment variables configured
- [x] Service account permissions granted

**Next Module:** Module 12 - Site Matching & Geolocation
