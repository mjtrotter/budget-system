/**
 * ============================================================================
 * PHASE 2: APPROVAL WORKFLOW VERIFICATION
 * ============================================================================
 * Goal: Verify that the system correctly handles the "Approve" action.
 * 
 * Target Workflows:
 * 1. Field Trip
 * 2. Curriculum
 * 3. Admin
 * 
 * Expected Outcomes:
 * - Queue Status: PENDING -> APPROVED
 * - Budget: Encumbrance released, Spent increased (or strictly ledgered)
 * - Emails: Confirmation email sent (redirected to Admin)
 * - Ledger: Row added to TransactionLedger
 */

function runPhase2Verification() {
    console.log('🚀 === STARTING PHASE 2: APPROVAL VERIFICATION ===');
    const results = {
        passes: 0,
        fails: 0,
        details: []
    };

    // 1. Get Pending Requests from Manual Queue
    const pendingRequests = getPendingRequestsForTesting();
    console.log(`📋 Found ${pendingRequests.length} pending requests to test.`);

    if (pendingRequests.length === 0) {
        console.warn('⚠️ No pending requests found! runFullSystemSimulation() first?');
        return;
    }

    // 2. Process each request
    pendingRequests.forEach(request => {
        try {
            console.log(`\n⚙️ Processing Approval for ${request.id} (${request.type})...`);

            // Simulate "Approve" action by Admin
            const decisionResult = processApprovalDecision(
                request.id,
                CONFIG.ADMIN_EMAIL, // Acting as manager (Super Admin)
                'approve'
            );

            if (decisionResult.success && decisionResult.status === 'APPROVED') {
                // Verify ledger entry
                const ledgerVerified = verifyLedgerEntry(request.id);

                if (ledgerVerified) {
                    logResult(results, `Approval: ${request.type} (${request.id})`, { success: true });
                } else {
                    logResult(results, `Approval: ${request.type} (${request.id})`, {
                        success: false,
                        error: 'Ledger entry not found after approval'
                    });
                }
            } else {
                logResult(results, `Approval: ${request.type} (${request.id})`, {
                    success: false,
                    error: decisionResult.error || 'Unknown failure'
                });
            }

        } catch (e) {
            logResult(results, `Approval: ${request.type}`, { success: false, error: e.message });
        }
    });

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 PHASE 2 SUMMARY');
    console.log(`Passed: ${results.passes}`);
    console.log(`Failed: ${results.fails}`);
    console.log('='.repeat(50));
}

// Helper to find pending requests
function getPendingRequestsForTesting() {
    const hub = SpreadsheetApp.openById(CONFIG.MANUAL_HUB_ID);
    const sheet = hub.getSheetByName('ManualQueue');
    const data = sheet.getDataRange().getValues();
    const validTypes = ['FIELD_TRIP', 'CURRICULUM', 'ADMIN'];

    const pending = [];

    // Skip header, look for PENDING
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (row[7] === 'PENDING' && validTypes.includes(row[2])) {
            pending.push({
                id: row[0],
                type: row[2],
                requestor: row[1],
                amount: row[5]
            });
        }
    }

    // Limit to 3 (one of each type if possible, or just first 3)
    return pending.slice(0, 5);
}

// Helper to verify ledger
function verifyLedgerEntry(transactionId) {
    const hub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
    const ledger = hub.getSheetByName('TransactionLedger');
    const data = ledger.getDataRange().getValues();

    // Check column A (TransactionID)
    for (let i = 1; i < data.length; i++) {
        if (data[i][0] === transactionId) {
            console.log(`✅ Ledger confirmed: ${transactionId} -> OrderID: ${data[i][1]}`);
            return true;
        }
    }
    console.error(`❌ Ledger missing for ${transactionId}`);
    return false;
}
