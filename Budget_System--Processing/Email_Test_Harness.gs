/**
 * ============================================================================
 * EMAIL TEST HARNESS
 * ============================================================================
 * Comprehensive testing of all 14+ email templates
 * Sends each email type to the test inbox for HTML rendering verification
 *
 * Run: testAllEmailTemplates() to send all emails
 * Or run individual test functions for specific templates
 * ============================================================================
 */

const TEST_EMAIL = 'invoicing@keswickchristian.org';

/**
 * Master test function - sends all email templates
 */
function testAllEmailTemplates() {
  console.log('========================================');
  console.log('EMAIL TEMPLATE TEST SUITE');
  console.log(`Sending to: ${TEST_EMAIL}`);
  console.log(`Started: ${new Date()}`);
  console.log('========================================');

  const results = [];

  // Test each email type with 2-second delay between emails
  results.push(test_01_EnhancedApprovalEmail());
  Utilities.sleep(2000);

  results.push(test_02_EmailReplyApprovalEmail());
  Utilities.sleep(2000);

  results.push(test_03_ApprovalConfirmation());
  Utilities.sleep(2000);

  results.push(test_04_ApprovalNotification());
  Utilities.sleep(2000);

  results.push(test_05_RejectionNotification());
  Utilities.sleep(2000);

  results.push(test_06_BusinessOfficeNotification());
  Utilities.sleep(2000);

  results.push(test_07_ErrorNotification());
  Utilities.sleep(2000);

  results.push(test_08_WarehouseValidationError());
  Utilities.sleep(2000);

  results.push(test_09_ValidationErrorEmail());
  Utilities.sleep(2000);

  results.push(test_10_ApprovalReminder());
  Utilities.sleep(2000);

  results.push(test_11_DailyErrorDigest());
  Utilities.sleep(2000);

  results.push(test_12_ResubmissionNotification());
  Utilities.sleep(2000);

  results.push(test_13_FiscalYearArchiveNotification());
  Utilities.sleep(2000);

  results.push(test_14_ClarificationEmail());
  Utilities.sleep(2000);

  results.push(test_15_ApprovalConfirmationToApprover());

  // Summary
  console.log('========================================');
  console.log('TEST SUMMARY');
  console.log('========================================');

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  results.forEach(r => {
    console.log(`${r.success ? '✅' : '❌'} ${r.name}: ${r.success ? 'SENT' : r.error}`);
  });

  console.log('----------------------------------------');
  console.log(`PASSED: ${passed}/${results.length}`);
  console.log(`FAILED: ${failed}/${results.length}`);
  console.log('========================================');
  console.log('Check Outlook inbox to verify HTML rendering');

  return results;
}

// ============================================================================
// INDIVIDUAL TEST FUNCTIONS
// ============================================================================

/**
 * Test 01: Enhanced Approval Email
 * Tests: Budget bar visualization, approve/reject buttons, school colors
 */
function test_01_EnhancedApprovalEmail() {
  const name = '01_Enhanced_Approval_Email';
  try {
    const testData = {
      transactionId: 'TEST-AMZ-2026-001',
      type: 'Amazon Order',
      amount: 275.50,
      requestor: 'teacher.test@keswickchristian.org',
      description: '[E2E TEST] Classroom supplies - markers, paper, and art materials for Science department',
      items: [
        { description: 'Expo Dry Erase Markers 12-pack', quantity: 3, unitPrice: 15.99, totalPrice: 47.97 },
        { description: 'Construction Paper 500 sheets', quantity: 5, unitPrice: 12.50, totalPrice: 62.50 },
        { description: 'Glue Sticks 24-pack', quantity: 2, unitPrice: 8.99, totalPrice: 17.98 },
        { description: 'Scissors Student Pack 12ct', quantity: 2, unitPrice: 24.99, totalPrice: 49.98 },
        { description: 'Colored Pencils 72-pack', quantity: 2, unitPrice: 48.54, totalPrice: 97.08 }
      ],
      pdfLink: 'https://drive.google.com/file/d/test123/view'
    };

    sendEnhancedApprovalEmail(TEST_EMAIL, testData);
    console.log(`✅ ${name}: Sent`);
    return { name, success: true };
  } catch (e) {
    console.error(`❌ ${name}: ${e.message}`);
    return { name, success: false, error: e.message };
  }
}

