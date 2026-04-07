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
    let systemLog = budgetHub.getSheetByName("SystemLog");

    if (!systemLog) {
      systemLog = budgetHub.insertSheet("SystemLog");
      systemLog
        .getRange(1, 1, 1, 8)
        .setValues([
          [
            "Timestamp",
            "Action",
            "User",
            "Amount",
            "Details",
            "TransactionID",
            "Department",
            "Status",
          ],
        ]);
      systemLog.setFrozenRows(1);
    }

    const timestamp = new Date();
    const transactionId = details.transactionId || "";
    const department = details.department || "";
    const detailsJson =
      typeof details === "object" ? JSON.stringify(details) : details;
    const status = action.includes("ERROR") ? "ERROR" : "SUCCESS";

    // INSERT AT ROW 2 (top of data, below headers)
    systemLog.insertRowAfter(1);
    systemLog
      .getRange(2, 1, 1, 8)
      .setValues([
        [
          timestamp,
          action,
          user,
          amount || 0,
          detailsJson,
          transactionId,
          department,
          status,
        ],
      ]);
  } catch (error) {
    console.error("System logging failed:", error);
  }
}

/**
 * Handles general processing errors
 * Logs to SystemLog first (without email dependency), then attempts email
 */
function handleProcessingError(e, error) {
  const timestamp = new Date();
  const errorId = `ERR_${timestamp.getTime()}`;
  const userEmail = e.response?.getRespondentEmail() || "UNKNOWN";

  // ALWAYS log to console first (never fails)
  console.error(`⚠️ Processing Error ${errorId}:`, error);
  console.error(`User: ${userEmail}`);

  // Step 1: Try to log to SystemLog (separate try-catch)
  try {
    const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
    let logSheet = budgetHub.getSheetByName("SystemLog");

    if (!logSheet) {
      console.warn("SystemLog sheet not found, creating...");
      logSheet = budgetHub.insertSheet("SystemLog");
      logSheet.appendRow([
        "Timestamp",
        "Action",
        "User",
        "Amount",
        "Details",
        "TransactionID",
        "Department",
        "Status",
      ]);
      logSheet.setFrozenRows(1);
    }

    logSheet.appendRow([
      timestamp,
      "PROCESSING_ERROR",
      userEmail,
      0,
      `Error: ${error.message}`,
      "",
      "",
      "ERROR",
    ]);
    console.log("✅ Processing error logged to SystemLog");
  } catch (logError) {
    console.error("❌ Failed to log to SystemLog:", logError);
  }

  // Step 2: Try to send email notifications (separate try-catch)
  try {
    const adminEmailToNotify = "mtrotter@keswickchristian.org"; // Direct IT Admin

    // 2a. Determine user-facing message based on error type
    let userMessage = "An unexpected error occurred while processing your latest budget request form submission.";
    let nextSteps = "Please contact IT Administration (mtrotter@keswickchristian.org) for further assistance with Error ID: " + errorId;
    
    const errMsg = (error.message || "").toLowerCase();
    
    if (errMsg.includes("lock") || errMsg.includes("busy") || errMsg.includes("timeout")) {
      userMessage = "The system was unusually busy while processing your request and timed out.";
      nextSteps = "Please try **resubmitting your request** via the Google Form. If the issue persists, contact IT.";
    } else if (errMsg.includes("budget") || errMsg.includes("allocated") || errMsg.includes("fund")) {
      userMessage = "There was an issue resolving your budget availability or department allocations.";
      nextSteps = "Please contact the **Business Office** to verify your budget state before resubmitting. Error ID: " + errorId;
    } else if (errMsg.includes("not found in directory") || errMsg.includes("invalid email")) {
      userMessage = "Your account or authorization level could not be identified by the system.";
      nextSteps = "Please contact **IT Administration (mtrotter@keswickchristian.org)** to establish your account. Error ID: " + errorId;
    }

    // 2b. Notify the user submitting the request
    if (userEmail && userEmail !== "UNKNOWN") {
      const emailObj = {
        to: userEmail,
        subject: `⚠️ Action Required: Purchase Request Processing Failed`,
        htmlBody: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
            <h2 style="color: #c62828;">Request Processing Error</h2>
            <p><strong>Hi there,</strong></p>
            <p>${userMessage}</p>
            <div style="background: #f8f9fa; padding: 15px; border-left: 4px solid #f57c00; margin: 15px 0;">
              <strong>Next Steps:</strong><br/>
              ${nextSteps.replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>')}
            </div>
            <p style="font-size: 12px; color: #777;">Error details have already been logged for the administrators. Reference ID: ${errorId}</p>
          </div>
        `
      };
      
      if (typeof sendSystemEmail === 'function') {
        sendSystemEmail(emailObj);
      } else {
        MailApp.sendEmail({to: userEmail, subject: emailObj.subject, htmlBody: emailObj.htmlBody});
      }
    }

    // 2c. Notify the Admin
    const adminSubject = `[Budget System] Processing Error - ${errorId}`;
    const adminBody = `An error occurred processing a form submission:\n\n` +
      `Error ID: ${errorId}\n` +
      `Form: ${e.source?.getTitle() || "UNKNOWN"}\n` +
      `User: ${userEmail}\n` +
      `Error: ${error.message}\n` +
      `Stack: ${error.stack}\n\n` +
      `The user has been automatically notified and directed to the appropriate support channel.`;

    if (typeof sendSystemEmail === 'function') {
      sendSystemEmail({ to: adminEmailToNotify, subject: adminSubject, body: adminBody });
    } else {
      MailApp.sendEmail({ to: adminEmailToNotify, subject: adminSubject, body: adminBody });
    }
    
    console.log("✅ Processing error emails dispatched.");
  } catch (emailError) {
    console.warn("⚠️ Failed to send error emails (permission issue?):", emailError.message);
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
    let logSheet = budgetHub.getSheetByName("SystemLog");

    // Create SystemLog if it doesn't exist
    if (!logSheet) {
      console.warn("SystemLog sheet not found, creating...");
      logSheet = budgetHub.insertSheet("SystemLog");
      logSheet.appendRow([
        "Timestamp",
        "Action",
        "User",
        "Amount",
        "Details",
        "TransactionID",
        "Department",
        "Status",
      ]);
      logSheet.setFrozenRows(1);
    }

    logSheet.appendRow([
      timestamp,
      "CRITICAL_ERROR",
      additionalData.requestorEmail || "UNKNOWN",
      0,
      `Critical Error: ${error.message} | Form: ${formType} | Response: ${responseId}`,
      additionalData.transactionId || "",
      "",
      "CRITICAL",
    ]);
    console.log("✅ Critical error logged to SystemLog");
  } catch (logError) {
    console.error("❌ Failed to log to SystemLog:", logError);
  }

  // Step 2: Try to send email notification (separate try-catch, won't block logging)
  try {
    if (CONFIG.ADMIN_EMAIL) {
      sendSystemEmail({
        to: CONFIG.ADMIN_EMAIL,
        subject: `[URGENT] Budget System Critical Error - ${errorId}`,
        body:
          `A critical error requires immediate attention:\n\n` +
          `Error ID: ${errorId}\n` +
          `Form Type: ${formType}\n` +
          `Response ID: ${responseId}\n` +
          `User: ${additionalData.requestorEmail || "UNKNOWN"}\n` +
          `Error: ${error.message}\n\n` +
          `Stack Trace:\n${error.stack || "N/A"}\n\n` +
          `Additional Data:\n${JSON.stringify(additionalData, null, 2)}\n\n` +
          `IMMEDIATE ACTION REQUIRED: Check if the transaction was partially processed.`,
      });
      console.log("✅ Critical error email sent");
    }
  } catch (emailError) {
    console.warn(
      "⚠️ Failed to send critical error email (permission issue?):",
      emailError.message,
    );
  }
}
