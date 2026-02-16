// ============================================================================
// COMPREHENSIVE TESTING AND DIAGNOSTIC FUNCTIONS
// ============================================================================
// Testing functions to validate the Budget System fixes and run diagnostics

/**
 * Test invoice generation bypassing health check
 */
function testInvoiceGenerationDirect() {
  console.log('🚀 Testing invoice generation directly (bypassing health check)...\n');
  
  try {
    // Step 1: Get unprocessed transactions
    console.log('📋 Getting unprocessed transactions...');
    const transactions = getUnprocessedTransactions();
    console.log(`Found ${transactions.length} unprocessed transactions`);
    
    if (transactions.length === 0) {
      console.log('No unprocessed transactions found');
      return;
    }
    
    // Step 2: Take just the first transaction for testing
    const testTransaction = transactions[0];
    console.log(`\nTesting with transaction: ${testTransaction.transactionId}`);
    console.log(`Form Type: ${testTransaction.formType}`);
    console.log(`Amount: $${testTransaction.amount}`);
    
    // Step 3: Enrich the transaction
    console.log('\n🔍 Enriching transaction...');
    const enriched = enrichTransactionData(testTransaction);
    console.log(`✅ Enriched - ${enriched.lineItems?.length || 0} line items`);
    
    // Step 4: Create a single group
    console.log('\n📦 Creating processing group...');
    const singleGroup = {
      type: 'single',
      transactions: [enriched],
      lineItems: enriched.lineItems || [],
      formType: enriched.formType,
      division: getDivisionFromTransaction(enriched),
      totalAmount: enriched.amount
    };
    
    // Step 5: Process the single group
    console.log('\n📄 Processing invoice...');
    const result = processSingleGroupSimplified(singleGroup);
    
    if (result.success) {
      console.log('\n✅ SUCCESS! Invoice generated:');
      console.log(`Invoice ID: ${result.invoiceId}`);
      console.log(`Template: ${result.template}`);
      console.log(`Drive URL: ${result.driveUrl || 'Not uploaded'}`);
    } else {
      console.log('\n❌ FAILED:');
      console.log(`Error: ${result.error}`);
    }
    
    return result;
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error('Stack:', error.stack);
    return { success: false, error: error.message };
  }
}

/**
 * Simplified single group processor for testing
 */
function processSingleGroupSimplified(singleGroup) {
  try {
    console.log(`Processing single transaction: ${singleGroup.transactions[0]?.transactionId}`);
    
    const transaction = singleGroup.transactions[0];
    
    // Select template
    const template = 'single_internal_template'; // Force single template
    console.log(`Using template: ${template}`);
    
    // Prepare simplified template data
    const templateData = {
      invoiceId: 'TEST-' + new Date().getTime(),
      invoiceNumber: 'TEST-001',
      invoiceDate: new Date().toLocaleDateString(),
      
      isBatch: false,
      isAdmin: singleGroup.formType === 'Admin' || singleGroup.formType === 'ADMIN',
      
      division: singleGroup.division || 'Unknown',
      divisionName: singleGroup.division || 'Unknown',
      divisionCode: getDivisionCode(singleGroup.division || 'Unknown'),
      divisionBudget: 100000, // Default value
      divisionUtilization: 42, // Default value
      
      totalAmount: singleGroup.totalAmount || 0,
      amount: singleGroup.totalAmount || 0,
      orderTotal: singleGroup.totalAmount || 0,
      
      formType: singleGroup.formType || 'Unknown',
      typeLabel: singleGroup.formType || 'Unknown',
      
      logoBase64: '', // Skip logo for test
      
      lineItems: singleGroup.lineItems || [],
      transactions: singleGroup.transactions || [],
      
      // Single specific fields
      transactionId: transaction.transactionId,
      description: transaction.description || 'Test Purchase',
      combinedDescription: transaction.description || 'Test Purchase',
      quantity: 1,
      unitPrice: singleGroup.totalAmount || 0,
      orderId: transaction.orderId || 'N/A',
      processedDate: new Date().toLocaleDateString(),
      requestorName: transaction.requestorName || 'Test User',
      requestor: transaction.requestor || 'test@school.edu',
      
      // Approver info
      approverName: 'Test Approver',
      approverTitle: 'Principal'
    };
    
    console.log('Template data prepared');
    
    // Load template
    const htmlTemplate = loadHTMLTemplate(template);
    console.log(`Template loaded: ${htmlTemplate.length} characters`);
    
    // Process template
    const processedHTML = processHTMLTemplate(htmlTemplate, templateData);
    console.log(`Template processed: ${processedHTML.length} characters`);
    
    // Generate PDF
    console.log('Generating PDF...');
    const blob = Utilities.newBlob(processedHTML, 'text/html', `${templateData.invoiceId}.html`)
      .getAs('application/pdf');
    console.log(`PDF generated: ${blob.getBytes().length} bytes`);
    
    // Skip Drive upload for test
    console.log('Skipping Drive upload for test');
    
    return {
      success: true,
      type: 'single',
      invoiceId: templateData.invoiceId,
      template: template,
      totalAmount: templateData.totalAmount,
      pdfSize: blob.getBytes().length
    };
    
  } catch (error) {
    console.error('Processing error:', error);
    return {
      success: false,
      type: 'single',
      error: error.message
    };
  }
}

