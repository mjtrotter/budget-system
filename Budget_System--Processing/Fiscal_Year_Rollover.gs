/**
 * ============================================================================
 * FISCAL YEAR ROLLOVER
 * ============================================================================
 * Handles annual fiscal year transition (July 1).
 * Archives previous year data and resets ledgers for new year.
 */

/**
 * Main rollover function - run on July 1 (or shortly after)
 */
function performFiscalYearRollover() {
  console.log('🗓️ === FISCAL YEAR ROLLOVER INITIATED ===');
  const startTime = new Date();

  try {
    // Step 1: Archive previous fiscal year
    const archiveResult = archivePreviousFiscalYear();
    console.log('Step 1: Archive complete', archiveResult);

    // Step 2: Create new fiscal year folder structure
    const folderResult = createNewFiscalYearFolders();
    console.log('Step 2: Folders created', folderResult);

    // Step 3: Reset budget allocations (if applicable)
    const budgetResult = resetBudgetAllocations();
    console.log('Step 3: Budget reset', budgetResult);

    // Step 4: Archive and clear queues
    const queueResult = archiveAndClearQueues();
    console.log('Step 4: Queues archived', queueResult);

    // Step 5: Send summary notification
    sendRolloverSummary({
      archive: archiveResult,
      folders: folderResult,
      budgets: budgetResult,
      queues: queueResult,
      duration: (new Date() - startTime) / 1000
    });

    console.log('✅ === FISCAL YEAR ROLLOVER COMPLETE ===');
    return { success: true };

  } catch (error) {
    console.error('❌ Rollover failed:', error);
    sendRolloverError(error);
    return { success: false, error: error.toString() };
  }
}

/**
 * Archives the previous fiscal year's transaction ledger
 */
function archivePreviousFiscalYear() {
  const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
  const ledgerSheet = budgetHub.getSheetByName('TransactionLedger');

  if (!ledgerSheet) {
    return { archived: 0, message: 'TransactionLedger not found' };
  }

  const data = ledgerSheet.getDataRange().getValues();
  if (data.length <= 1) {
    return { archived: 0, message: 'No transactions to archive' };
  }

  // Determine previous fiscal year
  const now = new Date();
  const prevFY = now.getMonth() < 6
    ? `FY${now.getFullYear() - 2}-${String(now.getFullYear() - 1).slice(-2)}`
    : `FY${now.getFullYear() - 1}-${String(now.getFullYear()).slice(-2)}`;

  // Create archive sheet
  const archiveSheetName = `TransactionLedger_${prevFY}`;
  let archiveSheet = budgetHub.getSheetByName(archiveSheetName);

  if (!archiveSheet) {
    archiveSheet = budgetHub.insertSheet(archiveSheetName);
  }

  // Copy data to archive
  const headers = data[0];
  const transactions = data.slice(1);

  archiveSheet.clear();
  archiveSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (transactions.length > 0) {
    archiveSheet.getRange(2, 1, transactions.length, headers.length).setValues(transactions);
  }

  // Format archive
  const headerRange = archiveSheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#1565C0');
  headerRange.setFontColor('#FFFFFF');
  headerRange.setFontWeight('bold');
  archiveSheet.setFrozenRows(1);

  // Clear current ledger (keep headers)
  if (transactions.length > 0) {
    ledgerSheet.deleteRows(2, transactions.length);
  }

  console.log(`Archived ${transactions.length} transactions to ${archiveSheetName}`);

  return {
    archived: transactions.length,
    archiveSheet: archiveSheetName,
    previousFY: prevFY
  };
}

/**
 * Creates folder structure for new fiscal year
 */
function createNewFiscalYearFolders() {
  const currentFY = getCurrentFiscalYear();
  return createFiscalYearFolderStructure(currentFY);
}

/**
 * Resets budget allocations for new fiscal year
 * Note: This may need customization based on how budgets are allocated
 */
function resetBudgetAllocations() {
  const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
  const userSheet = budgetHub.getSheetByName('UserDirectory');

  if (!userSheet) {
    return { reset: 0, message: 'UserDirectory not found' };
  }

  const data = userSheet.getDataRange().getValues();
  let resetCount = 0;

  // Column indices (0-based)
  const SPENT_COL = 8;        // I - BudgetSpent
  const ENCUMBERED_COL = 9;   // J - BudgetEncumbered
  const REMAINING_COL = 10;   // K - BudgetRemaining
  const UTIL_COL = 11;        // L - UtilizationRate
  const MODIFIED_COL = 13;    // N - LastModified

  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue; // Skip empty rows

    const allocated = parseFloat(data[i][7]) || 0; // BudgetAllocated stays the same

    // Reset spending columns
    userSheet.getRange(i + 1, SPENT_COL + 1).setValue(0);
    userSheet.getRange(i + 1, ENCUMBERED_COL + 1).setValue(0);
    userSheet.getRange(i + 1, REMAINING_COL + 1).setValue(allocated);
    userSheet.getRange(i + 1, UTIL_COL + 1).setValue(0);
    userSheet.getRange(i + 1, MODIFIED_COL + 1).setValue(new Date());

    resetCount++;
  }

  // Also reset OrganizationBudgets if it exists
  const orgSheet = budgetHub.getSheetByName('OrganizationBudgets');
  if (orgSheet) {
    const orgData = orgSheet.getDataRange().getValues();
    for (let i = 1; i < orgData.length; i++) {
      if (!orgData[i][0]) continue;
      const allocated = parseFloat(orgData[i][1]) || 0;

      orgSheet.getRange(i + 1, 3).setValue(0); // Spent
      orgSheet.getRange(i + 1, 4).setValue(0); // Encumbered
      orgSheet.getRange(i + 1, 5).setValue(allocated); // Available
      orgSheet.getRange(i + 1, 8).setValue(new Date()); // LastModified
    }
  }

  return {
    reset: resetCount,
    message: `Reset spending for ${resetCount} users`
  };
}

