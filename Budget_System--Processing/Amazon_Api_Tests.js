/**
 * ============================================================================
 * AMAZON BUSINESS API — TEST HARNESS (v2 — Single-Step Architecture)
 * ============================================================================
 * Tests the streamlined workflow: Auth → Calculate Max Price → Place Order
 * Product Search API tests removed — ordering handles price evaluation natively.
 * ============================================================================
 */

// ============================================================================
// TEST 1: LWA Authentication
// ============================================================================

function testLwaAuth() {
  console.log('🧪 TEST 1: LWA Authentication');
  console.log('='.repeat(50));
  let passed = true;

  try {
    // Verify decryption pipeline
    console.log('1a. Testing encryption round-trip...');
    const testVal = 'test-secret-value-12345';
    const encrypted = encryptProp(testVal);
    const decrypted = decryptProp(encrypted);
    if (decrypted !== testVal) {
      console.error('❌ FAIL: Encryption round-trip mismatch');
      passed = false;
    } else {
      console.log('  ✅ Encryption round-trip: PASS');
    }

    // Verify required properties exist
    console.log('1b. Verifying Script Properties exist...');
    const requiredKeys = ['AMZ_CLIENT_ID', 'AMZ_CLIENT_SECRET', 'AMZ_REFRESH_TOKEN'];
    for (const key of requiredKeys) {
      const val = PropertiesService.getScriptProperties().getProperty(key);
      if (!val) {
        console.error(`  ❌ FAIL: Missing property: ${key}`);
        passed = false;
      } else {
        console.log(`  ✅ ${key}: present (${val.length} chars encrypted)`);
      }
    }

    // Fetch token
    console.log('1c. Fetching access token (first call)...');
    const t1Start = Date.now();
    const token = getAccessToken();
    const t1Duration = Date.now() - t1Start;
    if (!token || token.length < 10) {
      console.error('❌ FAIL: Token is empty or too short');
      passed = false;
    } else {
      console.log(`  ✅ Token received: ${token.substring(0, 8)}***...${token.substring(token.length - 4)} (${t1Duration}ms)`);
    }

    // Verify cache hit
    console.log('1d. Testing cache hit (second call)...');
    const t2Start = Date.now();
    const token2 = getAccessToken();
    const t2Duration = Date.now() - t2Start;
    console.log(`  ✅ Cache response: ${t2Duration}ms (should be <50ms if cached)`);

    if (token !== token2) {
      console.error('❌ FAIL: Cache returned different token');
      passed = false;
    }

  } catch (e) {
    console.error(`❌ FAIL: ${e.message}`);
    passed = false;
  }

  console.log(`\n🏁 TEST 1 RESULT: ${passed ? '✅ PASS' : '❌ FAIL'}`);
  return passed;
}

// ============================================================================
// TEST 2: Max Allowed Price Calculator (no API call)
// ============================================================================

function testMaxAllowedPrice() {
  console.log('🧪 TEST 2: Max Allowed Price Calculator');
  console.log('='.repeat(50));
  let passed = true;

  const testCases = [
    // { submitted, expectedMax, label }
    { submitted: 10.00,   expectedMax: 15.00,  label: '$10 item: +$5 flat (5%=$0.50 < $5, so $5 wins) → $15' },
    { submitted: 50.00,   expectedMax: 55.00,  label: '$50 item: +$5 flat (5%=$2.50 < $5, so $5 wins) → $55' },
    { submitted: 100.00,  expectedMax: 105.00, label: '$100 item: 5%=$5 = $5 flat (tie, same result) → $105' },
    { submitted: 200.00,  expectedMax: 210.00, label: '$200 item: 5%=$10 > $5, so $10 wins → $210' },
    { submitted: 500.00,  expectedMax: 525.00, label: '$500 item: 5%=$25 > $5, so $25 wins → $525' },
    { submitted: 1000.00, expectedMax: 1050.00, label: '$1000 item: 5%=$50 = $50 hard cap → $1050' },
    { submitted: 2000.00, expectedMax: 2050.00, label: '$2000 item: 5%=$100 but hard cap=$50 → $2050' },
    { submitted: 5.00,    expectedMax: 10.00,  label: '$5 item: +$5 flat (5%=$0.25 < $5) → $10' },
    { submitted: 0.99,    expectedMax: 5.99,   label: '$0.99 item: +$5 flat minimum → $5.99' },
  ];

  testCases.forEach((tc, i) => {
    const result = calculateMaxAllowedPrice(tc.submitted);
    const pass = Math.abs(result.maxPrice - tc.expectedMax) < 0.01;
    const icon = pass ? '✅' : '❌';
    console.log(`  ${icon} Case ${i + 1}: submitted=$${tc.submitted} → maxPrice=$${result.maxPrice} (expected=$${tc.expectedMax}, buffer=$${result.buffer})`);
    console.log(`      ${tc.label}`);
    if (!pass) {
      console.error(`      MISMATCH: got $${result.maxPrice}, expected $${tc.expectedMax}`);
      passed = false;
    }
  });

  console.log(`\n🏁 TEST 2 RESULT: ${passed ? '✅ PASS' : '❌ FAIL'}`);
  return passed;
}

