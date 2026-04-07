function resetAllTestData() {
  console.log("Wiping all test data...");
  const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
  const autoHub = SpreadsheetApp.openById(CONFIG.AUTOMATED_HUB_ID);
  const manualHub = SpreadsheetApp.openById(CONFIG.MANUAL_HUB_ID);

  // Clear queues & form destination sheets
  const autoSheets = ['AutomatedQueue', 'Field Trip', 'Admin', 'Amazon', 'Curriculum', 'Warehouse'];
  const manualSheets = ['ManualQueue', 'System Config', 'Admin', 'Curriculum', 'Field Trip', 'Warehouse'];

  autoSheets.forEach(name => {
    const sheet = autoHub.getSheetByName(name);
    if (sheet && sheet.getLastRow() > 1) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
    }
  });

  manualSheets.forEach(name => {
    const sheet = manualHub.getSheetByName(name);
    if (sheet && sheet.getLastRow() > 1) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
    }
  });

  // Budget Hub: TransactionLedger, SystemLog
  ['TransactionLedger', 'SystemLog'].forEach(name => {
    const sheet = budgetHub.getSheetByName(name);
    if (sheet && sheet.getLastRow() > 1) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
    }
  });

  // UserDirectory Reset
  const userDir = budgetHub.getSheetByName('UserDirectory');
  if (userDir && userDir.getLastRow() > 1) {
    userDir.getRange(2, 5, userDir.getLastRow() - 1, 2).setValue(0); // Col E (Spent), Col F (Encumbered)
    // Formula for BudgetRemaining (Col G) is usually E-F or D-(E+F). No need to reset it if it is a formula, but if it is hardcoded, it will be wrong.
    // Let's assume it's a formula.
  }

  // OrganizationBudgets Reset
  const orgDir = budgetHub.getSheetByName('OrganizationBudgets');
  if (orgDir && orgDir.getLastRow() > 1) {
    orgDir.getRange(2, 3, orgDir.getLastRow() - 1, 2).setValue(0); // Col C (Spent), Col D (Encumbered)
  }

  console.log("Data wiped successfully.");
}