/**
 * Test 02: Edge Case - Missing unitPrice (Curriculum-style items)
 * Tests: Defensive price calculation when only totalPrice provided
 * This replaced the deprecated Email-Reply Approval test
 */
function test_02_EmailReplyApprovalEmail() {
  const name = '02_Missing_UnitPrice_EdgeCase';
  try {
    const testData = {
      transactionId: 'TEST-CUR-2026-002',
      type: 'Curriculum Request',
      amount: 250.00,
      requestor: 'teacher.test@keswickchristian.org',
      description: '[E2E TEST] Edge case: items WITHOUT unitPrice (defensive calc)',
      items: [
        { description: 'Textbook Set - NO unitPrice field', quantity: 5, totalPrice: 250.00 }
        // NOTE: No unitPrice - tests defensive calculation
      ]
    };

    sendEnhancedApprovalEmail(TEST_EMAIL, testData);
    console.log(`✅ ${name}: Sent - Check email renders correctly with calculated unitPrice`);
    return { name, success: true };
  } catch (e) {
    console.error(`❌ ${name}: ${e.message}`);
    return { name, success: false, error: e.message };
  }
}

/**
 * Test 03: Approval Confirmation (to requestor)
 * Tests: Budget status display, confirmation message
 */
function test_03_ApprovalConfirmation() {
  const name = '03_Approval_Confirmation';
  try {
    sendApprovalConfirmation(
      TEST_EMAIL,
      'TEST-AMZ-2026-003',
      150.00,
      '[E2E TEST] Approved classroom supplies order'
    );
    console.log(`✅ ${name}: Sent`);
    return { name, success: true };
  } catch (e) {
    console.error(`❌ ${name}: ${e.message}`);
    return { name, success: false, error: e.message };
  }
}

/**
 * Test 04: Approval Notification (detailed, to requestor)
 * Tests: Budget figures, next steps, order details
 */
function test_04_ApprovalNotification() {
  const name = '04_Approval_Notification';
  try {
    const transactionData = {
      transactionId: 'TEST-AMZ-2026-004',
      type: 'Amazon Order',
      amount: 325.00,
      approver: 'principal@keswickchristian.org',
      description: '[E2E TEST] Science lab equipment'
    };

    sendApprovalNotification(TEST_EMAIL, transactionData);
    console.log(`✅ ${name}: Sent`);
    return { name, success: true };
  } catch (e) {
    console.error(`❌ ${name}: ${e.message}`);
    return { name, success: false, error: e.message };
  }
}

/**
 * Test 05: Rejection Notification
 * Tests: Rejection styling, contact info, next steps
 */
function test_05_RejectionNotification() {
  const name = '05_Rejection_Notification';
  try {
    const transactionData = {
      transactionId: 'TEST-AMZ-2026-005',
      type: 'Amazon Order',
      amount: 500.00,
      approver: 'principal@keswickchristian.org',
      description: '[E2E TEST] Rejected order - test rejection notification'
    };

    sendRejectionNotification(TEST_EMAIL, transactionData);
    console.log(`✅ ${name}: Sent`);
    return { name, success: true };
  } catch (e) {
    console.error(`❌ ${name}: ${e.message}`);
    return { name, success: false, error: e.message };
  }
}

/**
 * Test 06: Business Office Notification
 * Tests: Summary format, all fields present
 */
function test_06_BusinessOfficeNotification() {
  const name = '06_Business_Office_Notification';
  try {
    sendBusinessOfficeNotification({
      type: 'Amazon Order Processing Complete',
      transactionId: 'TEST-AMZ-2026-006',
      requestor: 'teacher@keswickchristian.org',
      amount: 1250.00,
      description: '[E2E TEST] Batch of classroom supplies processed',
      justification: 'Required for Q3 Science curriculum'
    });
    console.log(`✅ ${name}: Sent`);
    return { name, success: true };
  } catch (e) {
    console.error(`❌ ${name}: ${e.message}`);
    return { name, success: false, error: e.message };
  }
}

/**
 * Test 07: Error Notification
 * Tests: Error styling, clear error message, next steps
 */
function test_07_ErrorNotification() {
  const name = '07_Error_Notification';
  try {
    sendErrorNotification(
      TEST_EMAIL,
      'TEST-AMZ-2026-007',
      'AMAZON',
      '[E2E TEST] Unable to validate Amazon URL - product no longer available'
    );
    console.log(`✅ ${name}: Sent`);
    return { name, success: true };
  } catch (e) {
    console.error(`❌ ${name}: ${e.message}`);
    return { name, success: false, error: e.message };
  }
}