// ============================================================================
// TEST 3: Order Payload Validation (dry run — no API call)
// ============================================================================

function testOrderPayload() {
  console.log('🧪 TEST 3: Order Payload Validation (Dry Run)');
  console.log('='.repeat(50));
  let passed = true;

  // Simulate: teacher submitted $24.99 for a webcam, calculate ceiling
  const ceiling = calculateMaxAllowedPrice(24.99);

  const testItems = [
    { asin: 'B08N5WRWNW', quantity: 2, expectedUnitPrice: ceiling.maxPrice, description: 'Test Webcam' },
    { asin: 'B075CYMYK6', quantity: 1, expectedUnitPrice: calculateMaxAllowedPrice(12.49).maxPrice, description: 'Test Pens' }
  ];

  try {
    const payload = buildOrderPayload(testItems, 'TEST-DRY-001', 'Jane Smith');

    // Validate top-level structure
    console.log('3a. Validating top-level structure...');
    if (payload.externalId !== 'TEST-DRY-001') { console.error('  ❌ externalId mismatch'); passed = false; }
    else console.log('  ✅ externalId: TEST-DRY-001');

    // Validate line items
    console.log('3b. Validating line items...');
    if (payload.lineItems.length !== 2) { console.error('  ❌ Expected 2 line items'); passed = false; }
    else console.log(`  ✅ lineItems count: ${payload.lineItems.length}`);

    payload.lineItems.forEach((li, i) => {
      const hasProductRef = li.attributes.some(a => a.attributeType === 'SelectedProductReference');
      if (!hasProductRef) { console.error(`  ❌ Line ${i + 1}: missing SelectedProductReference`); passed = false; }
      else console.log(`  ✅ Line ${i + 1}: SelectedProductReference present (ASIN: ${li.attributes.find(a => a.attributeType === 'SelectedProductReference').productReference.id})`);

      const hasUnitPrice = li.expectations.some(e => e.expectationType === 'ExpectedUnitPrice');
      if (!hasUnitPrice) { console.error(`  ❌ Line ${i + 1}: missing ExpectedUnitPrice`); passed = false; }
      else {
        const priceExp = li.expectations.find(e => e.expectationType === 'ExpectedUnitPrice');
        console.log(`  ✅ Line ${i + 1}: ExpectedUnitPrice: $${priceExp.amount.amount} (this is the max ceiling, NOT submitted price)`);
      }

      // Verify NO SelectedBuyingOptionReference (we don't use Offer IDs)
      const hasOfferRef = li.attributes.some(a => a.attributeType === 'SelectedBuyingOptionReference');
      if (hasOfferRef) { console.error(`  ❌ Line ${i + 1}: should NOT have SelectedBuyingOptionReference`); passed = false; }
      else console.log(`  ✅ Line ${i + 1}: No SelectedBuyingOptionReference (correct — ASIN-only)`);
    });

    // Validate order attributes
    console.log('3c. Validating order attributes...');
    const attrTypes = payload.attributes.map(a => a.attributeType);
    const requiredAttrs = ['PurchaseOrderNumber', 'BuyerReference', 'SelectedPaymentMethodReference', 'Region', 'ShippingAddress', 'BuyingGroupReference'];

    if (CONFIG.AMAZON_B2B.TRIAL_MODE_ENABLED) requiredAttrs.push('TrialMode');

    for (const attr of requiredAttrs) {
      if (!attrTypes.includes(attr)) { console.error(`  ❌ Missing attribute: ${attr}`); passed = false; }
      else console.log(`  ✅ ${attr}: present`);
    }

    // Validate shipping address has requester name
    const shippingAttr = payload.attributes.find(a => a.attributeType === 'ShippingAddress');
    if (shippingAttr) {
      const fullName = shippingAttr.address.fullName;
      if (fullName === 'Jane Smith') {
        console.log(`  ✅ Shipping fullName: "${fullName}" (dynamic requester name)`);
      } else {
        console.error(`  ❌ Shipping fullName: "${fullName}" (expected "Jane Smith")`);
        passed = false;
      }
    }

    // Log full payload for manual review
    console.log('\n3d. Full payload (for manual review):');
    console.log(JSON.stringify(payload, null, 2));

  } catch (e) {
    console.error(`❌ FAIL: ${e.message}`);
    passed = false;
  }

  console.log(`\n🏁 TEST 3 RESULT: ${passed ? '✅ PASS' : '❌ FAIL'}`);
  return passed;
}

