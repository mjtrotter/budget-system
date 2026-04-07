/**
 * ============================================================================
 * APPROVAL REMINDERS & ESCALATION
 * ============================================================================
 * Scans AutomatedQueue and ManualQueue for stale PENDING items and:
 *   - After 72 hours (APPROVAL_REMINDER_HOURS): sends reminder with fresh token.
 *   - After 7 days (APPROVAL_ESCALATION_DAYS): escalates to Business Office.
 *
 * Triggered every 6 hours by setupAllTriggers() in Main.gs.
 * ============================================================================
 */

/**
 * Main entry point — called by the 6-hour time trigger.
 */
function checkAndSendApprovalReminders() {
  console.log("🔔 === APPROVAL REMINDER CHECK START ===");

  const REMINDER_HOURS  = CONFIG.APPROVAL_REMINDER_HOURS  || 72;   // 3 days
  const ESCALATION_DAYS = CONFIG.APPROVAL_ESCALATION_DAYS || 7;    // 1 week
  const now = new Date();

  let reminderCount   = 0;
  let escalationCount = 0;

  // Check Automated Queue (Amazon / Warehouse)
  const autoResults = _checkQueueForReminders(
    CONFIG.AUTOMATED_HUB_ID, "AutomatedQueue",
    true, now, REMINDER_HOURS, ESCALATION_DAYS
  );
  reminderCount   += autoResults.reminders;
  escalationCount += autoResults.escalations;

  // Check Manual Queue (Field Trip / Curriculum / Admin)
  const manualResults = _checkQueueForReminders(
    CONFIG.MANUAL_HUB_ID, "ManualQueue",
    false, now, REMINDER_HOURS, ESCALATION_DAYS
  );
  reminderCount   += manualResults.reminders;
  escalationCount += manualResults.escalations;

  console.log(`🔔 Reminder check complete — ${reminderCount} reminders sent, ${escalationCount} escalations.`);
  return { reminders: reminderCount, escalations: escalationCount };
}

/**
 * Scans a single queue sheet for stale PENDING items.
 * @param {string}  hubId          - Spreadsheet ID
 * @param {string}  sheetName      - 'AutomatedQueue' or 'ManualQueue'
 * @param {boolean} isAutomated    - Affects how we route approver lookups
 * @param {Date}    now            - Current timestamp
 * @param {number}  reminderHours  - Hours before first reminder
 * @param {number}  escalationDays - Days before BO escalation
 * @returns {{ reminders: number, escalations: number }}
 */
function _checkQueueForReminders(hubId, sheetName, isAutomated, now, reminderHours, escalationDays) {
  const results = { reminders: 0, escalations: 0 };

  try {
    const hub   = SpreadsheetApp.openById(hubId);
    const queue = hub.getSheetByName(sheetName);
    if (!queue) {
      console.warn(`⚠️ ${sheetName} not found in hub ${hubId}`);
      return results;
    }

    const data = queue.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      const row    = data[i];
      const status = String(row[7] || "").trim().toUpperCase(); // Column H
      if (status !== "PENDING") continue;

      const transactionId = String(row[0] || "").trim();
      const requestorEmail = String(row[1] || "").trim();
      const type          = String(row[2] || "").trim();
      const amount        = parseFloat(row[5]) || 0;
      const description   = String(row[6] || "").trim();
      const submittedOn   = new Date(row[8]); // Column I

      if (isNaN(submittedOn.getTime())) continue; // Skip rows with bad dates

      const hoursElapsed = (now - submittedOn) / (1000 * 60 * 60);

      if (hoursElapsed >= escalationDays * 24) {
        // Escalate to Business Office
        const escalated = _escalateToBO(transactionId, requestorEmail, type, amount, description);
        if (escalated) results.escalations++;

      } else if (hoursElapsed >= reminderHours) {
        // Send reminder to original approver
        const reminded = _sendReminder(transactionId, requestorEmail, type, amount, description, isAutomated);
        if (reminded) results.reminders++;
      }
    }
  } catch (err) {
    console.error(`❌ Error checking ${sheetName} for reminders:`, err);
  }

  return results;
}

