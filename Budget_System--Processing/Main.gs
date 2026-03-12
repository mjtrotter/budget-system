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

// Invoicing Engine - Runs overnight batch invoicing based on day of week
// Amazon batches: Tuesday & Friday
// Warehouse batches: Wednesday
function runOvernightInvoiceGeneration() {
  console.log('⏳ Running Overnight Invoice Generation...');

  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat

  const results = { amazon: null, warehouse: null };

  // Tuesday (2) or Friday (5) - Amazon batch
  if (dayOfWeek === 2 || dayOfWeek === 5) {
    console.log('📦 Running Amazon batch invoice (scheduled day)...');
    if (typeof runAmazonBatch === 'function') {
      results.amazon = runAmazonBatch();
    } else {
      console.warn('⚠️ runAmazonBatch function not found');
    }
  }

  // Wednesday (3) - Warehouse batch
  if (dayOfWeek === 3) {
    console.log('🏪 Running Warehouse batch invoice (scheduled day)...');
    if (typeof runWarehouseBatch === 'function') {
      results.warehouse = runWarehouseBatch();
    } else {
      console.warn('⚠️ runWarehouseBatch function not found');
    }
  }

  // Log results
  if (dayOfWeek !== 2 && dayOfWeek !== 3 && dayOfWeek !== 5) {
    console.log('ℹ️ No batch invoices scheduled for today (day ' + dayOfWeek + ')');
  } else {
    console.log('✅ Overnight invoice generation complete:', JSON.stringify(results));
  }

  return results;
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
/**
 * Handles GET requests for approval links.
 * Validates secure token and displays approval UI only if token is valid.
 * No longer accepts transactionId or approver in URL parameters.
 */
function doGet(e) {
  try {
    const params = e ? e.parameter : {};
    const token = params.token || '';

    // Validate token and retrieve transaction details
    if (!token) {
      return HtmlService.createHtmlOutput(
        '<h2>Keswick Budget Approval System</h2><p>No approval request specified. Please use the link from your approval email.</p>'
      ).setTitle('Budget Approval System');
    }

    // Validate the token
    const tokenValidation = validateAndRetrieveToken(token);
    if (!tokenValidation.valid) {
      console.warn(`[SECURITY] Invalid token access attempt: ${tokenValidation.error}`);
      return HtmlService.createHtmlOutput(
        `<h2>Invalid Approval Link</h2><p><strong>Error:</strong> ${tokenValidation.error}</p><p>Please request a new approval link from the requestor.</p>`
      ).setTitle('Budget Approval System');
    }

    const tokenData = tokenValidation.data;
    const transactionId = tokenData.transactionId;
    const approverEmail = tokenData.approver;

    // Verify current user is the designated approver
    const currentUser = Session.getActiveUser().getEmail();
    if (currentUser !== approverEmail) {
      console.warn(`[SECURITY] User identity mismatch in doGet: Token for ${approverEmail}, current user ${currentUser}`);
      return HtmlService.createHtmlOutput(
        `<h2>Access Denied</h2><p>You must be logged in as <strong>${approverEmail}</strong> to access this approval. Currently logged in as: <strong>${currentUser}</strong></p><p>Please log out and log back in with the correct account.</p>`
      ).setTitle('Budget Approval System');
    }

    // Fetch real request data from queues
    const requestData = getRequestDetails(transactionId);
    if (!requestData) {
      console.warn(`[SECURITY] Request not found for valid token: TxnID ${transactionId}`);
      return HtmlService.createHtmlOutput(
        `<h2>Request Not Found</h2><p>Transaction <strong>${transactionId}</strong> was not found or has already been processed.</p>`
      ).setTitle('Budget Approval System');
    }

    // Serve the WebApp template with real data injected
    const template = HtmlService.createTemplateFromFile('WebApp');
    template.serverData = JSON.stringify({
      transactionId: transactionId,
      token: token,
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

    console.log(`[SECURITY] Approval page displayed for token ${token.substring(0, 8)}... | TxnID: ${transactionId} | Approver: ${approverEmail}`);

    return template.evaluate()
      .setTitle('Budget Approval System - Keswick Christian School')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  } catch (error) {
    console.error('[SECURITY ERROR] doGet error:', error);
    logSystemEvent('APPROVAL_WEBAPP_GET_ERROR', Session.getActiveUser().getEmail(), 0, {
      error: error.toString()
    });
    return HtmlService.createHtmlOutput(
      `<h2>Error</h2><p>${error.toString()}</p><p>Please try accessing the approval link again.</p>`
    ).setTitle('Budget Approval System - Error');
  }
}

/**
 * Handles approval/rejection AJAX calls from the WebApp UI.
 * Now accepts only token and decision (sensitive data not passed in request).
 * Expects JSON body: { token, decision }
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const token = data.token || '';
    const decision = data.decision || '';

    // Validate token is provided
    if (!token) {
      console.warn('[SECURITY] doPost called without token');
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'No token provided'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Validate decision is valid
    if (!decision || (decision !== 'approve' && decision !== 'reject')) {
      console.warn(`[SECURITY] doPost called with invalid decision: ${decision}`);
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Invalid decision. Must be "approve" or "reject"'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Process approval with token validation
    const result = processApprovalDecision(token, decision);

    // Log the result
    if (result.success) {
      console.log(`[SECURITY] Approval processed via doPost - Decision: ${result.status}`);
      logSystemEvent('WEBAPP_APPROVAL_PROCESSED', Session.getActiveUser().getEmail(), 0, {
        decision: result.status
      });
    } else {
      console.warn(`[SECURITY] Approval failed via doPost - Error: ${result.error}`);
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    console.error('[SECURITY ERROR] doPost error:', error);
    logSystemEvent('APPROVAL_WEBAPP_POST_ERROR', Session.getActiveUser().getEmail(), 0, {
      error: error.toString()
    });
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'An error occurred processing your approval. Please try again.'
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
/**
 * Handles approval/rejection from WebApp UI (called via google.script.run).
 * Now uses token-based system for security.
 *
 * @deprecated This function is maintained for backward compatibility with WebApp UI.
 * The WebApp now passes the token instead of transactionId and approverEmail.
 * @param {string} token - The secure approval token (new parameter)
 * @param {string} decision - 'approve' or 'reject'
 * @param {string} reason - Optional rejection reason (unused for security)
 * @returns {Object} Result with success and status or error
 */
function handleApprovalFromWebApp(token, decision, reason) {
  try {
    console.log(`[SECURITY] WebApp approval initiated - Decision: ${decision}`);
    const result = processApprovalDecision(token, decision);

    if (result.success) {
      console.log(`[SECURITY] WebApp approval successful - Status: ${result.status}`);
      logSystemEvent('WEBAPP_APPROVAL_PROCESSED', Session.getActiveUser().getEmail(), 0, {
        decision: result.status,
        reason: reason || ''
      });
    } else {
      console.warn(`[SECURITY] WebApp approval failed - Error: ${result.error}`);
    }

    return result;
  } catch (error) {
    console.error('[SECURITY ERROR] handleApprovalFromWebApp error:', error);
    logSystemEvent('WEBAPP_APPROVAL_ERROR', Session.getActiveUser().getEmail(), 0, {
      error: error.toString()
    });
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
