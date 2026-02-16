/**
 * ============================================================================
 * SIMULATION TESTS
 * ============================================================================
 * Simulates form submissions to verify system logic without manual entry.
 * Run `runFullSystemSimulation()` to execute all tests.
 */

// Configuration for simulations
const SIM_CONFIG = {
    TEST_USER_EMAIL: 'test.teacher@keswickchristian.org', // Must exist in User Directory (or will use default)
    TEST_APPROVER_EMAIL: 'test.principal@keswickchristian.org',
    TIMESTAMP: new Date()
};

/**
 * MASTER RUNNER
 */
function runFullSystemSimulation() {
    console.log('🚀 === STARTING FULL SYSTEM SIMULATION ===');
    const results = {
        passes: 0,
        fails: 0,
        details: []
    };

    // Ensure Test User exists (mock verification)
    verifyTestUserFromDirectory(SIM_CONFIG.TEST_USER_EMAIL);

    // 1. Warehouse Simulation
    try {
        console.log('\n📦 Simulating WAREHOUSE Workflow...');
        const result = simulateWarehouseForm();
        logResult(results, 'Warehouse Flow', result);
    } catch (e) {
        logResult(results, 'Warehouse Flow', { success: false, error: e.message });
    }

    // 2. Field Trip Simulation
    try {
        console.log('\n🚌 Simulating FIELD TRIP Workflow...');
        const result = simulateFieldTripForm();
        logResult(results, 'Field Trip Flow', result);
    } catch (e) {
        logResult(results, 'Field Trip Flow', { success: false, error: e.message });
    }

    // 3. Curriculum Simulation
    try {
        console.log('\n📚 Simulating CURRICULUM Workflow...');
        const result = simulateCurriculumForm();
        logResult(results, 'Curriculum Flow', result);
    } catch (e) {
        logResult(results, 'Curriculum Flow', { success: false, error: e.message });
    }

    // 4. Admin Simulation
    try {
        console.log('\n👔 Simulating ADMIN Workflow...');
        const result = simulateAdminForm();
        logResult(results, 'Admin Flow', result);
    } catch (e) {
        logResult(results, 'Admin Flow', { success: false, error: e.message });
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 SIMULATION SUMMARY');
    console.log(`Passed: ${results.passes}`);
    console.log(`Failed: ${results.fails}`);
    console.log('='.repeat(50));

    return results;
}

function logResult(results, name, result) {
    if (result.success) {
        console.log(`✅ ${name}: PASSED`);
        results.passes++;
    } else {
        console.error(`❌ ${name}: FAILED - ${result.error}`);
        results.fails++;
    }
    results.details.push({ name, ...result });
}

/**
 * HELPER: Verify Test User
 */
function verifyTestUserFromDirectory(email) {
    const user = getUserBudgetInfo(email);
    if (!user) {
        console.warn(`⚠️ Test user ${email} not found. Some tests might rely on default behaviors.`);
    } else {
        console.log(`ℹ️ Test User Verified: ${user.firstName} ${user.lastName} (Alloc: $${user.allocated})`);
    }
}

/**
 * 1. SIMULATE WAREHOUSE FORM
 * Strategy: Writes directly to the Linked Spreadsheet (since we can't mock FormApp.openById(id).getResponses() easily without intercepting).
 * Actually, Forms_Engine reads from the DESTINATION SHEET. So we populate the destination sheet.
 */
function simulateWarehouseForm() {
    // Warehouse Form Destination: Automated Hub -> 'Warehouse' sheet? NO.
    // Wait, let's check Forms_Engine.js: processWarehouseFormSubmission reads 'formResponsesSheet'.
    // It effectively searches for the LAST ROW with matching timestamp.

    // To simulate correctly, we must append a row to the actual linked sheet.
    // However, finding the linked sheet ID is dynamic.
    // config says: CONFIG.FORMS.WAREHOUSE linked to CONFIG.AUTOMATED_HUB_ID (Sheet 'Warehouse')?
    // Let's verify logic in Forms_Engine.
    // "const formResponsesSpreadsheet = SpreadsheetApp.openById(form.getDestinationId());"

    const form = FormApp.openById(CONFIG.FORMS.WAREHOUSE);
    const destId = form.getDestinationId();
    const ss = SpreadsheetApp.openById(destId);
    const sheet = ss.getSheets()[0]; // Usually the first sheet is responses

    const timestamp = new Date();
    const email = SIM_CONFIG.TEST_USER_EMAIL;

    // Construct Row Data (Indices based on Forms_Engine mapping)
    // Mapping: idCol: 2, qtyCol: 3, descCol: 17, priceCol: 18 (indices are 0-based in array, but 1-based in mapping? form engine uses values[index])
    // Forms_Engine uses: submissionRow[mapping.idCol] 
    // Let's look at mappings: { idCol: 2, qtyCol: 3, descCol: 17, priceCol: 18 } implying Column C, D... ? No arrays are 0-indexed.
    // submissionRow is `data[i]` where data is `getValues()`.

    const rowData = new Array(30).fill('');
    rowData[0] = timestamp;
    rowData[1] = email;

    // Item 1
    rowData[2] = 'TEST-ITEM-001'; // ID
    rowData[3] = 5;               // Qty
    rowData[17] = 'Simulated Pencils'; // Desc
    rowData[18] = 10.00;          // Total Price (Engine calcs unit price)

    rowData[27] = 10.00;          // Total Cost (Col AB is 27)

    // Append to sheet
    sheet.appendRow(rowData);
    console.log('📝 Appended simulated row to Warehouse Responses Sheet');

    // Trigger Processing
    // We need to mock the event object `e` passed to processWarehouseFormSubmission
    // The engine uses `e.response.getId()` mostly for logging.
    const mockEvent = {
        response: {
            getId: () => `SIM-WH-${Date.now()}`
        },
        source: form
    };

    // Call Processing
    console.log('⚙️ Invoking processWarehouseFormSubmission...');
    processWarehouseFormSubmission(mockEvent);

    // Verify
    return verifyTransactionCreated('WAREHOUSE', email, 10.00);
}

/**
 * 2. SIMULATE FIELD TRIP FORM
 * Logic: Reads from Manual Hub -> 'Field Trip' sheet
 */
function simulateFieldTripForm() {
    const hub = SpreadsheetApp.openById(CONFIG.MANUAL_HUB_ID);
    const sheet = hub.getSheetByName('Field Trip');

    const timestamp = new Date();
    const email = SIM_CONFIG.TEST_USER_EMAIL;
    const cost = 150.00;

    const rowData = new Array(10).fill('');
    rowData[0] = timestamp;
    rowData[1] = email;
    rowData[2] = 'Simulated Zoo Visit'; // Dest
    rowData[3] = new Date(new Date().getTime() + 86400000); // Date tomorrow
    rowData[4] = 25; // Students
    rowData[5] = 'Bus';
    rowData[6] = cost;

    sheet.appendRow(rowData);
    console.log('📝 Appended simulated row to Field Trip Sheet');

    const mockEvent = {
        response: { getId: () => `SIM-FT-${Date.now()}` }
    };

    console.log('⚙️ Invoking processFieldTripFormSubmission...');
    processFieldTripFormSubmission(mockEvent);

    return verifyTransactionCreated('FIELD_TRIP', email, cost);
}

/**
 * 3. SIMULATE CURRICULUM FORM
 * Logic: Reads from Manual Hub -> 'Curriculum' sheet
 */
function simulateCurriculumForm() {
    const hub = SpreadsheetApp.openById(CONFIG.MANUAL_HUB_ID);
    const sheet = hub.getSheetByName('Curriculum');

    const timestamp = new Date();
    const email = SIM_CONFIG.TEST_USER_EMAIL;
    const cost = 299.99;

    const rowData = new Array(10).fill('');
    rowData[0] = timestamp;
    rowData[1] = email;
    rowData[2] = 'Textbooks'; // Type
    rowData[4] = 'Advanced Physics 101'; // Resource Name
    rowData[7] = 20; // Qty
    rowData[8] = cost;

    sheet.appendRow(rowData);
    console.log('📝 Appended simulated row to Curriculum Sheet');

    const mockEvent = {
        response: { getId: () => `SIM-CI-${Date.now()}` }
    };

    console.log('⚙️ Invoking processCurriculumFormSubmission...');
    processCurriculumFormSubmission(mockEvent);

    return verifyTransactionCreated('CURRICULUM', email, cost);
}

/**
 * 4. SIMULATE ADMIN FORM
 * Logic: Reads from Manual Hub -> 'Admin' sheet
 */
function simulateAdminForm() {
    const hub = SpreadsheetApp.openById(CONFIG.MANUAL_HUB_ID);
    const sheet = hub.getSheetByName('Admin');

    const timestamp = new Date();
    const email = SIM_CONFIG.TEST_USER_EMAIL;
    const cost = 50.00;

    const rowData = new Array(10).fill('');
    rowData[0] = timestamp;
    rowData[1] = email;
    rowData[2] = 'Office Supplies'; // Desc
    rowData[3] = cost;

    sheet.appendRow(rowData);
    console.log('📝 Appended simulated row to Admin Sheet');

    const mockEvent = {
        response: { getId: () => `SIM-AD-${Date.now()}` }
    };

    console.log('⚙️ Invoking processAdminFormSubmission...');
    processAdminFormSubmission(mockEvent);

    return verifyTransactionCreated('ADMIN', email, cost);
}

/**
 * VERIFICATION HELPER
 * Checks if the request landed in the appropriate Queue with 'PENDING' or 'APPROVED' status.
 */
function verifyTransactionCreated(type, email, amount) {
    // Determine which queue to check
    const isAutomated = ['AMAZON', 'WAREHOUSE'].includes(type);
    const hubId = isAutomated ? CONFIG.AUTOMATED_HUB_ID : CONFIG.MANUAL_HUB_ID;
    const sheetName = isAutomated ? 'AutomatedQueue' : 'ManualQueue';

    const hub = SpreadsheetApp.openById(hubId);
    const queue = hub.getSheetByName(sheetName);
    const data = queue.getDataRange().getValues();

    // Look for the most recent entry matching our test
    // Iterate backwards
    for (let i = data.length - 1; i >= 1; i--) {
        const row = data[i];
        // Col 1: TransactionID, Col 2: Email, Col 3: Type, Col 6: Amount
        // Note: Amount might be string or float
        if (row[1] === email && row[2] === type) {
            // Check timing (within last minute)
            const rowTime = new Date(row[8]); // Timestamp col
            const now = new Date();
            if (now - rowTime < 60000) {
                // Found it
                console.log(`✅ Verified Transaction: ${row[0]} | Status: ${row[7]}`);

                const almostEqual = Math.abs(parseFloat(row[5]) - amount) < 0.01;
                if (!almostEqual) {
                    return { success: false, error: `Amount mismatch. Expected ${amount}, got ${row[5]}` };
                }

                return { success: true, transactionId: row[0] };
            }
        }
    }

    return { success: false, error: 'Transaction not found in Queue' };
}