/**
 * Test 08: Warehouse Validation Error
 * Tests: Item error list, warehouse-specific messaging
 */
function test_08_WarehouseValidationError() {
  const name = '08_Warehouse_Validation_Error';
  try {
    const errors = [
      { position: 1, itemId: 'PCW-999999', error: 'Item ID not found in warehouse catalog' },
      { position: 3, itemId: 'PCW-000001', error: 'Item discontinued - no longer available' },
      { position: 5, itemId: 'XYZ-12345', error: 'Invalid item ID format' }
    ];

    sendWarehouseValidationError(TEST_EMAIL, errors);
    console.log(`✅ ${name}: Sent`);
    return { name, success: true };
  } catch (e) {
    console.error(`❌ ${name}: ${e.message}`);
    return { name, success: false, error: e.message };
  }
}

/**
 * Test 09: Validation Error Email (Amazon)
 * Tests: Item table, URL display, resubmit button
 */
function test_09_ValidationErrorEmail() {
  const name = '09_Validation_Error_Email';
  try {
    const invalidItems = [
      { itemNumber: 1, description: 'Test Product A', url: 'https://amazon.com/invalid1', issue: 'Product page not accessible' },
      { itemNumber: 3, description: 'Test Product B', url: 'https://amazon.com/invalid2', issue: 'Price not available' }
    ];

    sendValidationErrorEmail(TEST_EMAIL, 'TEST-AMZ-2026-009', 'AMAZON', invalidItems);
    console.log(`✅ ${name}: Sent`);
    return { name, success: true };
  } catch (e) {
    console.error(`❌ ${name}: ${e.message}`);
    return { name, success: false, error: e.message };
  }
}

/**
 * Test 10: Approval Reminder
 * Tests: Age display, escalation styling (if >7 days), reminder urgency
 */
function test_10_ApprovalReminder() {
  const name = '10_Approval_Reminder';
  try {
    // Test standard reminder (3 days old)
    sendApprovalReminder({
      queueId: 'TEST-AMZ-2026-010A',
      requestor: 'teacher@keswickchristian.org',
      type: 'Amazon Order',
      amount: 200.00,
      age: 3
    });

    Utilities.sleep(1000);

    // Test escalated reminder (8 days old)
    sendApprovalReminder({
      queueId: 'TEST-AMZ-2026-010B',
      requestor: 'teacher@keswickchristian.org',
      type: 'Amazon Order',
      amount: 450.00,
      age: 8
    });

    console.log(`✅ ${name}: Sent (2 emails - standard + escalated)`);
    return { name, success: true };
  } catch (e) {
    console.error(`❌ ${name}: ${e.message}`);
    return { name, success: false, error: e.message };
  }
}

/**
 * Test 11: Daily Error Digest
 * Tests: Error grouping, table rendering, recommendations
 */
function test_11_DailyErrorDigest() {
  const name = '11_Daily_Error_Digest';
  try {
    const errors = [
      { type: 'FORM_VALIDATION', timestamp: new Date(), user: 'teacher1@kcs.org', message: 'Invalid Amazon URL format' },
      { type: 'FORM_VALIDATION', timestamp: new Date(), user: 'teacher2@kcs.org', message: 'Missing quantity field' },
      { type: 'BUDGET_ERROR', timestamp: new Date(), user: 'staff@kcs.org', message: 'Insufficient budget remaining' },
      { type: 'SYSTEM_ERROR', timestamp: new Date(), user: 'system', message: 'Trigger execution timeout' },
      { type: 'FORM_VALIDATION', timestamp: new Date(), user: 'teacher3@kcs.org', message: 'Invalid price format' }
    ];

    sendDailyErrorDigest(errors);
    console.log(`✅ ${name}: Sent`);
    return { name, success: true };
  } catch (e) {
    console.error(`❌ ${name}: ${e.message}`);
    return { name, success: false, error: e.message };
  }
}

/**
 * Test 12: Resubmission Notification
 * Tests: Resubmit link, original data display, error reason
 */
