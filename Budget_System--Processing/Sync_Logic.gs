
/**
 * ============================================================================
 * HUB MIRRORING (HIGH-SPEED BUDGET SYNC)
 * ============================================================================
 * Mirrors active queue items into the Budget Hub to enable local SUMIFS.
 * This eliminates cross-file formula lag and IMPORTRANGE dependency.
 */

function syncQueuesToBudgetHub() {
  console.log("🔄 Syncing Queue Mirrors to Budget Hub...");
  
  // 1. Sync Automated Queue (Amazon/Warehouse)
  try {
    const autoHub = SpreadsheetApp.openById(CONFIG.AUTOMATED_HUB_ID);
    const autoQueue = autoHub.getSheetByName("AutomatedQueue");
    const autoData = autoQueue.getDataRange().getValues();
    
    const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
    let syncAuto = budgetHub.getSheetByName("Sync_Automated");
    if (!syncAuto) {
      syncAuto = budgetHub.insertSheet("Sync_Automated");
      console.log("  Created Sync_Automated tab");
    }
    
    syncAuto.clear();
    if (autoData.length > 0) {
      syncAuto.getRange(1, 1, autoData.length, autoData[0].length).setValues(autoData);
    }
    console.log("  ✅ Automated Queue Mirrored");
  } catch (e) {
    console.error("  ❌ Mirror Fail (Auto):", e.message);
  }

  // 2. Sync Manual Queue (Field Trip/Curriculum/Admin)
  try {
    const manualHub = SpreadsheetApp.openById(CONFIG.MANUAL_HUB_ID);
    const manualQueue = manualHub.getSheetByName("ManualQueue");
    const manualData = manualQueue.getDataRange().getValues();
    
    const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
    let syncManual = budgetHub.getSheetByName("Sync_Manual");
    if (!syncManual) {
      syncManual = budgetHub.insertSheet("Sync_Manual");
      console.log("  Created Sync_Manual tab");
    }
    
    syncManual.clear();
    if (manualData.length > 0) {
      syncManual.getRange(1, 1, manualData.length, manualData[0].length).setValues(manualData);
    }
    console.log("  ✅ Manual Queue Mirrored");
  } catch (e) {
    console.error("  ❌ Mirror Fail (Manual):", e.message);
  }
  
  SpreadsheetApp.flush();
}

/**
 * REPLACEMENT: Forces a budget recalculation by flushing data and syncing mirrors.
 */
function forceBudgetRecalculation() {
  syncQueuesToBudgetHub();
  SpreadsheetApp.flush();
}
