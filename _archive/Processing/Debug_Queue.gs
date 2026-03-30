/**
 * Debug function to check queue entries
 */
function debugCheckQueueEntries() {
  const autoHub = SpreadsheetApp.openById(CONFIG.AUTOMATED_HUB_ID);
  const sheets = autoHub.getSheets();

  console.log('=== SHEETS IN AUTOMATED HUB ===');
  sheets.forEach(function(sheet) {
    console.log('  - ' + sheet.getName());
  });

  console.log('\n=== CHECKING AutomatedQueue ===');
  const queue = autoHub.getSheetByName('AutomatedQueue');
  if (queue) {
    const data = queue.getDataRange().getValues();
    console.log('Total rows: ' + data.length);
    for (var i = 1; i < data.length; i++) {
      var txnId = data[i][0];
      var status = data[i][7];
      if (txnId && txnId.toString().startsWith('AMZ')) {
        console.log('  Row ' + (i+1) + ': ' + txnId + ' - Status: ' + status);
      }
    }
  } else {
    console.log('AutomatedQueue sheet NOT FOUND!');
  }

  console.log('\n=== CHECKING AmazonAutomatedQueue (if exists) ===');
  const oldQueue = autoHub.getSheetByName('AmazonAutomatedQueue');
  if (oldQueue) {
    var oldData = oldQueue.getDataRange().getValues();
    console.log('Total rows: ' + oldData.length);
    for (var j = 1; j < oldData.length; j++) {
      var oldTxnId = oldData[j][0];
      var oldStatus = oldData[j][7];
      if (oldTxnId) {
        console.log('  Row ' + (j+1) + ': ' + oldTxnId + ' - Status: ' + oldStatus);
      }
    }
  } else {
    console.log('AmazonAutomatedQueue sheet NOT FOUND (this is good!)');
  }

  return 'Debug complete - check execution logs';
}