function test_12_ResubmissionNotification() {
  const name = '12_Resubmission_Notification';
  try {
    sendResubmissionNotification(
      TEST_EMAIL,
      'AMAZON',
      { amount: 125.00, description: 'Original classroom supplies order', items: 3 },
      '[E2E TEST] Amazon URL validation failed for item 2'
    );
    console.log(`✅ ${name}: Sent`);
    return { name, success: true };
  } catch (e) {
    console.error(`❌ ${name}: ${e.message}`);
    return { name, success: false, error: e.message };
  }
}

/**
 * Test 13: Fiscal Year Archive Notification
 * Tests: Archive summary, important notes, new year ready message
 */
function test_13_FiscalYearArchiveNotification() {
  const name = '13_Fiscal_Year_Archive';
  try {
    sendFiscalYearArchiveNotification({
      fiscalYear: 'FY2025',
      newFiscalYear: 'FY2026',
      transactionCount: 1247,
      totalAmount: 485632.50,
      archiveUrl: 'https://drive.google.com/folder/archive2025',
      backupCreated: true
    });
    console.log(`✅ ${name}: Sent`);
    return { name, success: true };
  } catch (e) {
    console.error(`❌ ${name}: ${e.message}`);
    return { name, success: false, error: e.message };
  }
}

/**
 * Test 14: Clarification Email (Email Approval System)
 * Tests: Unclear reply handling, clarification request
 */
function test_14_ClarificationEmail() {
  const name = '14_Clarification_Email';
  try {
    if (typeof sendClarificationEmail === 'function') {
      sendClarificationEmail(TEST_EMAIL, 'TEST-AMZ-2026-014');
      console.log(`✅ ${name}: Sent`);
      return { name, success: true };
    } else {
      console.warn(`⚠️ ${name}: Function not found - may need to load Email_Approval_System.gs`);
      return { name, success: false, error: 'Function not available' };
    }
  } catch (e) {
    console.error(`❌ ${name}: ${e.message}`);
    return { name, success: false, error: e.message };
  }
}

/**
 * Test 15: Approval Confirmation to Approver
 * Tests: Confirmation to the approver after decision processed
 */
function test_15_ApprovalConfirmationToApprover() {
  const name = '15_Approval_Confirmation_To_Approver';
  try {
    if (typeof sendApprovalConfirmationToApprover === 'function') {
      sendApprovalConfirmationToApprover(TEST_EMAIL, 'TEST-AMZ-2026-015', 'approve');
      console.log(`✅ ${name}: Sent`);
      return { name, success: true };
    } else {
      console.warn(`⚠️ ${name}: Function not found - may need to load Email_Approval_System.gs`);
      return { name, success: false, error: 'Function not available' };
    }
  } catch (e) {
    console.error(`❌ ${name}: ${e.message}`);
    return { name, success: false, error: e.message };
  }
}

// ============================================================================
// QUICK TEST FUNCTIONS (for individual debugging)
// ============================================================================

/**
 * Quick test - just sends the enhanced approval email
 */
function quickTestApprovalEmail() {
  test_01_EnhancedApprovalEmail();
}

/**
 * Quick test - sends the missing unitPrice edge case test
 */
function quickTestEdgeCaseMissingUnitPrice() {
  test_02_EmailReplyApprovalEmail();
}

/**
 * Quick SMTP provider test
 */
function testSMTPProvider() {
  console.log('Testing SMTP configuration...');
  if (typeof testEmailConfiguration === 'function') {
    testEmailConfiguration();
  } else {
    console.log('SMTP Config:');
    console.log('  ENABLED:', CONFIG.SMTP?.ENABLED);
    console.log('  PROVIDER:', CONFIG.SMTP?.PROVIDER);
    console.log('  FROM:', CONFIG.SMTP?.FROM_EMAIL);
  }
}

// ============================================================================
// EDGE CASE TESTS - Item Data Validation
// ============================================================================

/**
 * Test 16: Zero quantity edge case (division by zero prevention)
 * Tests: Field trip with 0 students - should not cause NaN/Infinity
 */
function test_16_ZeroQuantityEdgeCase() {
  const name = '16_Zero_Quantity';
  try {
    const testData = {
      transactionId: 'TEST-FT-2026-016',
      type: 'Field Trip Request',
      amount: 500.00,
      requestor: 'teacher.test@keswickchristian.org',
      description: '[E2E TEST] Edge case: ZERO quantity (div/0 prevention)',
      items: [
        { description: 'Field trip to Museum - ZERO students', quantity: 0, totalPrice: 500.00 }
        // Zero qty should NOT cause division by zero
      ]
    };

    sendEnhancedApprovalEmail(TEST_EMAIL, testData);
    console.log(`✅ ${name}: Sent - Check no NaN/Infinity in email`);
    return { name, success: true };
  } catch (e) {
    console.error(`❌ ${name}: ${e.message}`);
    return { name, success: false, error: e.message };
  }
}

