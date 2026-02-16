
/**
 * TRUE E2E SIMULATION
 * Simulates the entire lifecycle of a request:
 * 1. Form Submission (Simulated Event)
 * 2. Approval (Simulated User Action)
 * 3. Operational Processing (Amazon/Warehouse)
 * 4. Invoicing (Nightly Batch)
 */
function testTrueE2ELifecycle() {
    console.log('🚀 STARING TRUE E2E SIMULATION...');

    const timestamp = new Date().getTime();
    const testEmail = CONFIG.TEST_EMAIL || 'test@example.com';
    const testItem = `E2E Test Item ${timestamp}`;
    const testAmount = 50.00;

    // =================================================================
    // STEP 1: SUBMIT FORM
    // =================================================================
    console.log('\n📝 STEP 1: Simulating Form Submission (Amazon)...');

    // Directly append to Amazon sheet to simulate form submit
    const autoHub = SpreadsheetApp.openById(CONFIG.AUTOMATED_HUB_ID);
    const amazonSheet = autoHub.getSheetByName('Amazon');

    const validUrl = 'https://www.amazon.com/dp/B08N5KWB9H'; // Real ASIN for scraper testing

    amazonSheet.appendRow([
        new Date(), testEmail,
        'Test Item', validUrl, 1, 25.00, // Item 1
        'Test Item 2', validUrl, 1, 25.00, // Item 2
        '', '', '', '', '', '', '', '', '', '', '', // Empty slots
        '', '',
        50.00, // Total
        ''  // Transaction ID (Empty)
    ]);

    // Manually trigger the processor
    // We need to mock the event object properly or just direct call logic if we extracted it.
    // processAmazonFormSubmission reads the LAST row.

    const mockEvent = {
        response: {
            getId: () => `RESP-${timestamp}`
        }
    };

    try {
        processAmazonFormSubmission(mockEvent);
        console.log('✅ Form processed.');
    } catch (e) {
        console.error('❌ Form processing failed:', e);
        return;
    }

    // Verify Queue
    const queueSheet = autoHub.getSheetByName('AutomatedQueue');
    const lastRow = queueSheet.getLastRow();
    const queueData = queueSheet.getRange(lastRow, 1, 1, 12).getValues()[0];
    const transactionId = queueData[0];
    const status = queueData[7];

    if (status !== 'PENDING' && status !== 'APPROVED') {
        console.error(`❌ Queue status mismatch: ${status}`);
        return;
    }
    console.log(`✅ Transaction created: ${transactionId} [${status}]`);

    // =================================================================
    // STEP 2: APPROVE (If needed)
    // =================================================================
    if (status === 'PENDING') {
        console.log('\n👍 STEP 2: Simulating Approval...');
        const result = processApprovalDecision(transactionId, CONFIG.ADMIN_EMAIL, 'approve');
        if (!result.success) {
            console.error('❌ Approval failed:', result.error);
            return;
        }
        console.log('✅ Request Approved.');
    }

    // =================================================================
    // STEP 3: AMAZON WORKFLOW
    // =================================================================
    console.log('\n📦 STEP 3: Running Amazon Workflow...');

    // Force execution
    const engine = new AmazonWorkflowEngine();
    // Mock time check or use force flag
    const wfResult = engine.executeAmazonWorkflow(true);

    // Note: executeAmazonWorkflow is async or returns promise in some contexts? 
    // In Apps Script generic JS, it's synchronous unless verification uses UrlFetch.
    // Wait, executeAmazonWorkflow implementation in verify view was async?
    // Apps Script runtime is synchronous mostly. The keyword `async` is supported but runs synchronously-ish.
    // However, we need to check the result.

    // Check Ledger for this transaction
    const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
    const ledgerSheet = budgetHub.getSheetByName('TransactionLedger');
    const ledgerData = ledgerSheet.getDataRange().getValues();

    const ledgerEntry = ledgerData.find(row => row[0] === transactionId);

    if (!ledgerEntry) {
        console.error('❌ Transaction NOT found in Ledger after Amazon Workflow.');
        // Check if it's still in queue as APPROVED (e.g. scraper failed?)
        return;
    }
    console.log(`✅ Transaction in Ledger: ${ledgerEntry[1]} (Order ID)`);

    // =================================================================
    // STEP 4: INVOICING
    // =================================================================
    console.log('\n🧾 STEP 4: Running Nightly Invoicing...');

    // Force Test Mode to bypass schedule check
    const originalTestMode = CONFIG.TEST_MODE;
    CONFIG.TEST_MODE = true;

    runNightlyInvoiceBatch();

    CONFIG.TEST_MODE = originalTestMode; // Restore

    // Verify Ledger Update (Invoice Link)
    const updatedLedgerData = ledgerSheet.getDataRange().getValues();
    const updatedEntry = updatedLedgerData.find(row => row[0] === transactionId);
    const invoiceLink = updatedEntry[10];

    if (invoiceLink && invoiceLink.includes('drive.google.com')) {
        console.log(`✅ Invoice Generated: ${invoiceLink}`);
        console.log('🎉 TRUE E2E TEST PASSED!');
    } else {
        console.error('❌ Invoice Link missing in Ledger.');
    }
}