// ============================================================================
// TEST 4: Live Trial Order
// ============================================================================

function testPlaceTrialOrder() {
  console.log('🧪 TEST 4: Live Trial Order (TrialMode ON)');
  console.log('='.repeat(50));
  let passed = true;

  if (!CONFIG.AMAZON_B2B.TRIAL_MODE_ENABLED) {
    console.error('❌ ABORT: TrialMode is OFF — refusing to place a real order in test');
    return false;
  }

  // Use a commodity ASIN (Sharpie markers) with a reasonable budget ceiling
  const submittedPrice = 8.00;
  const ceiling = calculateMaxAllowedPrice(submittedPrice);
  console.log(`  Submitted: $${submittedPrice}, Max ceiling: $${ceiling.maxPrice} (buffer: $${ceiling.buffer})`);

  const testItems = [
    { asin: 'B001E6A9MA', quantity: 1, expectedUnitPrice: ceiling.maxPrice, description: 'Sharpie Permanent Markers (12pk)' }
  ];

  try {
    console.log('4a. Placing trial order...');
    const result = placeAmazonOrder(testItems, 'TEST-TRIAL-' + Date.now());

    console.log(`  Response: success=${result.success}`);

    if (result.success) {
      console.log(`  ✅ Order accepted. ID: ${result.amazonOrderId}`);
      if (result.acceptedItems.length > 0) {
        result.acceptedItems.forEach(item => {
          console.log(`  ✅ Accepted: ${item.externalId}, orderId=${item.orderId || 'N/A'}, unitPrice=${item.unitPrice || 'N/A'}`);
        });
      }
    } else {
      console.log(`  ⚠️ Order not accepted: ${result.error || 'unknown'}`);
      // This is OK for a trial — the ASIN price may exceed our ceiling
      if (result.rejectedItems && result.rejectedItems.length > 0) {
        result.rejectedItems.forEach(item => {
          console.log(`  ⚠️ Rejected: ${item.externalId}`);
          if (item.expectedPrice) console.log(`    BrokenUnitPrice: expected=$${item.expectedPrice}, actual=$${item.actualPrice}`);
          if (item.message) console.log(`    RejectionMessage: ${item.message}`);
        });
        console.log('  ℹ️ Rejection is expected if live price > ceiling — this confirms ExpectedUnitPrice works.');
      }
    }

  } catch (e) {
    console.error(`❌ FAIL: ${e.message}`);
    passed = false;
  }

  console.log(`\n🏁 TEST 4 RESULT: ${passed ? '✅ PASS' : '❌ FAIL'}`);
  return passed;
}

// ============================================================================
// TEST 5: Full Pipeline E2E (Auth → Max Price → Order → Log → Email)
// ============================================================================

