/**
 * ============================================================================
 * PHASE 4: INVOICE GENERATION & PAGINATION VERIFICATION
 * ============================================================================
 * Goal: Verify that the Invoicing Engine correctly formats PDFs, especially
 * handling long lists of items that require pagination.
 */

function runPhase4Verification() {
    console.log('🚀 === STARTING PHASE 4: INVOICE VERIFICATION ===');

    // 1. Generate Mock Data (Massive list to force pagination)
    const mockTransactions = generateMockTransactions(45); // 45 items should span ~2 pages

    const metadata = {
        batchId: `TEST-INV-${Date.now()}`,
        pexTag: 'PEX-BATCH-001',
        totalAmount: mockTransactions.reduce((sum, item) => sum + item.amount, 0)
    };

    console.log(`📋 Generated ${mockTransactions.length} mock transactions.`);
    console.log(`💰 Total Value: $${metadata.totalAmount.toFixed(2)}`);

    // 2. Call Engine
    try {
        const engine = new InvoicingEngine(); // Using the globa class
        const result = engine.generateInvoice(mockTransactions, metadata);

        if (result.success) {
            console.log('✅ PDF Generation Successful!');
            console.log(`📂 File ID: ${result.fileId}`);
            console.log(`🔗 PDF URL: ${result.fileUrl}`);
            console.log('\n👉 ACTION REQUIRED: Click the URL above to inspect the PDF layout via browser.');
        } else {
            console.error(`❌ PDF Generation Failed: ${result.error}`);
        }

    } catch (e) {
        console.error('❌ Phase 4 Execution Error:', e);
    }
}

function inspectInvoiceHtml() {
    console.log('🔍 === INSPECTING INVOICE HTML ===');
    const mockTransactions = generateMockTransactions(45);
    const metadata = { batchId: 'DEBUG-TEST', pexTag: 'DEBUG', totalAmount: 1000 };

    const engine = new InvoicingEngine();
    const result = engine.generateInvoice(mockTransactions, metadata, true); // Debug mode

    if (result.html) {
        const html = result.html;

        // Check 1: Pagination CSS
        const hasPagination = html.includes('page-break-inside: avoid');
        console.log(`Test 1 (Pagination CSS): ${hasPagination ? '✅ PASSED' : '❌ FAILED'}`);

        // Check 2: Row Count
        const rowMatches = html.match(/<tr class="item-row">/g);
        const rowCount = rowMatches ? rowMatches.length : 0;
        console.log(`Test 2 (Item Count): ${rowCount === 45 ? '✅ PASSED' : '❌ FAILED'} (Found ${rowCount}/45)`);

        // Check 3: Grouping
        const groups = html.match(/<tr class="dept-header">/g);
        console.log(`Test 3 (Dept Grouping): ${groups && groups.length > 0 ? '✅ PASSED' : '❌ FAILED'} (Found ${groups ? groups.length : 0} groups)`);

        if (hasPagination && rowCount === 45 && groups) {
            console.log('🏆 HTML STRUCTURE VERIFIED');
        } else {
            console.error('⚠️ HTML INSPECTION FAILED');
        }
    }
}

function generateMockTransactions(count) {
    const depts = ['Science', 'Math', 'English', 'Athletics', 'Administration'];
    const items = [];

    for (let i = 1; i <= count; i++) {
        const dept = depts[i % depts.length];
        items.push({
            date: new Date().toISOString(),
            transactionId: `TXN-${1000 + i}`,
            requestor: `teacher${i}@keswickchristian.org`,
            department: dept,
            description: `Amazon Item #${i} - Educational Supplies for ${dept} curriculum`,
            budgetCode: `10-${dept.substring(0, 3).toUpperCase()}-500`,
            amount: (Math.random() * 50) + 10 // Random $10-$60
        });
    }

    // Sort by department to test grouping
    return items.sort((a, b) => a.department.localeCompare(b.department));
}
