/**
 * ============================================================================
 * KESWICK BUDGET AUTOMATION SYSTEM - PRODUCTION v3.0 FINAL
 * ============================================================================
 * MAIN ENTRY POINT
 * ============================================================================
 * This file handles:
 * 1. System Initialization & Setup
 * 2. Trigger Configuration (Routing to Engines)
 * 3. Deployment & Verification Utilities
 *
 * NOTE: Core logic has been moved to specialized engines:
 * - Budget_Engine.gs: Budget calcs, encumbrances, approvals
 * - Forms_Engine.gs: Form submission handlers, approval routing
 * - Amazon_Engine.js: Amazon ordering workflow
 * - Logging_Service.gs: Centralized logging
 * - Config.gs: System configuration
 * - Utils.gs: Shared utilities
 */

// ============================================================================
// SYSTEM INITIALIZATION & SETUP
// ============================================================================

function initializeSystem() {
  console.log('🚀 Initializing Budget Automation System...');
  createSystemConfig();
  createQueueSheets(); // Ensure queue sheets exist
  setupAllTriggers();

  // Initialize encumbrances via Budget Engine
  if (typeof updateAllUserEncumbrances === 'function') {
    updateAllUserEncumbrances();
  } else {
    console.warn('⚠️ updateAllUserEncumbrances not found - check Budget_Engine.gs');
  }

  console.log('✅ System initialization complete');
}

/**
 * Creates AutomatedQueue and ManualQueue sheets if they don't exist.
 * These sheets are required for form submission processing.
 */
function createQueueSheets() {
  console.log('📋 Ensuring queue sheets exist...');

  const queueHeaders = [
    'TransactionID', 'Email', 'Type', 'Department', 'Division',
    'Amount', 'Description', 'Status', 'SubmittedOn', 'ApprovedOn',
    'Approver', 'ResponseID'
  ];

  // Create AutomatedQueue in Automated Hub
  try {
    const autoHub = SpreadsheetApp.openById(CONFIG.AUTOMATED_HUB_ID);
    let autoQueue = autoHub.getSheetByName('AutomatedQueue');

    if (!autoQueue) {
      console.log('  Creating AutomatedQueue sheet...');
      autoQueue = autoHub.insertSheet('AutomatedQueue');
      autoQueue.getRange(1, 1, 1, queueHeaders.length).setValues([queueHeaders]);
      autoQueue.setFrozenRows(1);

      // Format header
      const headerRange = autoQueue.getRange(1, 1, 1, queueHeaders.length);
      headerRange.setBackground('#1565C0');
      headerRange.setFontColor('#FFFFFF');
      headerRange.setFontWeight('bold');

      console.log('  ✅ AutomatedQueue created');
    } else {
      console.log('  ✅ AutomatedQueue already exists');
    }
  } catch (error) {
    console.error('  ❌ Failed to create AutomatedQueue:', error);
  }

  // Create ManualQueue in Manual Hub
  try {
    const manualHub = SpreadsheetApp.openById(CONFIG.MANUAL_HUB_ID);
    let manualQueue = manualHub.getSheetByName('ManualQueue');

    if (!manualQueue) {
      console.log('  Creating ManualQueue sheet...');
      manualQueue = manualHub.insertSheet('ManualQueue');
      manualQueue.getRange(1, 1, 1, queueHeaders.length).setValues([queueHeaders]);
      manualQueue.setFrozenRows(1);

      // Format header
      const headerRange = manualQueue.getRange(1, 1, 1, queueHeaders.length);
      headerRange.setBackground('#2E7D32');
      headerRange.setFontColor('#FFFFFF');
      headerRange.setFontWeight('bold');

      console.log('  ✅ ManualQueue created');
    } else {
      console.log('  ✅ ManualQueue already exists');
    }
  } catch (error) {
    console.error('  ❌ Failed to create ManualQueue:', error);
  }
}

function createSystemConfig() {
  try {
    const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
    let configSheet = budgetHub.getSheetByName('System Config');
    
    if (!configSheet) {
      configSheet = budgetHub.insertSheet('System Config');
      
      // Add headers
      configSheet.getRange(1, 1, 1, 4).setValues([
        ['Property', 'Value', 'Description', 'Last Updated']
      ]);
      
      // Add configuration values
      const configData = [
        ['PRODUCTION_STATUS', 'TEST', 'System mode (TEST/LIVE)', new Date()],
        ['AUTO_APPROVAL_LIMIT', CONFIG.AUTO_APPROVAL_LIMIT, 'Auto-approval threshold', new Date()],
        ['FISCAL_YEAR_START', '07-01', 'Fiscal year start date', new Date()],
        ['LAST_ENCUMBRANCE_UPDATE', new Date(), 'Last encumbrance calculation', new Date()],
        ['VERSION', '3.0', 'System version', new Date()]
      ];
      
      configSheet.getRange(2, 1, configData.length, 4).setValues(configData);
      
      // Format header
      const headerRange = configSheet.getRange(1, 1, 1, 4);
      headerRange.setBackground('#2E7D32');
      headerRange.setFontColor('#FFFFFF');
      headerRange.setFontWeight('bold');
      
      console.log('✅ System Config sheet created');
    }
    
  } catch (error) {
    console.error('Error creating System Config:', error);
  }
}

