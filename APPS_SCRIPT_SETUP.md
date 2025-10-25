# Google Apps Script Setup for Bi-Directional Sync

## Overview

This Apps Script code will automatically send webhook notifications to your API when the Google Sheet is edited, enabling bi-directional sync between the sheet and your database.

## Step-by-Step Setup

### 1. Open Google Apps Script

1. Open your Google Sheet: https://docs.google.com/spreadsheets/d/1mf5NzPKwqq7R-mjZqN_lKUBqvda-xJ8-5S5lU9ZbPog/edit
2. Click **Extensions** → **Apps Script**
3. You'll see a new tab open with the Apps Script editor

### 2. Replace Default Code

Delete any existing code in the editor and paste this:

```javascript
// ============================================================================
// CONFIGURATION
// ============================================================================

const WEBHOOK_URL = 'https://worksafenow-portal-v2.vercel.app/api/webhooks/sheets';
const SECRET = '8e7f1e267dd9ad5cca5f852e81ee5d5577c5b50e8999d8489bd83ca7da4ca996';

// ============================================================================
// MAIN TRIGGER FUNCTION
// ============================================================================

/**
 * Triggered when any cell in the spreadsheet is edited
 * Sends webhook to your API with the updated row data
 */
function onEdit(e) {
  try {
    const sheet = e.source.getActiveSheet();

    // Only trigger for the "Orders" sheet
    if (sheet.getName() !== 'Orders') {
      Logger.log('Edit was not in Orders sheet, skipping webhook');
      return;
    }

    // Don't trigger for header row
    const row = e.range.getRow();
    if (row === 1) {
      Logger.log('Header row edited, skipping webhook');
      return;
    }

    Logger.log(`Edit detected in Orders sheet, row ${row}`);

    // Get the full row data
    const lastColumn = sheet.getLastColumn();
    const rowValues = sheet.getRange(row, 1, 1, lastColumn).getValues()[0];
    const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];

    // Build webhook payload
    const payload = {
      rowId: row,
      headers: headers,
      values: rowValues,
      signature: SECRET,
      editedBy: Session.getActiveUser().getEmail(),
      editedColumn: e.range.getColumn(),
      editedColumnName: headers[e.range.getColumn() - 1],
      oldValue: e.oldValue || null,
      newValue: e.value || null,
      ts: new Date().toISOString(),
    };

    Logger.log('Sending webhook with payload: ' + JSON.stringify(payload, null, 2));

    // Send webhook to your server
    const response = UrlFetchApp.fetch(WEBHOOK_URL, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    Logger.log(`Webhook response: ${responseCode}`);
    Logger.log(`Response body: ${responseBody}`);

    if (responseCode >= 200 && responseCode < 300) {
      Logger.log('✅ Webhook sent successfully');
    } else {
      Logger.log(`⚠️  Webhook failed with status ${responseCode}`);
    }

  } catch (err) {
    Logger.log('❌ Error in onEdit trigger: ' + err.toString());
    Logger.log('Stack trace: ' + err.stack);
  }
}

// ============================================================================
// TEST FUNCTIONS (Optional - for debugging)
// ============================================================================

/**
 * Test function to manually trigger a webhook
 * Run this to test the webhook without editing the sheet
 */
function testWebhook() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Orders');

  if (!sheet) {
    Logger.log('❌ Orders sheet not found');
    return;
  }

  // Get row 2 data (first order)
  const lastColumn = sheet.getLastColumn();
  const rowValues = sheet.getRange(2, 1, 1, lastColumn).getValues()[0];
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];

  const payload = {
    rowId: 2,
    headers: headers,
    values: rowValues,
    signature: SECRET,
    editedBy: Session.getActiveUser().getEmail(),
    ts: new Date().toISOString(),
  };

  Logger.log('Testing webhook with payload: ' + JSON.stringify(payload, null, 2));

  try {
    const response = UrlFetchApp.fetch(WEBHOOK_URL, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    Logger.log(`Response code: ${response.getResponseCode()}`);
    Logger.log(`Response body: ${response.getContentText()}`);

  } catch (err) {
    Logger.log('❌ Test webhook failed: ' + err.toString());
  }
}

/**
 * Check webhook endpoint connectivity
 */
function checkWebhookEndpoint() {
  try {
    const response = UrlFetchApp.fetch(WEBHOOK_URL, {
      method: 'get',
      muteHttpExceptions: true,
    });

    Logger.log(`Endpoint status: ${response.getResponseCode()}`);
    Logger.log(`Response: ${response.getContentText()}`);

  } catch (err) {
    Logger.log('❌ Failed to connect: ' + err.toString());
  }
}
```

### 3. Save the Script

1. Click the **disk icon** or press `Cmd+S` (Mac) / `Ctrl+S` (Windows)
2. Give your project a name: "WorkSafe Now Webhook"
3. Click **OK**