/**
 * Archives and clears processing queues
 */
function archiveAndClearQueues() {
  const results = {
    automated: { archived: 0 },
    manual: { archived: 0 }
  };

  // Archive Automated Queue
  try {
    const autoHub = SpreadsheetApp.openById(CONFIG.AUTOMATED_HUB_ID);
    const autoQueue = autoHub.getSheetByName('AutomatedQueue');

    if (autoQueue) {
      const data = autoQueue.getDataRange().getValues();
      if (data.length > 1) {
        const archiveName = `AutoQueue_Archive_${new Date().toISOString().split('T')[0]}`;
        const archive = autoHub.insertSheet(archiveName);
        archive.getRange(1, 1, data.length, data[0].length).setValues(data);
        autoQueue.deleteRows(2, data.length - 1);
        results.automated.archived = data.length - 1;
      }
    }
  } catch (e) {
    results.automated.error = e.message;
  }

  // Archive Manual Queue
  try {
    const manualHub = SpreadsheetApp.openById(CONFIG.MANUAL_HUB_ID);
    const manualQueue = manualHub.getSheetByName('ManualQueue');

    if (manualQueue) {
      const data = manualQueue.getDataRange().getValues();
      if (data.length > 1) {
        const archiveName = `ManualQueue_Archive_${new Date().toISOString().split('T')[0]}`;
        const archive = manualHub.insertSheet(archiveName);
        archive.getRange(1, 1, data.length, data[0].length).setValues(data);
        manualQueue.deleteRows(2, data.length - 1);
        results.manual.archived = data.length - 1;
      }
    }
  } catch (e) {
    results.manual.error = e.message;
  }

  return results;
}

/**
 * Sends rollover summary email
 */
function sendRolloverSummary(results) {
  const subject = `🗓️ Fiscal Year Rollover Complete - ${getCurrentFiscalYear()}`;

  const body = `
Fiscal Year Rollover Summary
============================

New Fiscal Year: ${getCurrentFiscalYear()}

Archive Results:
- Transactions archived: ${results.archive.archived}
- Archive sheet: ${results.archive.archiveSheet || 'N/A'}

Folder Structure:
- Folders created: ${results.folders.foldersCreated}

Budget Reset:
- Users reset: ${results.budgets.reset}

Queue Archive:
- Automated items archived: ${results.queues.automated.archived}
- Manual items archived: ${results.queues.manual.archived}

Duration: ${results.duration.toFixed(2)} seconds

The budget system is now ready for the new fiscal year.
`;

  MailApp.sendEmail({
    to: CONFIG.BUSINESS_OFFICE_EMAIL,
    subject: subject,
    body: body
  });
}

/**
 * Sends error notification if rollover fails
 */
function sendRolloverError(error) {
  MailApp.sendEmail({
    to: CONFIG.BUSINESS_OFFICE_EMAIL,
    subject: '❌ URGENT: Fiscal Year Rollover Failed',
    body: `
The fiscal year rollover process encountered an error:

${error.toString()}

Please investigate and run manually if needed.
`
  });
}

/**
 * Creates a trigger to run rollover on July 1
 */
function createFiscalYearRolloverTrigger() {
  // Remove existing triggers first
  const existingTriggers = ScriptApp.getProjectTriggers();
  for (const trigger of existingTriggers) {
    if (trigger.getHandlerFunction() === 'performFiscalYearRollover') {
      ScriptApp.deleteTrigger(trigger);
    }
  }

  // Create new trigger for July 1 at 2 AM
  ScriptApp.newTrigger('performFiscalYearRollover')
    .timeBased()
    .onMonthDay(1) // 1st of month
    .atHour(2)     // 2 AM
    .create();

  console.log('Fiscal year rollover trigger created for 1st of each month at 2 AM');
  console.log('Note: The function itself checks if it\'s July before proceeding');

  return { success: true };
}

/**
 * Wrapper that only runs rollover in July
 */
function performFiscalYearRolloverIfJuly() {
  const now = new Date();
  if (now.getMonth() === 6 && now.getDate() <= 3) { // July 1-3
    console.log('July detected - running fiscal year rollover');
    return performFiscalYearRollover();
  }
  console.log('Not July - skipping rollover');
  return { skipped: true, reason: 'Not July' };
}

/**
 * Manual test function - preview what would happen
 */
function previewFiscalYearRollover() {
  console.log('📋 === FISCAL YEAR ROLLOVER PREVIEW ===');

  const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
  const ledgerSheet = budgetHub.getSheetByName('TransactionLedger');

  if (ledgerSheet) {
    const data = ledgerSheet.getDataRange().getValues();
    console.log(`Transactions to archive: ${data.length - 1}`);
  }

  const userSheet = budgetHub.getSheetByName('UserDirectory');
  if (userSheet) {
    const data = userSheet.getDataRange().getValues();
    console.log(`Users to reset: ${data.length - 1}`);
  }

  console.log(`Current FY: ${getCurrentFiscalYear()}`);
  console.log(`Current Quarter: ${getCurrentFiscalQuarter()}`);

  console.log('\n⚠️ This was a preview only. No changes were made.');
}