// ============================================================================
// TRIGGER CONFIGURATION
// ============================================================================

function setupAllTriggers() {
  // Remove ALL existing triggers
  ScriptApp.getProjectTriggers().forEach(trigger => {
    ScriptApp.deleteTrigger(trigger);
  });
  
  // Form submission triggers - Routed to Forms_Engine.gs
  // Note: These strings references functions that MUST match definitions in Forms_Engine.gs
  
  ScriptApp.newTrigger('processAmazonFormSubmission')
    .forForm(CONFIG.FORMS.AMAZON)
    .onFormSubmit()
    .create();
    
  ScriptApp.newTrigger('processWarehouseFormSubmission')
    .forForm(CONFIG.FORMS.WAREHOUSE)
    .onFormSubmit()
    .create();
    
  ScriptApp.newTrigger('processFieldTripFormSubmission')
    .forForm(CONFIG.FORMS.FIELD_TRIP)
    .onFormSubmit()
    .create();
    
  ScriptApp.newTrigger('processCurriculumFormSubmission')
    .forForm(CONFIG.FORMS.CURRICULUM)
    .onFormSubmit()
    .create();
    
  ScriptApp.newTrigger('processAdminFormSubmission')
    .forForm(CONFIG.FORMS.ADMIN)
    .onFormSubmit()
    .create();
  
  // Amazon workflow - Tuesday and Friday at 8 AM
  ScriptApp.newTrigger('runAmazonWorkflow')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.TUESDAY)
    .atHour(8)
    .create();
    
  ScriptApp.newTrigger('runAmazonWorkflow')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.FRIDAY)
    .atHour(8)
    .create();
    
  // Warehouse processing - Daily at 9 AM
  ScriptApp.newTrigger('processWarehouseOrders')
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();
    
  // Overnight invoice generation - Daily at 2 AM
  ScriptApp.newTrigger('runOvernightInvoiceGeneration')
    .timeBased()
    .everyDays(1)
    .atHour(2)
    .create();
    
  // Encumbrance updates - Every 30 minutes
  // Calls function in Budget_Engine.gs
  ScriptApp.newTrigger('updateAllUserEncumbrances')
    .timeBased()
    .everyMinutes(30)
    .create();
    
  // Daily maintenance - Daily at 3 AM
  ScriptApp.newTrigger('runDailyMaintenance')
    .timeBased()
    .everyDays(1)
    .atHour(3)
    .create();
    
  // Weekly cleanup - Sunday at 4 AM
  ScriptApp.newTrigger('runWeeklyCleanup')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.SUNDAY)
    .atHour(4)
    .create();
    
  console.log('✅ All triggers configured successfully');
  
  // Log trigger summary
  const triggers = ScriptApp.getProjectTriggers();
  console.log(`Total triggers created: ${triggers.length}`);
  triggers.forEach(trigger => {
    console.log(`- ${trigger.getHandlerFunction()} (${trigger.getEventType()})`);
  });
}

// ============================================================================
// TRIGGER HANDLERS (Wrappers/Placeholders)
// ============================================================================

function runAmazonWorkflow() {
  const engine = new AmazonWorkflowEngine();
  return engine.executeAmazonWorkflow(false); // Normal run with time checks
}

// Invoicing Engine
function runOvernightInvoiceGeneration() {
  console.log('⏳ Running Overnight Invoice Generation...');
  if (typeof runNightlyInvoiceBatch === 'function') {
    runNightlyInvoiceBatch();
  } else {
    // If function is in Invoicing_Engine.gs but script hasn't reloaded contexts?
    // In Apps Script, all files are shared global scope.
    const engine = getInvoicingEngine(); // Ensure class is loaded
    // Need to make sure runNightlyInvoiceBatch is available globally.
    // It was defined as a top level function in the previous step.
    console.warn('⚠️ runNightlyInvoiceBatch not found in scope?');
  }
}