/**
 * Test 17: NaN price values edge case
 * Tests: Invalid price strings should not break template
 */
function test_17_InvalidPriceEdgeCase() {
  const name = '17_Invalid_Prices';
  try {
    const testData = {
      transactionId: 'TEST-WH-2026-017',
      type: 'Warehouse Request',
      amount: 100.00,
      requestor: 'staff.test@keswickchristian.org',
      description: '[E2E TEST] Edge case: INVALID price values (NaN handling)',
      items: [
        { description: 'Office Supplies - invalid prices', quantity: 2, totalPrice: 'invalid', unitPrice: 'N/A' }
        // Invalid strings should be handled gracefully
      ]
    };

    sendEnhancedApprovalEmail(TEST_EMAIL, testData);
    console.log(`✅ ${name}: Sent - Check $0.00 displayed instead of NaN`);
    return { name, success: true };
  } catch (e) {
    console.error(`❌ ${name}: ${e.message}`);
    return { name, success: false, error: e.message };
  }
}

/**
 * Test 18: All 5 form types comparison test
 * Sends one email for each form type to verify consistent styling
 */
function test_18_AllFormTypesComparison() {
  const name = '18_All_Form_Types';
  console.log('📧 Sending comparison emails for all 5 form types...');

  const formTypes = [
    { type: 'Amazon Order', prefix: 'AMZ', items: [{ description: 'Amazon Item', quantity: 2, unitPrice: 25.00, totalPrice: 50.00 }] },
    { type: 'Warehouse Request', prefix: 'WH', items: [{ description: 'Warehouse Item', quantity: 3, unitPrice: 16.67, totalPrice: 50.00 }] },
    { type: 'Field Trip Request', prefix: 'FT', items: [{ description: 'Field Trip', quantity: 25, totalPrice: 50.00 }] }, // No unitPrice
    { type: 'Curriculum Request', prefix: 'CUR', items: [{ description: 'Curriculum Item', quantity: 5, totalPrice: 50.00 }] }, // No unitPrice
    { type: 'Admin Purchase', prefix: 'ADM', items: [{ description: 'Admin Item', quantity: 1, totalPrice: 50.00 }] } // No unitPrice
  ];

  try {
    formTypes.forEach((form, idx) => {
      sendEnhancedApprovalEmail(TEST_EMAIL, {
        transactionId: `TEST-${form.prefix}-2026-018${idx}`,
        type: form.type,
        amount: 50.00,
        requestor: 'teacher.test@keswickchristian.org',
        description: `[E2E TEST] ${form.type} - styling comparison`,
        items: form.items
      });
      console.log(`  ✅ ${form.type} sent`);
      Utilities.sleep(1000);
    });
    console.log(`✅ ${name}: All 5 emails sent - verify identical styling in Outlook`);
    return { name, success: true };
  } catch (e) {
    console.error(`❌ ${name}: ${e.message}`);
    return { name, success: false, error: e.message };
  }
}

/**
 * Quick edge case test runner
 */
function quickTestEdgeCases() {
  console.log('========================================');
  console.log('EDGE CASE TEST SUITE');
  console.log('========================================');

  const results = [];

  results.push(test_02_EmailReplyApprovalEmail()); // Missing unitPrice
  Utilities.sleep(2000);

  results.push(test_16_ZeroQuantityEdgeCase()); // Zero quantity
  Utilities.sleep(2000);

  results.push(test_17_InvalidPriceEdgeCase()); // Invalid prices
  Utilities.sleep(2000);

  results.push(test_18_AllFormTypesComparison()); // All form types

  // Summary
  console.log('========================================');
  console.log('EDGE CASE SUMMARY');
  console.log('========================================');
  const passed = results.filter(r => r.success).length;
  results.forEach(r => {
    console.log(`  ${r.success ? '✅' : '❌'} ${r.name}`);
  });
  console.log(`Total: ${passed}/${results.length} passed`);

  return results;
}
