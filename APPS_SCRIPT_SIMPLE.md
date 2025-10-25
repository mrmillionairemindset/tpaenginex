# Simplified Apps Script (If getting errors)

If you're getting a "Bad Request Error 400" from Apps Script, try this simplified version instead:

## Simplified Apps Script Code

```javascript
// ============================================================================
// CONFIGURATION
// ============================================================================

const WEBHOOK_URL = 'https://worksafenow-portal-v2.vercel.app/api/webhooks/sheets';
const SECRET = '8e7f1e267dd9ad5cca5f852e81ee5d5577c5b50e8999d8489bd83ca7da4ca996';

// ============================================================================
// MAIN TRIGGER FUNCTION
// ============================================================================

function onEdit(e) {
  try {
    // Get basic info about the edit
    const sheet = e.range.getSheet();
    const sheetName = sheet.getName();
    const row = e.range.getRow();

    Logger.log('Edit detected in sheet: ' + sheetName + ', row: ' + row);

    // Only process Orders sheet, skip header row
    if (sheetName !== 'Orders' || row === 1) {
      Logger.log('Skipping - wrong sheet or header row');
      return;
    }

    // Get all data we need
    const lastColumn = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
    const rowValues = sheet.getRange(row, 1, 1, lastColumn).getValues()[0];

    Logger.log('Headers: ' + JSON.stringify(headers));
    Logger.log('Values: ' + JSON.stringify(rowValues));

    // Build payload
    const payload = {
      rowId: row,
      headers: headers,
      values: rowValues,
      signature: SECRET,
      editedBy: Session.getActiveUser().getEmail(),
      ts: new Date().toISOString()
    };

    Logger.log('Sending webhook...');

    // Send webhook
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(WEBHOOK_URL, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    Logger.log('Response code: ' + responseCode);
    Logger.log('Response body: ' + responseText);

    if (responseCode === 200) {
      Logger.log('✅ SUCCESS');
    } else {
      Logger.log('❌ FAILED with code ' + responseCode);
    }

  } catch (error) {
    Logger.log('❌ ERROR: ' + error.toString());
    if (error.stack) {
      Logger.log('Stack: ' + error.stack);
    }
  }
}

// ============================================================================
// TEST FUNCTION
// ============================================================================

function testWebhookSimple() {
  Logger.log('Starting test...');

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Orders');

    if (!sheet) {
      Logger.log('❌ Orders sheet not found');
      return;
    }

    Logger.log('Found Orders sheet');

    const lastColumn = sheet.getLastColumn();
    Logger.log('Last column: ' + lastColumn);

    const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
    Logger.log('Headers: ' + JSON.stringify(headers));

    const rowValues = sheet.getRange(2, 1, 1, lastColumn).getValues()[0];
    Logger.log('Row 2 values: ' + JSON.stringify(rowValues));

    const payload = {
      rowId: 2,
      headers: headers,
      values: rowValues,
      signature: SECRET,
      editedBy: Session.getActiveUser().getEmail(),
      ts: new Date().toISOString()
    };

    Logger.log('Payload created');
    Logger.log('Payload: ' + JSON.stringify(payload));

    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    Logger.log('Sending request to: ' + WEBHOOK_URL);

    const response = UrlFetchApp.fetch(WEBHOOK_URL, options);

    Logger.log('Response code: ' + response.getResponseCode());
    Logger.log('Response: ' + response.getContentText());

  } catch (error) {
    Logger.log('❌ Test error: ' + error.toString());
    if (error.stack) {
      Logger.log('Stack: ' + error.stack);
    }
  }
}
```

## How to Use This Version

1. **Replace your Apps Script code** with the above (it's simpler and has better logging)

2. **Save** the script

3. **Test it first** by running `testWebhookSimple`:
   - Select `testWebhookSimple` from the dropdown
   - Click Run ▶️
   - Check the logs (View → Logs or Cmd+Enter)
   - You should see detailed output about what's happening

4. **If test works**, try editing the sheet:
   - Go to your Google Sheet
   - Edit the Status column in row 2
   - Check Executions to see if onEdit ran
   - Look at the logs to see what happened

## Common Error Messages and Fixes

### "Exception: You do not have permission to call UrlFetchApp.fetch"
**Fix**: You need to authorize the script:
- Run `testWebhookSimple` function
- Click "Review Permissions"
- Authorize the script

### "Response code: 400"
**Fix**: Check the response body in logs - it will tell you what's wrong
- Missing headers? Check that row 1 has all column names
- Missing signature? Check the SECRET is set correctly
- Status column not found? Make sure "Status" is spelled exactly right in row 1

### "Response code: 401"
**Fix**: Signature doesn't match
- Make sure SECRET in Apps Script matches the Vercel environment variable
- No extra spaces or line breaks

### "Response code: 404"
**Fix**: Order not found
- The order must exist in your database first
- The `externalRowId` must match the row number
- Row 2 in sheet = externalRowId: "2" in database

## Debugging Steps

1. **Run testWebhookSimple** and check logs carefully
2. **Look for the exact error message** in logs
3. **Check what the API returned** in the response body
4. **Verify your data**:
   - Does row 2 have data?
   - Does the order exist in database?
   - Is externalRowId correct?

## Still Not Working?

Share the complete log output from `testWebhookSimple` and I can help debug further.