// TODO: Implement Maintenance Engine
function runDailyMaintenance() {
  console.log('⏳ Daily Maintenance - Placeholder');
}

// TODO: Implement Maintenance Engine
function runWeeklyCleanup() {
  console.log('⏳ Weekly Cleanup - Placeholder');
}

/**
 * Process approval replies - stub function for legacy trigger
 * Note: Actual approvals are processed via Web App (handleApprovalFromWebApp)
 * This function exists to prevent "function not found" errors from the scheduled trigger
 */
function processApprovalReplies() {
  // Approval workflow uses web app buttons, not email replies
  // This is a stub to prevent trigger errors
  console.log('✅ processApprovalReplies - No email-based approvals to process (using web app workflow)');
}

// ============================================================================
// DEPLOYMENT UTILITIES
// ============================================================================

function completePhase1Deployment() {
  console.log('🚀 === KESWICK BUDGET SYSTEM - PHASE 1 DEPLOYMENT ===');
  console.log(`Started at: ${new Date()}`);
  console.log('');

  // Step 1: Create upload folder
  console.log('STEP 1: Create Upload Folder');
  console.log('-'.repeat(40));
  let uploadFolderId;
  try {
    uploadFolderId = createUploadFolder();
  } catch (e) {
    console.error('Upload folder creation failed, continuing...');
  }
  console.log('');

  // Step 2: Create queue sheets (CRITICAL - must exist before form submissions)
  console.log('STEP 2: Create Queue Sheets');
  console.log('-'.repeat(40));
  createQueueSheets();
  console.log('');

  // Step 3: Link forms to Hubs
  console.log('STEP 3: Link Forms to Hub Spreadsheets');
  console.log('-'.repeat(40));
  const linkResults = linkFormsToHubs();
  console.log('');
  
  // Step 4: Set up all triggers
  console.log('STEP 4: Set Up Triggers');
  console.log('-'.repeat(40));
  setupAllTriggers();
  console.log('');

  // Step 5: Verify configuration
  console.log('STEP 5: Verify Configuration');
  console.log('-'.repeat(40));
  verifyDeployment();
  console.log('');
  
  // Summary
  console.log('='.repeat(60));
  console.log('DEPLOYMENT COMPLETE');
  console.log('='.repeat(60));
  
  return {
    uploadFolderId,
    linkResults,
    testMode: CONFIG.TEST_MODE
  };
}

function verifyDeployment() {
  const checks = [];
  
  // Check Hub spreadsheets
  try {
    SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
    checks.push({ name: 'Budget Hub', status: '✅', id: CONFIG.BUDGET_HUB_ID });
  } catch (e) { checks.push({ name: 'Budget Hub', status: '❌', error: e.message }); }
  
  try {
    SpreadsheetApp.openById(CONFIG.AUTOMATED_HUB_ID);
    checks.push({ name: 'Automated Hub', status: '✅', id: CONFIG.AUTOMATED_HUB_ID });
  } catch (e) { checks.push({ name: 'Automated Hub', status: '❌', error: e.message }); }
  
  try {
    SpreadsheetApp.openById(CONFIG.MANUAL_HUB_ID);
    checks.push({ name: 'Manual Hub', status: '✅', id: CONFIG.MANUAL_HUB_ID });
  } catch (e) { checks.push({ name: 'Manual Hub', status: '❌', error: e.message }); }
  
  // Check forms
  const formChecks = [
    { name: 'Amazon Form', id: CONFIG.FORMS.AMAZON },
    { name: 'Warehouse Form', id: CONFIG.FORMS.WAREHOUSE },
    { name: 'Field Trip Form', id: CONFIG.FORMS.FIELD_TRIP },
    { name: 'Curriculum Form', id: CONFIG.FORMS.CURRICULUM },
    { name: 'Admin Form', id: CONFIG.FORMS.ADMIN }
  ];
  
  formChecks.forEach(fc => {
    try {
      FormApp.openById(fc.id);
      checks.push({ name: fc.name, status: '✅', id: fc.id });
    } catch (e) {
      checks.push({ name: fc.name, status: '❌', error: e.message });
    }
  });
  
  // Check triggers
  const triggers = ScriptApp.getProjectTriggers();
  checks.push({ name: 'Triggers', status: triggers.length > 0 ? '✅' : '⚠️', count: triggers.length });
  
  console.log('Verification Results:');
  checks.forEach(c => {
    if (c.error) console.log(`  ${c.status} ${c.name}: ${c.error}`);
    else console.log(`  ${c.status} ${c.name}`);
  });
  
  return checks;
}

