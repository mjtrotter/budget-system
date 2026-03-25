/**
 * Utility to clean up the duplicate TransactionID columns created by the previous bug.
 * It consolidates all scattered IDs into the first TransactionID column and deletes the rest.
 */
function cleanupMessyTransactionColumns() {
  console.log('🚀 Starting Google Sheets column cleanup...');
  
  const hubs = [
    SpreadsheetApp.openById(CONFIG.MANUAL_HUB_ID),
    SpreadsheetApp.openById(CONFIG.AUTOMATED_HUB_ID)
  ];
  
  const targetSheets = ['Admin', 'Curriculum', 'Field Trip', 'Amazon', 'Warehouse'];
  
  for (const hub of hubs) {
    for (const sheetName of targetSheets) {
      const sheet = hub.getSheetByName(sheetName);
      if (!sheet) continue;
      
      const lastCol = sheet.getLastColumn();
      const lastRow = sheet.getLastRow();
      if (lastCol === 0 || lastRow === 0) continue;
      
      const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      const txColumns = [];
      
      // Find all TransactionID columns (1-indexed)
      for (let i = 0; i < headers.length; i++) {
        if (headers[i] === 'TransactionID') {
          txColumns.push(i + 1);
        }
      }
      
      if (txColumns.length <= 1) {
        console.log(`✅ ${sheetName} in ${hub.getName()} is clean.`);
        continue;
      }
      
      console.log(`⚠️ ${sheetName} has ${txColumns.length} TransactionID columns. Consolidating...`);
      
      const definitiveCol = txColumns[0];
      const extraCols = txColumns.slice(1);
      
      // Consolidate data into definitiveCol
      for (let row = 2; row <= lastRow; row++) {
        let finalVal = sheet.getRange(row, definitiveCol).getValue();
        
        for (const ec of extraCols) {
          const val = sheet.getRange(row, ec).getValue();
          if (val && !finalVal) {
            finalVal = val;
            sheet.getRange(row, definitiveCol).setValue(val);
          }
        }
      }
      
      // Delete extra columns from right to left to avoid index shifting issues
      for (let i = extraCols.length - 1; i >= 0; i--) {
        sheet.deleteColumn(extraCols[i]);
      }
      
      console.log(`🧹 ${sheetName} cleanup complete. Extra columns deleted.`);
    }
  }
  
  console.log('🎉 Full cleanup complete!');
}
