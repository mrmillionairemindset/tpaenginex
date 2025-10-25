const WEBHOOK_URL = 'https://worksafenow-portal-v2.vercel.app/api/webhooks/sheets';
const SECRET = '8e7f1e267dd9ad5cca5f852e81ee5d5577c5b50e8999d8489bd83ca7da4ca996';

function onEdit(e) {
  try {
    const sheet = e.source.getActiveSheet();

    if (sheet.getName() !== 'Orders') {
      Logger.log('Edit was not in Orders sheet, skipping webhook');
      return;
    }

    const row = e.range.getRow();
    if (row === 1) {
      Logger.log('Header row edited, skipping webhook');
      return;
    }

    Logger.log('Edit detected in Orders sheet, row ' + row);

    const lastColumn = sheet.getLastColumn();
    const rowValues = sheet.getRange(row, 1, 1, lastColumn).getValues()[0];
    const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];

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
      ts: new Date().toISOString()
    };

    Logger.log('Sending webhook with payload: ' + JSON.stringify(payload, null, 2));

    const response = UrlFetchApp.fetch(WEBHOOK_URL, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    Logger.log('Webhook response: ' + responseCode);
    Logger.log('Response body: ' + responseBody);

    if (responseCode >= 200 && responseCode < 300) {
      Logger.log('Webhook sent successfully');
    } else {
      Logger.log('Webhook failed with status ' + responseCode);
    }

  } catch (err) {
    Logger.log('Error in onEdit trigger: ' + err.toString());
    Logger.log('Stack trace: ' + err.stack);
  }
}

function testWebhook() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Orders');

  if (!sheet) {
    Logger.log('Orders sheet not found');
    return;
  }

  const lastColumn = sheet.getLastColumn();
  const rowValues = sheet.getRange(2, 1, 1, lastColumn).getValues()[0];
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];

  const payload = {
    rowId: 2,
    headers: headers,
    values: rowValues,
    signature: SECRET,
    editedBy: Session.getActiveUser().getEmail(),
    ts: new Date().toISOString()
  };

  Logger.log('Testing webhook with payload: ' + JSON.stringify(payload, null, 2));

  try {
    const response = UrlFetchApp.fetch(WEBHOOK_URL, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    Logger.log('Response code: ' + response.getResponseCode());
    Logger.log('Response body: ' + response.getContentText());

  } catch (err) {
    Logger.log('Test webhook failed: ' + err.toString());
  }
}

function checkWebhookEndpoint() {
  try {
    const response = UrlFetchApp.fetch(WEBHOOK_URL, {
      method: 'get',
      muteHttpExceptions: true
    });

    Logger.log('Endpoint status: ' + response.getResponseCode());
    Logger.log('Response: ' + response.getContentText());

  } catch (err) {
    Logger.log('Failed to connect: ' + err.toString());
  }
}