function createUploadFolder() {
  console.log('📁 === CREATING UPLOAD FOLDER ===');
  const folderName = 'Budget System Uploads';
  const parentFolderName = 'Keswick Budget System';
  
  try {
    const existingFolders = DriveApp.getFoldersByName(folderName);
    if (existingFolders.hasNext()) {
      return existingFolders.next().getId();
    }
    
    let parentFolder = DriveApp.getRootFolder();
    const parentFolders = DriveApp.getFoldersByName(parentFolderName);
    if (parentFolders.hasNext()) {
      parentFolder = parentFolders.next();
    }
    
    const uploadFolder = parentFolder.createFolder(folderName);
    uploadFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return uploadFolder.getId();
    
  } catch (error) {
    console.error('❌ Failed to create upload folder:', error);
    throw error;
  }
}

function linkFormsToHubs() {
  console.log('🔗 === LINKING FORMS TO HUB SPREADSHEETS ===');
  const results = { success: [], failed: [] };
  
  const mappings = [
    { form: 'Amazon', id: CONFIG.FORMS.AMAZON, hub: CONFIG.AUTOMATED_HUB_ID, sheet: 'Amazon' },
    { form: 'Warehouse', id: CONFIG.FORMS.WAREHOUSE, hub: CONFIG.AUTOMATED_HUB_ID, sheet: 'Warehouse' },
    { form: 'Field Trip', id: CONFIG.FORMS.FIELD_TRIP, hub: CONFIG.MANUAL_HUB_ID, sheet: 'Field Trip' },
    { form: 'Curriculum', id: CONFIG.FORMS.CURRICULUM, hub: CONFIG.MANUAL_HUB_ID, sheet: 'Curriculum' },
    { form: 'Admin', id: CONFIG.FORMS.ADMIN, hub: CONFIG.MANUAL_HUB_ID, sheet: 'Admin' }
  ];
  
  mappings.forEach(m => {
    try {
      linkFormToSheet(m.id, m.hub, m.sheet);
      results.success.push(m.form);
    } catch (e) {
      results.failed.push({ form: m.form, error: e.message });
      console.error(`❌ Failed linking ${m.form}:`, e);
    }
  });
  
  console.log(`✅ Success: ${results.success.length}, ❌ Failed: ${results.failed.length}`);
  return results;
}

function linkFormToSheet(formId, spreadsheetId, sheetName) {
  const form = FormApp.openById(formId);
  try {
    const existingDestId = form.getDestinationId();
    if (existingDestId === spreadsheetId) return;
    if (existingDestId) form.removeDestination();
  } catch (e) {}
  
  form.setDestination(FormApp.DestinationType.SPREADSHEET, spreadsheetId);
  console.log(`  Linked form ${formId} to spreadsheet ${spreadsheetId}`);
}

function getFormLinks() {
  console.log('📋 === FORM LINKS ===');
  const forms = [
    { name: 'Amazon Request', id: CONFIG.FORMS.AMAZON },
    { name: 'Warehouse Request', id: CONFIG.FORMS.WAREHOUSE },
    { name: 'Field Trip Request', id: CONFIG.FORMS.FIELD_TRIP },
    { name: 'Curriculum Request', id: CONFIG.FORMS.CURRICULUM },
    { name: 'Admin Request', id: CONFIG.FORMS.ADMIN }
  ];
  
  forms.forEach(f => {
    try {
      const form = FormApp.openById(f.id);
      console.log(`${f.name}: ${form.getPublishedUrl()} (Edit: ${form.getEditUrl()})`);
    } catch (e) {
      console.log(`${f.name}: ❌ ${e.message}`);
    }
  });
}

// ============================================================================
// WEB APP HANDLERS (doGet / doPost)
// ============================================================================

/**
 * Serves the approval WebApp UI or processes a direct approval action.
 * Deploy as: Execute as me, Anyone with the link.
 */