/**
 * Sends a reminder email to the original approver with a fresh token.
 * Returns true on success.
 */
function _sendReminder(transactionId, requestorEmail, type, amount, description, isAutomated) {
  try {
    const userBudget = getUserBudgetInfo(requestorEmail);
    if (!userBudget) {
      console.warn(`⚠️ Reminder skipped — user not found: ${requestorEmail}`);
      return false;
    }

    const approverEmail = getApproverForRequest({ amount: amount }, userBudget);
    if (!approverEmail) {
      console.warn(`⚠️ Reminder skipped — no approver found for: ${requestorEmail}`);
      return false;
    }

    // Generate fresh approve & reject URLs (old token may be near expiry)
    const approveUrl = generateApprovalUrl(transactionId, approverEmail, "approve");
    const rejectUrl  = generateApprovalUrl(transactionId, approverEmail, "reject");

    // Build a reminder email using the same style as the main approval emails
    const amountFormatted = `$${amount.toFixed(2)}`;
    const subject = `⏰ REMINDER: Pending Approval Required — ${type} (${transactionId})`;

    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #f9fafb; padding: 20px;">
        <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
          <div style="background: #e67e22; padding: 28px 32px; text-align: center;">
            <div style="font-size: 36px; margin-bottom: 8px;">⏰</div>
            <h2 style="color: white; margin: 0; font-weight: 700; font-size: 20px;">Approval Reminder</h2>
            <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0 0; font-size: 14px;">This request has been awaiting your approval for over 72 hours.</p>
          </div>
          <div style="padding: 32px;">
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
              <tr><td style="padding: 10px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #f3f4f6;">Transaction ID</td><td style="padding: 10px 0; font-weight: 600; text-align: right; border-bottom: 1px solid #f3f4f6;">${transactionId}</td></tr>
              <tr><td style="padding: 10px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #f3f4f6;">Request Type</td><td style="padding: 10px 0; font-weight: 600; text-align: right; border-bottom: 1px solid #f3f4f6;">${type}</td></tr>
              <tr><td style="padding: 10px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #f3f4f6;">Requested By</td><td style="padding: 10px 0; font-weight: 600; text-align: right; border-bottom: 1px solid #f3f4f6;">${requestorEmail}</td></tr>
              <tr><td style="padding: 10px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #f3f4f6;">Amount</td><td style="padding: 10px 0; font-weight: 700; font-size: 18px; color: #19573B; text-align: right; border-bottom: 1px solid #f3f4f6;">${amountFormatted}</td></tr>
              <tr><td style="padding: 10px 0; color: #6b7280; font-size: 14px;">Description</td><td style="padding: 10px 0; font-weight: 500; text-align: right;">${description}</td></tr>
            </table>
            <table style="width: 100%; border-collapse: separate; border-spacing: 12px;">
              <tr>
                <td style="width: 50%;">
                  <a href="${approveUrl}" style="display: block; background: #19573B; color: white; padding: 14px 0; text-align: center; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 16px;">✓ Approve</a>
                </td>
                <td style="width: 50%;">
                  <a href="${rejectUrl}" style="display: block; background: white; color: #c62828; padding: 13px 0; text-align: center; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 16px; border: 2px solid #c62828;">✗ Deny</a>
                </td>
              </tr>
            </table>
            <p style="color: #9ca3af; font-size: 12px; margin-top: 20px; text-align: center;">These links are valid for 72 hours. If no action is taken within 7 days, this request will be escalated to the Business Office.</p>
          </div>
          <div style="padding: 16px 32px; background: #f9fafb; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">Keswick Christian School · Budget Management System</p>
          </div>
        </div>
      </div>`;

    sendSystemEmail({ to: approverEmail, subject: subject, htmlBody: htmlBody });

    logSystemEvent("APPROVAL_REMINDER_SENT", approverEmail, amount, {
      transactionId: transactionId,
      requestor: requestorEmail,
      type: type,
    });

    console.log(`🔔 Reminder sent to ${approverEmail} for ${transactionId}`);
    return true;

  } catch (err) {
    console.error(`❌ Failed to send reminder for ${transactionId}:`, err);
    return false;
  }
}

/**
 * Escalates a stale PENDING request to the Business Office.
 * Returns true on success.
 */
function _escalateToBO(transactionId, requestorEmail, type, amount, description) {
  try {
    const boEmail = CONFIG.BUSINESS_OFFICE_EMAIL;

    const approveUrl = generateApprovalUrl(transactionId, boEmail, "approve");
    const rejectUrl  = generateApprovalUrl(transactionId, boEmail, "reject");

    const amountFormatted = `$${amount.toFixed(2)}`;
    const subject = `🚨 ESCALATED: Request Awaiting Approval > 7 Days — ${transactionId}`;

    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #f9fafb; padding: 20px;">
        <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
          <div style="background: #c62828; padding: 28px 32px; text-align: center;">
            <div style="font-size: 36px; margin-bottom: 8px;">🚨</div>
            <h2 style="color: white; margin: 0; font-weight: 700; font-size: 20px;">Escalation Notice</h2>
            <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0 0; font-size: 14px;">This request has been waiting over 7 days without action. Business Office action required.</p>
          </div>
          <div style="padding: 32px;">
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
              <tr><td style="padding: 10px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #f3f4f6;">Transaction ID</td><td style="padding: 10px 0; font-weight: 600; text-align: right; border-bottom: 1px solid #f3f4f6;">${transactionId}</td></tr>
              <tr><td style="padding: 10px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #f3f4f6;">Request Type</td><td style="padding: 10px 0; font-weight: 600; text-align: right; border-bottom: 1px solid #f3f4f6;">${type}</td></tr>
              <tr><td style="padding: 10px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #f3f4f6;">Requested By</td><td style="padding: 10px 0; font-weight: 600; text-align: right; border-bottom: 1px solid #f3f4f6;">${requestorEmail}</td></tr>
              <tr><td style="padding: 10px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #f3f4f6;">Amount</td><td style="padding: 10px 0; font-weight: 700; font-size: 18px; color: #c62828; text-align: right; border-bottom: 1px solid #f3f4f6;">${amountFormatted}</td></tr>
              <tr><td style="padding: 10px 0; color: #6b7280; font-size: 14px;">Description</td><td style="padding: 10px 0; font-weight: 500; text-align: right;">${description}</td></tr>
            </table>
            <table style="width: 100%; border-collapse: separate; border-spacing: 12px;">
              <tr>
                <td style="width: 50%;"><a href="${approveUrl}" style="display: block; background: #19573B; color: white; padding: 14px 0; text-align: center; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 16px;">✓ Approve</a></td>
                <td style="width: 50%;"><a href="${rejectUrl}" style="display: block; background: white; color: #c62828; padding: 13px 0; text-align: center; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 16px; border: 2px solid #c62828;">✗ Deny</a></td>
              </tr>
            </table>
          </div>
          <div style="padding: 16px 32px; background: #f9fafb; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">Keswick Christian School · Budget Management System</p>
          </div>
        </div>
      </div>`;

    sendSystemEmail({ to: boEmail, subject: subject, htmlBody: htmlBody });

    logSystemEvent("APPROVAL_ESCALATED_TO_BO", boEmail, amount, {
      transactionId: transactionId,
      requestor: requestorEmail,
      reason: "No approver response after 7 days",
    });

    console.log(`🚨 Escalated ${transactionId} to BO (${boEmail})`);
    return true;

  } catch (err) {
    console.error(`❌ Failed to escalate ${transactionId}:`, err);
    return false;
  }
}