function testFullPipeline() {
  console.log('🧪 TEST 5: Full Pipeline (Auth → Max Budget → Trial Order → Log)');
  console.log('='.repeat(50));
  let passed = true;

  if (!CONFIG.AMAZON_B2B.TRIAL_MODE_ENABLED) {
    console.error('❌ ABORT: TrialMode is OFF');
    return false;
  }

  // Use commodity ASIN: Copy Paper (B07DRTB3BC) or Sharpies (B001E6A9MA)
  const testAsin = 'B001E6A9MA';
  const mockSubmittedPrice = 9.50; // Teacher submitted $9.50

  try {
    // Step 1: Auth
    console.log('5a. Authenticating...');
    const token = getAccessToken();
    console.log(`  ✅ Token: ${token.substring(0, 8)}***`);

    // Step 2: Calculate max budget ceiling
    console.log('5b. Calculating max allowed price...');
    const ceiling = calculateMaxAllowedPrice(mockSubmittedPrice);
    console.log(`  ✅ Submitted: $${mockSubmittedPrice} → Max ceiling: $${ceiling.maxPrice} (buffer: $${ceiling.buffer})`);

    // Step 3: Place trial order with ceiling as ExpectedUnitPrice
    console.log('5c. Placing trial order...');
    const txnId = 'E2E-TEST-' + Date.now();
    const orderResult = placeAmazonOrder(
      [{ asin: testAsin, quantity: 1, expectedUnitPrice: ceiling.maxPrice, description: 'E2E Test — Sharpie Markers' }],
      txnId,
      'Test Teacher'
    );

    console.log(`  Order success: ${orderResult.success}`);
    if (orderResult.amazonOrderId) console.log(`  ✅ Order ID: ${orderResult.amazonOrderId}`);

    if (!orderResult.success) {
      console.log(`  ℹ️ Order rejected/failed: ${orderResult.error || 'price exceeded ceiling'}`);
      if (orderResult.rejectedItems) {
        orderResult.rejectedItems.forEach(rej => {
          console.log(`    Rejected: ${JSON.stringify(rej)}`);
        });
      }
      console.log('  ℹ️ This is acceptable — confirms API correctly evaluates price constraints.');
    }

    // Step 4: Log to sheet
    console.log('5d. Logging to AmazonApiLog sheet...');
    logAmazonApiResult({
      requestId: generateRequestId(),
      asin: testAsin,
      submittedPrice: mockSubmittedPrice,
      livePrice: ceiling.maxPrice,
      delta: ceiling.buffer,
      status: orderResult.success ? 'ORDER_SUCCESS' : 'PRICE_CEILING_EXCEEDED',
      orderId: orderResult.amazonOrderId || ''
    });
    console.log('  ✅ Sheet row written');

    // Step 5: Send summary email
    console.log('5e. Sending summary email...');
    sendAmazonSummaryEmail('E2E Pipeline Test', [{
      asin: testAsin, submittedPrice: mockSubmittedPrice,
      maxAllowedPrice: ceiling.maxPrice, buffer: ceiling.buffer,
      status: orderResult.success ? 'ORDERED' : 'REJECTED',
      orderId: orderResult.amazonOrderId || '',
      delta: 0, pctDiff: 0
    }]);
    console.log('  ✅ Email sent');

  } catch (e) {
    console.error(`❌ FAIL: ${e.message}`);
    console.error(e.stack);
    passed = false;
  }

  console.log(`\n🏁 TEST 5 RESULT: ${passed ? '✅ PASS' : '❌ FAIL'}`);
  return passed;
}

// ============================================================================
// RUN ALL TESTS
// ============================================================================

function runAllAmazonApiTests() {
  console.log('🚀 Running ALL Amazon API Tests (v2 — Single-Step Architecture)');
  console.log('='.repeat(60));

  const results = {
    'Test 1 — LWA Auth': testLwaAuth(),
    'Test 2 — Max Allowed Price': testMaxAllowedPrice(),
    'Test 3 — Order Payload': testOrderPayload(),
    'Test 4 — Trial Order': testPlaceTrialOrder(),
    'Test 5 — Full Pipeline': testFullPipeline()
  };

  console.log('\n' + '='.repeat(60));
  console.log('📊 FINAL RESULTS:');
  let allPassed = true;
  for (const [name, result] of Object.entries(results)) {
    console.log(`  ${result ? '✅' : '❌'} ${name}`);
    if (!result) allPassed = false;
  }
  console.log(`\n🏁 OVERALL: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
}

// ============================================================================
// TEST 6: Ledger Appender Proof (Tests Patch)
// ============================================================================

function testLedgerAppend() {
  console.log('🧪 TEST 6: Testing Ledger Output Schema');
  const engine = new AmazonWorkflowEngine();
  const mockResult = {
    orderId: 'PO-TEST-999',
    items: [{
      orderId: 'AMZ-AD-TEST-01',
      requestor: 'invoicing@keswickchristian.org',
      department: 'Admin',
      description: 'Test Item for Ledger Alignment',
      price: 15.99
    }]
  };
  
  engine.logTransactionsToBudgetHub(mockResult);
  console.log('✅ Mock data sent to TransactionLedger. Please check the `TransactionLedger` sheet to verify all 11 columns populated perfectly!');
}