function doGet(e) {
  try {
    const params = e ? e.parameter : {};
    const transactionId = params.transactionId || params.requestId || '';
    const approverEmail = params.approver || '';

    // If no transactionId, show a simple landing page
    if (!transactionId) {
      return HtmlService.createHtmlOutput(
        '<h2>Keswick Budget Approval System</h2><p>No request specified. Please use the link from your approval email.</p>'
      ).setTitle('Budget Approval System');
    }

    // Fetch real request data from queues
    const requestData = getRequestDetails(transactionId);

    if (!requestData) {
      return HtmlService.createHtmlOutput(
        `<h2>Request Not Found</h2><p>Transaction <strong>${transactionId}</strong> was not found or has already been processed.</p>`
      ).setTitle('Budget Approval System');
    }

    // Serve the WebApp template with real data injected
    const template = HtmlService.createTemplateFromFile('WebApp');
    template.serverData = JSON.stringify({
      transactionId: transactionId,
      approverEmail: approverEmail,
      type: requestData.type,
      amount: requestData.amount,
      requestor: requestData.email,
      department: requestData.department,
      division: requestData.division,
      description: requestData.description,
      status: requestData.status,
      budgetAvailable: requestData.budget ? requestData.budget.available : 0,
      budgetAllocated: requestData.budget ? requestData.budget.allocated : 0,
      budgetSpent: requestData.budget ? requestData.budget.spent : 0,
      budgetEncumbered: requestData.budget ? requestData.budget.encumbered : 0,
      utilizationRate: requestData.budget ? requestData.budget.utilizationRate : 0
    });

    return template.evaluate()
      .setTitle('Budget Approval System - Keswick Christian School')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  } catch (error) {
    console.error('doGet error:', error);
    return HtmlService.createHtmlOutput(
      `<h2>Error</h2><p>${error.toString()}</p>`
    ).setTitle('Budget Approval System - Error');
  }
}

/**
 * Handles approval/rejection AJAX calls from the WebApp UI.
 * Expects JSON body: { transactionId, approver, decision, reason }
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const result = processApprovalDecision(
      data.transactionId,
      data.approver,
      data.decision
    );

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    console.error('doPost error:', error);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Fetches full request details including budget info for the WebApp.
 * @param {string} transactionId
 * @returns {Object|null} Request data with budget context
 */
function getRequestDetails(transactionId) {
  if (!transactionId) return null;

  const request = findRequestInQueues(transactionId);
  if (!request) return null;

  const userBudget = getUserBudgetInfo(request.email);
  return {
    ...request,
    budget: userBudget
  };
}

/**
 * Server-side function callable from WebApp via google.script.run
 * @param {string} transactionId
 * @param {string} approverEmail
 * @param {string} decision - 'approve' or 'reject'
 * @param {string} reason - Optional reason (required for rejections)
 * @returns {Object} { success, status, error }
 */
function handleApprovalFromWebApp(transactionId, approverEmail, decision, reason) {
  try {
    console.log(`WebApp approval: ${decision} for ${transactionId} by ${approverEmail}`);
    const result = processApprovalDecision(transactionId, approverEmail, decision);

    if (result.success) {
      logSystemEvent('WEBAPP_APPROVAL_PROCESSED', approverEmail, 0, {
        transactionId,
        decision,
        reason: reason || ''
      });
    }

    return result;
  } catch (error) {
    console.error('handleApprovalFromWebApp error:', error);
    return { success: false, error: error.toString() };
  }
}

// ============================================================================
// TEST & UTILITIES
// ============================================================================

function testAmazonWorkflowManual() {
  console.log('=== MANUAL AMAZON WORKFLOW TEST ===');
  const engine = new AmazonWorkflowEngine();
  return engine.executeAmazonWorkflow(true);
}

function testWarehouseProcessing() {
  console.log('=== MANUAL WAREHOUSE PROCESSING TEST ===');
  if (typeof processWarehouseOrders === 'function') {
    return processWarehouseOrders();
  }
  console.warn('processWarehouseOrders not found');
  return null;
}

function testSequentialIds() {
  console.log('Testing sequential IDs:');
  console.log('Amazon:', generateSequentialTransactionId('AMAZON'));
  console.log('Warehouse:', generateSequentialTransactionId('WAREHOUSE'));
  console.log('Field Trip:', generateSequentialTransactionId('FIELD_TRIP'));
  console.log('Curriculum:', generateSequentialTransactionId('CURRICULUM'));
  console.log('Admin:', generateSequentialTransactionId('ADMIN'));
}

function generateTestUrl() {
  const testId = `TEST_${Date.now()}`;
  
  // Create test entry in automated queue
  const autoHub = SpreadsheetApp.openById(CONFIG.AUTOMATED_HUB_ID);
  const queue = autoHub.getSheetByName('AutomatedQueue');
  
  queue.appendRow([
    testId, 'test@keswickchristian.org', 'AMAZON', 'English', 'Upper School',
    100, 'Test approval URL', 'PENDING', new Date(), '', '', 'TEST'
  ]);
  
  const url = `${CONFIG.WEBAPP_URL}?action=approve&transactionId=${testId}&approver=${CONFIG.TEST_EMAIL}&decision=approve&timestamp=${Date.now()}`;
  
  console.log('=== TEST URL GENERATED ===');
  console.log('Transaction:', testId);
  console.log('URL:', url);
  
  return url;
}
// Preflight check Thu Feb  5 13:14:18 EST 2026