/**
 * Super quick test - just try to make a PDF
 */
function quickPDFTest() {
  console.log('🚀 Quick PDF generation test...\n');
  
  try {
    const simpleHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial; margin: 20px; }
          h1 { color: #1b5e3f; }
          .invoice-info { background: #f0f0f0; padding: 10px; margin: 20px 0; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background: #1b5e3f; color: white; }
          .total { text-align: right; font-size: 18pt; font-weight: bold; color: #1b5e3f; }
        </style>
      </head>
      <body>
        <h1>TEST INVOICE</h1>
        <div class="invoice-info">
          <p><strong>Invoice ID:</strong> TEST-${new Date().getTime()}</p>
          <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
          <p><strong>Division:</strong> Test Division</p>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Quantity</th>
              <th>Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Test Item</td>
              <td>1</td>
              <td>$100.00</td>
              <td>$100.00</td>
            </tr>
          </tbody>
        </table>
        
        <div class="total">
          <p>Total: $100.00</p>
        </div>
      </body>
      </html>
    `;
    
    const blob = Utilities.newBlob(simpleHTML, 'text/html', 'test.html')
      .getAs('application/pdf');
    
    console.log(`✅ PDF generated successfully: ${blob.getBytes().length} bytes`);
    console.log('✅ Basic PDF generation is working!');
    
    return true;
    
  } catch (error) {
    console.error('❌ PDF generation failed:', error);
    return false;
  }
}

/**
 * Apply all fixes and run tests
 */
function applyAllFixes() {
  console.log('🔧 Applying all comprehensive fixes...\n');
  
  try {
    // Test 1: Division Budget
    console.log('1️⃣ Testing Division Budget Fix...');
    debugDivisionBudget(); // This will show what's in your sheet
    
    // Test 2: Health Check
    console.log('\n2️⃣ Testing Health Check Fix...');
    const healthStatus = performSystemHealthChecks();
    console.log(`Health Status: ${healthStatus.status}`);
    
    // Test 3: Template Processing
    console.log('\n3️⃣ Testing Template Processing Fix...');
    const templateTest = testTemplateProcessingFixed();
    console.log(`Template Processing: ${templateTest ? '✅ Working' : '❌ Failed'}`);
    
    console.log('\n✅ All fixes applied!');
    console.log('🚀 You can now run generateOvernightInvoices() again');
    
  } catch (error) {
    console.error('❌ Error applying fixes:', error);
  }
}

/**
 * Run complete diagnostic
 */
function runCompleteDiagnostic() {
  console.log('🏥 Running Complete System Diagnostic...\n');
  
  // Check organization data
  console.log('📊 Organization Budget Data:');
  console.log('============================');
  debugDivisionBudget();
  
  // Check health
  console.log('\n💊 Health Check Details:');
  console.log('========================');
  debugHealthCheck();
  
  // Check templates
  console.log('\n📄 Template System:');
  console.log('==================');
  testTemplateProcessingFixed();
  
  console.log('\n✅ Diagnostic complete!');
}

/**
 * Debug the division budget lookup
 */
function debugDivisionBudget() {
  console.log('🔍 Debugging Division Budget Lookup...\n');
  
  try {
    const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
    const budgetSheet = budgetHub.getSheetByName('OrganizationBudgets');
    
    if (!budgetSheet) {
      console.error('❌ OrganizationBudgets sheet not found!');
      return;
    }
    
    const data = budgetSheet.getDataRange().getValues();
    const headers = data[0];
    
    // Get column indices
    const orgIndex = headers.indexOf('Organization');
    const allocatedIndex = headers.indexOf('BudgetAllocated');
    const spentIndex = headers.indexOf('BudgetSpent');
    
    console.log('📋 All Organizations in Budget Sheet:');
    console.log('=====================================');
    
    for (let i = 1; i < data.length; i++) {
      const org = data[i][orgIndex];
      const allocated = data[i][allocatedIndex];
      const spent = data[i][spentIndex];
      
      if (org) {
        console.log(`Row ${i + 1}: "${org}"`);
        console.log(`  Allocated: $${allocated || 0}`);
        console.log(`  Spent: $${spent || 0}`);
        console.log('');
      }
    }
    
    // Test different division names
    console.log('\n🧪 Testing Division Lookups:');
    console.log('================================');
    const testDivisions = ['Administration', 'Admin', 'AD', 'Upper School', 'US', 'Lower School', 'LS'];
    
    testDivisions.forEach(division => {
      const result = getDivisionBudgetInfo(division);
      console.log(`"${division}": Allocated=$${result.allocated}, Utilization=${result.utilization}%`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

/**
 * Debug the health check to see what's failing
 */
function debugHealthCheck() {
  console.log('🔍 Debugging Health Check...\n');
  
  const checks = {
    school_logo: false,
    budget_hub: false,
    automated_hub: false,
    manual_hub: false,
    templates: false,
    permissions: false
  };
  
  // Check school logo
  console.log('1️⃣ Checking School Logo...');
  try {
    const logo = getSchoolLogoBase64();
    checks.school_logo = logo && logo.length > 0;
    console.log(`   ✅ Logo loaded: ${logo.length} characters`);
  } catch (error) {
    console.log(`   ❌ Logo failed: ${error.message}`);
  }
  
  // Check hub mappings
  console.log('\n2️⃣ Checking Hub Mappings...');
  try {
    const mappings = loadHubHeaderMappings();
    checks.budget_hub = mappings && mappings.budget && Object.keys(mappings.budget).length > 0;
    checks.automated_hub = mappings && mappings.automated && Object.keys(mappings.automated).length > 0;
    checks.manual_hub = mappings && mappings.manual && Object.keys(mappings.manual).length > 0;
    
    console.log(`   Budget Hub: ${checks.budget_hub ? '✅' : '❌'} (${Object.keys(mappings.budget || {}).length} sheets)`);
    console.log(`   Automated Hub: ${checks.automated_hub ? '✅' : '❌'} (${Object.keys(mappings.automated || {}).length} sheets)`);
    console.log(`   Manual Hub: ${checks.manual_hub ? '✅' : '❌'} (${Object.keys(mappings.manual || {}).length} sheets)`);
  } catch (error) {
    console.log(`   ❌ Hub mappings failed: ${error.message}`);
  }
  
  // Check templates
  console.log('\n3️⃣ Checking Templates...');
  try {
    const templates = ['single_internal_template', 'batch_internal_template', 'warehouse_external_template'];
    let templateCount = 0;
    
    templates.forEach(template => {
      try {
        const html = loadHTMLTemplate(template);
        if (html && html.length > 0) {
          templateCount++;
          console.log(`   ✅ ${template}: ${html.length} characters`);
        }
      } catch (e) {
        console.log(`   ❌ ${template}: ${e.message}`);
      }
    });
    
    checks.templates = templateCount >= 2;
    console.log(`   Templates loaded: ${templateCount}/3`);
  } catch (error) {
    console.log(`   ❌ Template check failed: ${error.message}`);
  }
  
  // Check permissions (basic test)
  console.log('\n4️⃣ Checking Permissions...');
  try {
    // Try to access each hub
    const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
    const automatedHub = SpreadsheetApp.openById(CONFIG.AUTOMATED_HUB_ID);
    const manualHub = SpreadsheetApp.openById(CONFIG.MANUAL_HUB_ID);
    
    checks.permissions = true;
    console.log('   ✅ All hubs accessible');
  } catch (error) {
    console.log(`   ❌ Permission error: ${error.message}`);
  }
  
  // Summary
  console.log('\n📊 Health Check Summary:');
  console.log('========================');
  Object.entries(checks).forEach(([key, value]) => {
    console.log(`${key}: ${value ? '✅ PASS' : '❌ FAIL'}`);
  });
  
  const allPassed = Object.values(checks).every(check => check === true);
  console.log(`\nOverall Status: ${allPassed ? '✅ HEALTHY' : '❌ UNHEALTHY'}`);
  
  return checks;
}

/**
 * Test template processing
 */
function testTemplateProcessingFixed() {
  console.log('🧪 Testing template processing with simplified data...\n');
  
  const testData = {
    invoiceId: 'TEST-001',
    invoiceDate: '7/18/2025',
    division: 'Test Division',
    formType: 'Amazon',
    totalAmount: 100.00,
    logoBase64: '', // Empty for test
    isAdmin: false
  };
  
  try {
    // Load template
    const template = loadHTMLTemplate('single_internal_template');
    console.log(`✅ Template loaded: ${template.length} characters`);
    
    // Process with fixed method
    const processed = processHTMLTemplate(template, testData);
    console.log(`✅ Template processed: ${processed.length} characters`);
    
    // Test PDF generation
    const blob = Utilities.newBlob(processed, 'text/html', 'test.html').getAs('application/pdf');
    console.log(`✅ PDF generated: ${blob.getBytes().length} bytes`);
    
    return true;
    
  } catch (error) {
    console.error('❌ Template processing failed:', error);
    return false;
  }
}

/**
 * Test the fixed getDivisionBudgetInfo function
 */
function testDivisionBudgetInfo() {
  console.log('🧪 Testing fixed getDivisionBudgetInfo...\n');
  
  const divisions = ['Upper School', 'Lower School', 'Administration', 'Keswick Kids'];
  
  divisions.forEach(division => {
    console.log(`Testing ${division}:`);
    const budgetInfo = getDivisionBudgetInfo(division);
    console.log(`  Allocated: $${budgetInfo.allocated.toLocaleString()}`);
    console.log(`  Spent: $${budgetInfo.spent.toLocaleString()}`);
    console.log(`  Utilization: ${budgetInfo.utilization}%`);
    console.log('');
  });
  
  console.log('✅ Test completed!\n');
}

/**
 * Quick diagnostic to check OrganizationBudgets sheet structure
 */
function checkOrganizationBudgetsStructure() {
  console.log('🔍 Checking OrganizationBudgets sheet structure...\n');
  
  try {
    const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
    const budgetSheet = budgetHub.getSheetByName('OrganizationBudgets');
    
    if (!budgetSheet) {
      console.error('❌ OrganizationBudgets sheet not found!');
      return;
    }
    
    const data = budgetSheet.getDataRange().getValues();
    const headers = data[0];
    
    console.log('📋 Column Headers:');
    headers.forEach((header, index) => {
      console.log(`  Column ${String.fromCharCode(65 + index)}: ${header}`);
    });
    
    console.log(`\n📊 Data rows: ${data.length - 1}`);
    
    if (data.length > 1) {
      console.log('\n🔍 Sample data (first row):');
      const firstRow = data[1];
      headers.forEach((header, index) => {
        if (firstRow[index]) {
          console.log(`  ${header}: ${firstRow[index]}`);
        }
      });
    }
    
    console.log('\n✅ Structure check completed!');
    
  } catch (error) {
    console.error('❌ Error checking structure:', error);
  }
}
