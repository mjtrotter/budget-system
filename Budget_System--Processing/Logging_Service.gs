/**
 * ============================================================================
 * LOGGING SERVICE
 * ============================================================================
 * Centralized logging and error handling for the Keswick Budget System.
 * Moves these critical functions out of Main.gs for better maintainability.
 */

/**
 * Enhanced system logging that inserts new entries at the top
 * Replaces any existing logSystemLog or system logging functions
 */
function logSystemEvent(action, user, amount, details) {
  try {
    const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
    let systemLog = budgetHub.getSheetByName('SystemLog');

    if (!systemLog) {
      systemLog = budgetHub.insertSheet('SystemLog');
      systemLog.getRange(1, 1, 1, 8).setValues([[
        'Timestamp', 'Action', 'User', 'Amount', 'Details', 
        'TransactionID', 'Department', 'Status'
      ]]);
      systemLog.setFrozenRows(1);
    }

    const timestamp = new Date();
    const transactionId = details.transactionId || '';
    const department = details.department || '';
    const detailsJson = typeof details === 'object' ? JSON.stringify(details) : details;
    const status = action.includes('ERROR') ? 'ERROR' : 'SUCCESS';

    // INSERT AT ROW 2 (top of data, below headers)
    systemLog.insertRowAfter(1);
    systemLog.getRange(2, 1, 1, 8).setValues([[
      timestamp, action, user, amount || 0, detailsJson,
      transactionId, department, status
    ]]);

  } catch (error) {
    console.error('System logging failed:', error);
  }
}

/**
 * Handles general processing errors
 * Logs to SystemLog first (without email dependency), then attempts email
 */
function handleProcessingError(e, error) {
  const timestamp = new Date();
  const errorId = `ERR_${timestamp.getTime()}`;
  const userEmail = e.response?.getRespondentEmail() || 'UNKNOWN';

  // ALWAYS log to console first (never fails)
  console.error(`⚠️ Processing Error ${errorId}:`, error);
  console.error(`User: ${userEmail}`);

  // Step 1: Try to log to SystemLog (separate try-catch)
  try {
    const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
    let logSheet = budgetHub.getSheetByName('SystemLog');

    if (!logSheet) {
      console.warn('SystemLog sheet not found, creating...');
      logSheet = budgetHub.insertSheet('SystemLog');
      logSheet.appendRow(['Timestamp', 'Action', 'User', 'Amount', 'Details', 'TransactionID', 'Department', 'Status']);
      logSheet.setFrozenRows(1);
    }

    logSheet.appendRow([
      timestamp,
      'PROCESSING_ERROR',
      userEmail,
      0,
      `Error: ${error.message}`,
      '',
      '',
      'ERROR'
    ]);
    console.log('✅ Processing error logged to SystemLog');
  } catch (logError) {
    console.error('❌ Failed to log to SystemLog:', logError);
  }

  // Step 2: Try to send email notification (separate try-catch)
  try {
    if (CONFIG.ADMIN_EMAIL) {
      MailApp.sendEmail({
        to: CONFIG.ADMIN_EMAIL,
        subject: `[Budget System] Processing Error - ${errorId}`,
        body: `An error occurred processing a form submission:\n\n` +
              `Error ID: ${errorId}\n` +
              `Form: ${e.source?.getTitle() || 'UNKNOWN'}\n` +
              `User: ${userEmail}\n` +
              `Error: ${error.message}\n\n` +
              `Please check the system logs for more details.`
      });
      console.log('✅ Processing error email sent');
    }
  } catch (emailError) {
    console.warn('⚠️ Failed to send error email (permission issue?):', emailError.message);
  }
}

/**
 * Handles critical system errors requiring immediate attention
 * Logs to SystemLog first (without email dependency), then attempts email
 */
function handleCriticalError(responseId, formType, error, additionalData = {}) {
  const timestamp = new Date();
  const errorId = `CRIT_${timestamp.getTime()}`;

  // ALWAYS log to console first (never fails)
  console.error(`🚨 Critical Error ${errorId}:`, error);
  console.error(`Form: ${formType}, Response: ${responseId}`);
  console.error(`Additional Data:`, JSON.stringify(additionalData));

  // Step 1: Try to log to SystemLog (separate try-catch)
  try {
    const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
    let logSheet = budgetHub.getSheetByName('SystemLog');

    // Create SystemLog if it doesn't exist
    if (!logSheet) {
      console.warn('SystemLog sheet not found, creating...');
      logSheet = budgetHub.insertSheet('SystemLog');
      logSheet.appendRow(['Timestamp', 'Action', 'User', 'Amount', 'Details', 'TransactionID', 'Department', 'Status']);
      logSheet.setFrozenRows(1);
    }

    logSheet.appendRow([
      timestamp,
      'CRITICAL_ERROR',
      additionalData.requestorEmail || 'UNKNOWN',
      0,
      `Critical Error: ${error.message} | Form: ${formType} | Response: ${responseId}`,
      additionalData.transactionId || '',
      '',
      'CRITICAL'
    ]);
    console.log('✅ Critical error logged to SystemLog');
  } catch (logError) {
    console.error('❌ Failed to log to SystemLog:', logError);
  }

  // Step 2: Try to send email notification (separate try-catch, won't block logging)
  try {
    if (CONFIG.ADMIN_EMAIL) {
      MailApp.sendEmail({
        to: CONFIG.ADMIN_EMAIL,
        subject: `[URGENT] Budget System Critical Error - ${errorId}`,
        body: `A critical error requires immediate attention:\n\n` +
              `Error ID: ${errorId}\n` +
              `Form Type: ${formType}\n` +
              `Response ID: ${responseId}\n` +
              `User: ${additionalData.requestorEmail || 'UNKNOWN'}\n` +
              `Error: ${error.message}\n\n` +
              `Stack Trace:\n${error.stack || 'N/A'}\n\n` +
              `Additional Data:\n${JSON.stringify(additionalData, null, 2)}\n\n` +
              `IMMEDIATE ACTION REQUIRED: Check if the transaction was partially processed.`
      });
      console.log('✅ Critical error email sent');
    }
  } catch (emailError) {
    console.warn('⚠️ Failed to send critical error email (permission issue?):', emailError.message);
  }
}