### 4. Test the Connection (Optional but Recommended)

Before enabling the trigger, test that the webhook endpoint is reachable:

1. In the Apps Script editor, find the function dropdown at the top (shows "onEdit" by default)
2. Select **`checkWebhookEndpoint`**
3. Click the **Run** button (▶️ play icon)
4. You may need to authorize the script:
   - Click **Review Permissions**
   - Select your Google account
   - Click **Advanced** → **Go to WorkSafe Now Webhook (unsafe)**
   - Click **Allow**
5. Once authorized, check the **Execution log** (View → Logs)
6. You should see "Endpoint status: 200" confirming connectivity

### 5. Install the Trigger

The `onEdit` function is a **simple trigger** that runs automatically when the sheet is edited. No manual installation needed - it will start working immediately after you save the script!

However, you can verify it works:

1. Go back to your Google Sheet
2. In the "Orders" sheet, change the **Status** column in row 2 (e.g., from "new" to "in_progress")
3. Go back to Apps Script → **Executions** (left sidebar)
4. You should see the `onEdit` function ran
5. Click on it to view logs and confirm webhook was sent

### 6. Test the Full Sync

1. **Edit the Status column** in your test order row:
   - Change from "new" → "in_progress"

2. **Check your database**:
   - Run: `npx tsx scripts/list-orders.ts` (create this script if needed)
   - Or check in the portal: http://localhost:3000
   - The status should update automatically

3. **Edit the Notes column**:
   - Add some text like "Called candidate, scheduled for tomorrow"
   - Verify it updates in the database

## Troubleshooting

### View Apps Script Logs

1. In Apps Script editor, click **Executions** (left sidebar, clock icon)
2. Click on any execution to see detailed logs
3. Look for error messages or webhook responses

### Common Issues

**Issue: "onEdit not triggering"**
- Make sure you're editing the "Orders" sheet, not "Sheet1"
- Don't edit row 1 (headers) - trigger ignores header edits
- Check that the script is saved

**Issue: "Webhook returns 404"**
- Verify the WEBHOOK_URL is correct
- Make sure your API is deployed to Vercel
- Test the endpoint: `curl https://worksafenow-portal-v2.vercel.app/api/webhooks/sheets`

**Issue: "Webhook returns 401 (Unauthorized)"**
- Check that the SECRET matches in both:
  - Apps Script code
  - Vercel environment variable `SHEETS_WEBHOOK_SIGNING_SECRET`

**Issue: "Order not found in database"**
- The order must have been created through your API first
- The `externalRowId` in the database must match the row number in the sheet
- Check: Is the test order in row 2? Does it have `externalRowId: "2"`?

### Test Webhook Manually

Run the test function in Apps Script:

1. Select **`testWebhook`** from the function dropdown
2. Click **Run** (▶️)
3. Check logs to see the full request/response
4. This sends a webhook for row 2 without requiring an actual edit

## What Gets Synced

**From Sheet → Database:**
- ✅ **Status** changes (e.g., "new" → "in_progress")
- ✅ **Notes** updates (any text added/modified)

**From Database → Sheet:**
- ✅ **New orders** automatically appear as new rows
- ✅ **All order fields** populated on creation

**Not Synced:**
- ❌ Candidate info changes (name, email, phone, etc.)
- ❌ Test type, urgency, location changes
- ❌ Mask requirement changes

> **Why?** Only Status and Notes are designed to be edited in the sheet. Other fields should only be modified through the portal to maintain data integrity.

## Valid Status Values

When editing the Status column, use these exact values:

- `new` - Order created, awaiting provider assignment
- `assigned` - Site/appointment assigned
- `scheduled` - Appointment scheduled
- `in_progress` - Candidate checked in
- `completed` - Testing completed
- `results_received` - Results uploaded
- `cancelled` - Order cancelled

## Security Notes

- ✅ Webhook uses signing secret for authentication
- ✅ Only Status and Notes columns are synced to prevent data corruption
- ✅ All webhook calls are logged in Vercel for auditing
- ✅ Apps Script runs with your Google account permissions

## Next Steps

Once the Apps Script is set up and working:

1. ✅ Test editing Status and Notes to confirm bi-directional sync
2. ✅ Deploy updated code to production (includes sheets integration)
3. ✅ Create real orders and verify they sync
4. ✅ Train your team on which columns they can edit in the sheet

## Support

If you encounter issues:
- Check Vercel logs: `vercel logs https://worksafenow-portal-v2.vercel.app`
- Check Apps Script execution logs (Executions tab)
- Verify environment variables are set correctly
- Test webhook endpoint is responding: `curl https://worksafenow-portal-v2.vercel.app/api/webhooks/sheets`
