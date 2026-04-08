function finalProductionCleanup() {
  console.log("Wiping all test data for production deployment...");
  // 1. Force a flush of any pending calculations
  SpreadsheetApp.flush();
  
  const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
  
  // 2. Clear TransactionLedger
  const ledger = budgetHub.getSheetByName('TransactionLedger');
  if (ledger && ledger.getLastRow() > 1) {
    ledger.getRange(2, 1, ledger.getLastRow() - 1, ledger.getLastColumn()).clearContent();
  }
  
  // 3. Clear AmazonApiLog and Hide it
  let amazonLog = budgetHub.getSheetByName('AmazonApiLog');
  if (amazonLog) {
    if (amazonLog.getLastRow() > 1) {
      amazonLog.getRange(2, 1, amazonLog.getLastRow() - 1, amazonLog.getLastColumn()).clearContent();
    }
    // Hide the tab entirely so it's out of sight
    amazonLog.hideSheet();
  }
  
  // 4. Force a budget recalculation which will trigger the sync logic 
  // to pull the latest Automated and Manual queues (which the user might have cleared in their sheets)
  // This will also naturally wipe Sync_Automated and Sync_Manual if the queues are empty!
  if (typeof forceBudgetRecalculation === 'function') {
    forceBudgetRecalculation();
  }
  
  return ContentService.createTextOutput("Production Cleanup Executed Successfully.");
}
