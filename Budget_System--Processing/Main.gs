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
  console.log("🚀 Initializing Budget Automation System...");
  createSystemConfig();
  createQueueSheets(); // Ensure queue sheets exist
  setupAllTriggers();

  // Initialize encumbrances via Budget Engine
  if (typeof updateAllUserEncumbrances === "function") {
    updateAllUserEncumbrances();
  } else {
    console.warn(
      "⚠️ updateAllUserEncumbrances not found - check Budget_Engine.gs",
    );
  }

  console.log("✅ System initialization complete");
}

/**
 * Creates AutomatedQueue and ManualQueue sheets if they don't exist.
 * These sheets are required for form submission processing.
 */
function createQueueSheets() {
  console.log("📋 Ensuring queue sheets exist...");

  const queueHeaders = [
    "TransactionID",
    "Email",
    "Type",
    "Department",
    "Division",
    "Amount",
    "Description",
    "Status",
    "SubmittedOn",
    "ApprovedOn",
    "Approver",
    "ResponseID",
  ];

  // Create AutomatedQueue in Automated Hub
  try {
    const autoHub = SpreadsheetApp.openById(CONFIG.AUTOMATED_HUB_ID);
    let autoQueue = autoHub.getSheetByName("AutomatedQueue");

    if (!autoQueue) {
      console.log("  Creating AutomatedQueue sheet...");
      autoQueue = autoHub.insertSheet("AutomatedQueue");
      autoQueue
        .getRange(1, 1, 1, queueHeaders.length)
        .setValues([queueHeaders]);
      autoQueue.setFrozenRows(1);

      // Format header
      const headerRange = autoQueue.getRange(1, 1, 1, queueHeaders.length);
      headerRange.setBackground("#1565C0");
      headerRange.setFontColor("#FFFFFF");
      headerRange.setFontWeight("bold");

      console.log("  ✅ AutomatedQueue created");
    } else {
      console.log("  ✅ AutomatedQueue already exists");
    }
  } catch (error) {
    console.error("  ❌ Failed to create AutomatedQueue:", error);
  }

  // Create ManualQueue in Manual Hub
  try {
    const manualHub = SpreadsheetApp.openById(CONFIG.MANUAL_HUB_ID);
    let manualQueue = manualHub.getSheetByName("ManualQueue");

    if (!manualQueue) {
      console.log("  Creating ManualQueue sheet...");
      manualQueue = manualHub.insertSheet("ManualQueue");
      manualQueue
        .getRange(1, 1, 1, queueHeaders.length)
        .setValues([queueHeaders]);
      manualQueue.setFrozenRows(1);

      // Format header
      const headerRange = manualQueue.getRange(1, 1, 1, queueHeaders.length);
      headerRange.setBackground("#2E7D32");
      headerRange.setFontColor("#FFFFFF");
      headerRange.setFontWeight("bold");

      console.log("  ✅ ManualQueue created");
    } else {
      console.log("  ✅ ManualQueue already exists");
    }
  } catch (error) {
    console.error("  ❌ Failed to create ManualQueue:", error);
  }
}

function createSystemConfig() {
  try {
    const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
    let configSheet = budgetHub.getSheetByName("System Config");

    if (!configSheet) {
      configSheet = budgetHub.insertSheet("System Config");

      // Add headers
      configSheet
        .getRange(1, 1, 1, 4)
        .setValues([["Property", "Value", "Description", "Last Updated"]]);

      // Add configuration values
      const configData = [
        ["PRODUCTION_STATUS", "TEST", "System mode (TEST/LIVE)", new Date()],
        [
          "AUTO_APPROVAL_LIMIT",
          CONFIG.AUTO_APPROVAL_LIMIT,
          "Auto-approval threshold",
          new Date(),
        ],
        ["FISCAL_YEAR_START", "07-01", "Fiscal year start date", new Date()],
        [
          "LAST_ENCUMBRANCE_UPDATE",
          new Date(),
          "Last encumbrance calculation",
          new Date(),
        ],
        ["VERSION", "3.0", "System version", new Date()],
      ];

      configSheet.getRange(2, 1, configData.length, 4).setValues(configData);

      // Format header
      const headerRange = configSheet.getRange(1, 1, 1, 4);
      headerRange.setBackground("#2E7D32");
      headerRange.setFontColor("#FFFFFF");
      headerRange.setFontWeight("bold");

      console.log("✅ System Config sheet created");
    }
  } catch (error) {
    console.error("Error creating System Config:", error);
  }
}

// ============================================================================
// TRIGGER CONFIGURATION
// ============================================================================

function setupAllTriggers() {
  // Remove ALL existing triggers
  ScriptApp.getProjectTriggers().forEach((trigger) => {
    ScriptApp.deleteTrigger(trigger);
  });

  // Form submission triggers - Routed to Forms_Engine.gs
  // Note: These strings references functions that MUST match definitions in Forms_Engine.gs

  ScriptApp.newTrigger("processAmazonFormSubmission")
    .forForm(CONFIG.FORMS.AMAZON)
    .onFormSubmit()
    .create();

  ScriptApp.newTrigger("processWarehouseFormSubmission")
    .forForm(CONFIG.FORMS.WAREHOUSE)
    .onFormSubmit()
    .create();

  ScriptApp.newTrigger("processFieldTripFormSubmission")
    .forForm(CONFIG.FORMS.FIELD_TRIP)
    .onFormSubmit()
    .create();

  ScriptApp.newTrigger("processCurriculumFormSubmission")
    .forForm(CONFIG.FORMS.CURRICULUM)
    .onFormSubmit()
    .create();

  ScriptApp.newTrigger("processAdminFormSubmission")
    .forForm(CONFIG.FORMS.ADMIN)
    .onFormSubmit()
    .create();

  // [DEPRECATED] Amazon Phase 1 & 2 Triggers (6AM & 8:30AM)
  // Replaced with instantaneous AWS Ordering API Dispatcher located in Forms_Engine.gs

  // Warehouse processing - Daily at 9 AM
  ScriptApp.newTrigger("processWarehouseOrders")
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();

  // Overnight invoice generation - Daily at 2 AM
  ScriptApp.newTrigger("runOvernightInvoiceGeneration")
    .timeBased()
    .everyDays(1)
    .atHour(2)
    .create();

  // Encumbrance updates - Every 30 minutes
  // Calls function in Budget_Engine.gs
  ScriptApp.newTrigger("updateAllUserEncumbrances")
    .timeBased()
    .everyMinutes(30)
    .create();

  console.log("✅ All triggers configured successfully");

  // Log trigger summary
  const triggers = ScriptApp.getProjectTriggers();
  console.log(`Total triggers created: ${triggers.length}`);
  triggers.forEach((trigger) => {
    console.log(
      `- ${trigger.getHandlerFunction()} (${trigger.getEventType()})`,
    );
  });
}

// ============================================================================
// TRIGGER HANDLERS (Wrappers/Placeholders)
// ============================================================================

// [DEPRECATED] Amazon Phase wrappers removed.
// Orders are dispatched instantly to Sandbox REST API on form approval.

// Invoicing Engine - Runs overnight batch invoicing based on day of week
// Amazon batches: Tuesday & Friday
// Warehouse batches: Wednesday
function runOvernightInvoiceGeneration() {
  console.log("⏳ Running Overnight Invoice Generation...");

  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat

  const results = { amazon: null, warehouse: null };

  // [DEPRECATED] Tuesday/Friday Amazon batch removed.
  // Amazon Orders flow directly to Sandbox via REST Integration natively.

  // Wednesday (3) or Friday (5) - Warehouse batch
  if (dayOfWeek === 3 || dayOfWeek === 5) {
    console.log("🏪 Running Warehouse batch invoice (scheduled day)...");
    if (typeof runWarehouseBatch === "function") {
      results.warehouse = runWarehouseBatch();
    } else {
      console.warn("⚠️ runWarehouseBatch function not found");
    }
  }

  // Log results
  if (dayOfWeek !== 2 && dayOfWeek !== 3 && dayOfWeek !== 5) {
    console.log(
      "ℹ️ No batch invoices scheduled for today (day " + dayOfWeek + ")",
    );
  } else {
    console.log(
      "✅ Overnight invoice generation complete:",
      JSON.stringify(results),
    );
  }

  return results;
}

// ============================================================================
// DEPLOYMENT UTILITIES
// ============================================================================

function completePhase1Deployment() {
  console.log("🚀 === KESWICK BUDGET SYSTEM - PHASE 1 DEPLOYMENT ===");
  console.log(`Started at: ${new Date()}`);
  console.log("");

  // Step 1: Create upload folder
  console.log("STEP 1: Create Upload Folder");
  console.log("-".repeat(40));
  let uploadFolderId;
  try {
    uploadFolderId = createUploadFolder();
  } catch (e) {
    console.error("Upload folder creation failed, continuing...");
  }
  console.log("");

  // Step 2: Create queue sheets (CRITICAL - must exist before form submissions)
  console.log("STEP 2: Create Queue Sheets");
  console.log("-".repeat(40));
  createQueueSheets();
  console.log("");

  // Step 3: Link forms to Hubs
  console.log("STEP 3: Link Forms to Hub Spreadsheets");
  console.log("-".repeat(40));
  const linkResults = linkFormsToHubs();
  console.log("");

  // Step 4: Set up all triggers
  console.log("STEP 4: Set Up Triggers");
  console.log("-".repeat(40));
  setupAllTriggers();
  console.log("");

  // Step 5: Verify configuration
  console.log("STEP 5: Verify Configuration");
  console.log("-".repeat(40));
  verifyDeployment();
  console.log("");

  // Summary
  console.log("=".repeat(60));
  console.log("DEPLOYMENT COMPLETE");
  console.log("=".repeat(60));

  return {
    uploadFolderId,
    linkResults,
    testMode: CONFIG.TEST_MODE,
  };
}

function verifyDeployment() {
  const checks = [];

  // Check Hub spreadsheets
  try {
    SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
    checks.push({ name: "Budget Hub", status: "✅", id: CONFIG.BUDGET_HUB_ID });
  } catch (e) {
    checks.push({ name: "Budget Hub", status: "❌", error: e.message });
  }

  try {
    SpreadsheetApp.openById(CONFIG.AUTOMATED_HUB_ID);
    checks.push({
      name: "Automated Hub",
      status: "✅",
      id: CONFIG.AUTOMATED_HUB_ID,
    });
  } catch (e) {
    checks.push({ name: "Automated Hub", status: "❌", error: e.message });
  }

  try {
    SpreadsheetApp.openById(CONFIG.MANUAL_HUB_ID);
    checks.push({ name: "Manual Hub", status: "✅", id: CONFIG.MANUAL_HUB_ID });
  } catch (e) {
    checks.push({ name: "Manual Hub", status: "❌", error: e.message });
  }

  // Check forms
  const formChecks = [
    { name: "Amazon Form", id: CONFIG.FORMS.AMAZON },
    { name: "Warehouse Form", id: CONFIG.FORMS.WAREHOUSE },
    { name: "Field Trip Form", id: CONFIG.FORMS.FIELD_TRIP },
    { name: "Curriculum Form", id: CONFIG.FORMS.CURRICULUM },
    { name: "Admin Form", id: CONFIG.FORMS.ADMIN },
  ];

  formChecks.forEach((fc) => {
    try {
      FormApp.openById(fc.id);
      checks.push({ name: fc.name, status: "✅", id: fc.id });
    } catch (e) {
      checks.push({ name: fc.name, status: "❌", error: e.message });
    }
  });

  // Check triggers
  const triggers = ScriptApp.getProjectTriggers();
  checks.push({
    name: "Triggers",
    status: triggers.length > 0 ? "✅" : "⚠️",
    count: triggers.length,
  });

  console.log("Verification Results:");
  checks.forEach((c) => {
    if (c.error) console.log(`  ${c.status} ${c.name}: ${c.error}`);
    else console.log(`  ${c.status} ${c.name}`);
  });

  return checks;
}

function createUploadFolder() {
  console.log("📁 === CREATING UPLOAD FOLDER ===");
  const folderName = "Budget System Uploads";
  const parentFolderName = "Keswick Budget System";

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
    uploadFolder.setSharing(
      DriveApp.Access.ANYONE_WITH_LINK,
      DriveApp.Permission.VIEW,
    );
    return uploadFolder.getId();
  } catch (error) {
    console.error("❌ Failed to create upload folder:", error);
    throw error;
  }
}

function linkFormsToHubs() {
  console.log("🔗 === LINKING FORMS TO HUB SPREADSHEETS ===");
  const results = { success: [], failed: [] };

  const mappings = [
    {
      form: "Amazon",
      id: CONFIG.FORMS.AMAZON,
      hub: CONFIG.AUTOMATED_HUB_ID,
      sheet: "Amazon",
    },
    {
      form: "Warehouse",
      id: CONFIG.FORMS.WAREHOUSE,
      hub: CONFIG.AUTOMATED_HUB_ID,
      sheet: "Warehouse",
    },
    {
      form: "Field Trip",
      id: CONFIG.FORMS.FIELD_TRIP,
      hub: CONFIG.MANUAL_HUB_ID,
      sheet: "Field Trip",
    },
    {
      form: "Curriculum",
      id: CONFIG.FORMS.CURRICULUM,
      hub: CONFIG.MANUAL_HUB_ID,
      sheet: "Curriculum",
    },
    {
      form: "Admin",
      id: CONFIG.FORMS.ADMIN,
      hub: CONFIG.MANUAL_HUB_ID,
      sheet: "Admin",
    },
  ];

  mappings.forEach((m) => {
    try {
      linkFormToSheet(m.id, m.hub, m.sheet);
      results.success.push(m.form);
    } catch (e) {
      results.failed.push({ form: m.form, error: e.message });
      console.error(`❌ Failed linking ${m.form}:`, e);
    }
  });

  console.log(
    `✅ Success: ${results.success.length}, ❌ Failed: ${results.failed.length}`,
  );
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
  console.log("📋 === FORM LINKS ===");
  const forms = [
    { name: "Amazon Request", id: CONFIG.FORMS.AMAZON },
    { name: "Warehouse Request", id: CONFIG.FORMS.WAREHOUSE },
    { name: "Field Trip Request", id: CONFIG.FORMS.FIELD_TRIP },
    { name: "Curriculum Request", id: CONFIG.FORMS.CURRICULUM },
    { name: "Admin Request", id: CONFIG.FORMS.ADMIN },
  ];

  forms.forEach((f) => {
    try {
      const form = FormApp.openById(f.id);
      console.log(
        `${f.name}: ${form.getPublishedUrl()} (Edit: ${form.getEditUrl()})`,
      );
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

    // BACKDOOR: Local test script generation
    if (params.action === "get_pdfs") {
      const templateType = params.template || "all";
      let results = {};

      if (templateType === "amazon" || templateType === "all")
        results.amazon = generateDemoAmazonInvoice();
      if (templateType === "warehouse" || templateType === "all")
        results.warehouse = generateDemoWarehouseInternalInvoice();
      if (templateType === "warehouse_ext" || templateType === "all")
        results.warehouseExternal = generateDemoWarehouseExternalInvoice();
      if (templateType === "fieldtrip" || templateType === "all")
        results.fieldTrip = generateDemoFieldTripInvoice();
      if (templateType === "curriculum" || templateType === "all")
        results.curriculum = generateDemoCurriculumInvoice();
      if (templateType === "admin" || templateType === "all")
        results.admin = generateDemoAdminInvoice();
      let html =
        "<html><head><style>body{font-family:sans-serif;padding:20px;line-height:1.6} a{color:#1565C0;text-decoration:none} a:hover{text-decoration:underline} .card{background:#f9f9f9;padding:15px;border-radius:8px;margin-bottom:10px;border:1px solid #ddd;}</style></head><body>";
      html += "<h2>Sample Invoice PDFs Generated</h2>";

      const renderLink = (name, res) => {
        if (!res || res.error)
          return `<div class="card"><strong>${name}</strong>: ❌ Error: ${res ? res.error : "Unknown"}</div>`;
        return `<div class="card"><strong>${name}</strong>: <br><a href="${res.fileUrl}" target="_blank">📄 View PDF (${res.invoiceId})</a></div>`;
      };

      html += renderLink("Amazon Batch (Grouped by Division)", results.amazon);
      html += renderLink("Warehouse Internal Batch", results.warehouse);
      html += renderLink("Warehouse External Batch", results.warehouseExternal);
      html += renderLink("Field Trip Single Invoice", results.fieldTrip);
      html += renderLink("Curriculum Single Invoice", results.curriculum);
      html += renderLink("Admin Single Invoice", results.admin);

      html +=
        '<p style="margin-top:20px;font-size:12px;color:#666;"><em>Note: PDFs are saved to your Keswick Budget System / Invoices Drive folders.</em></p></body></html>';

      return HtmlService.createHtmlOutput(html)
        .setTitle("Sample Invoices")
        .addMetaTag("viewport", "width=device-width, initial-scale=1");
    }

    const token = params.token || "";

    if (!token) {
      return buildResultPage(
        "No Request",
        "No approval request specified. Please use the link from your approval email.",
        false,
      );
    }

    // Validate the token
    const tokenValidation = validateAndRetrieveToken(token);
    if (!tokenValidation.valid) {
      console.warn(
        `[SECURITY] Invalid token access attempt: ${tokenValidation.error}`,
      );
      return buildResultPage("Invalid Link", tokenValidation.error, false);
    }

    const tokenData = tokenValidation.data;
    const transactionId = tokenData.transactionId;
    const approverEmail = tokenData.approver;
    const decision = tokenData.decision; // 'approve' or 'reject'

    // Fetch request data
    const requestData = getRequestDetails(transactionId);
    if (!requestData) {
      return buildResultPage(
        "Request Not Found",
        `Transaction ${transactionId} was not found or has already been processed.`,
        false,
      );
    }

    if (requestData.status !== "PENDING") {
      return buildResultPage(
        "Already Processed",
        `This request (${transactionId}) has already been ${requestData.status.toLowerCase()}.`,
        false,
      );
    }

    // APPROVE: Process immediately routing through main approval engine logic
    if (decision === "approve") {
      console.log(
        `[SECURITY] One-click approve for ${transactionId} by ${approverEmail}`,
      );
      try {
        const result = processApprovalDecision(token, "approve");

        if (result.success) {
          const requestorName = getDisplayName(requestData.email);
          return buildResultPage(
            "Request Approved",
            `${requestData.type || "Request"} ${transactionId} for $${(requestData.amount || 0).toFixed(2)} has been approved. A notification has been sent to ${requestorName}.`,
            true,
          );
        } else {
          return buildResultPage(
            "Approval Error",
            result.error || "Failed to process approval.",
            false,
          );
        }
      } catch (approveError) {
        console.error(`[ERROR] One-click approve failed: ${approveError}`);
        return buildResultPage(
          "Approval Error",
          approveError.message || "Failed to process approval.",
          false,
        );
      }
    }

    // REJECT: Show simple comment form
    const requestorName = getDisplayName(requestData.email);
    const template = HtmlService.createTemplateFromFile("WebApp");
    template.serverData = JSON.stringify({
      transactionId: transactionId,
      token: token,
      type: requestData.type,
      amount: requestData.amount,
      requestor: requestorName,
    });

    console.log(
      `[SECURITY] Reject form displayed for ${transactionId} | Approver: ${approverEmail}`,
    );

    return template
      .evaluate()
      .setTitle("Deny Request - Keswick Christian School")
      .addMetaTag("viewport", "width=device-width, initial-scale=1")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (error) {
    console.error("[SECURITY ERROR] doGet error:", error);
    return buildResultPage("Error", error.toString(), false);
  }
}

/**
 * Looks up a user's display name from UserDirectory, falls back to email parsing.
 */
function getDisplayName(email) {
  if (!email) return "Unknown";
  try {
    const info = getUserBudgetInfo(email);
    if (info && info.firstName) {
      return `${info.firstName} ${info.lastName}`.trim();
    }
  } catch (e) {
    /* fall through */
  }
  // Fallback: parse email (e.g. mtrotter@ → Mtrotter)
  const namePart = email.split("@")[0];
  const parts = namePart.split(".");
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}

/**
 * Builds a simple branded result page (approval confirmation, errors, etc.)
 */
function buildResultPage(title, message, isSuccess) {
  const bgColor = isSuccess ? "#19573B" : "#b71c1c";
  const icon = isSuccess ? "&#10003;" : "&#10007;";
  const html = `<!DOCTYPE html><html><head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
      .card { background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); max-width: 480px; width: 90%; overflow: hidden; text-align: center; }
      .card-header { background: ${bgColor}; padding: 32px 24px; color: white; }
      .card-header .icon { font-size: 48px; margin-bottom: 12px; }
      .card-header h1 { font-size: 22px; font-weight: 600; }
      .card-body { padding: 28px 24px; color: #444; font-size: 15px; line-height: 1.6; }
      .card-footer { padding: 16px 24px; background: #fafafa; border-top: 1px solid #eee; font-size: 13px; color: #888; }
      .logo { max-width: 200px; height: auto; margin-bottom: 16px; filter: brightness(0) invert(1); }
    </style></head><body>
    <div class="card">
      <div class="card-header">
        <img src="https://lh3.googleusercontent.com/d/1HDkW_xGIc4jOBH4REnXb3VJcZaEjPHKj" alt="Keswick" class="logo" onerror="this.style.display='none'">
        <div class="icon">${icon}</div>
        <h1>${title}</h1>
      </div>
      <div class="card-body"><p>${message}</p></div>
      <div class="card-footer">Keswick Christian School &middot; Budget Management System<br>You may close this window.</div>
    </div></body></html>`;

  return HtmlService.createHtmlOutput(html)
    .setTitle(`${title} - Keswick Christian School`)
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

/**
 * Handles approval/rejection AJAX calls from the WebApp UI.
 * Now accepts only token and decision (sensitive data not passed in request).
 * Expects JSON body: { token, decision }
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const token = data.token || "";
    const decision = data.decision || "";

    // Validate token is provided
    if (!token) {
      console.warn("[SECURITY] doPost called without token");
      return ContentService.createTextOutput(
        JSON.stringify({
          success: false,
          error: "No token provided",
        }),
      ).setMimeType(ContentService.MimeType.JSON);
    }

    // Validate decision is valid
    if (!decision || (decision !== "approve" && decision !== "reject")) {
      console.warn(
        `[SECURITY] doPost called with invalid decision: ${decision}`,
      );
      return ContentService.createTextOutput(
        JSON.stringify({
          success: false,
          error: 'Invalid decision. Must be "approve" or "reject"',
        }),
      ).setMimeType(ContentService.MimeType.JSON);
    }

    // Process approval with token validation
    const result = processApprovalDecision(token, decision);

    // Log the result
    if (result.success) {
      console.log(
        `[SECURITY] Approval processed via doPost - Decision: ${result.status}`,
      );
      logSystemEvent(
        "WEBAPP_APPROVAL_PROCESSED",
        Session.getActiveUser().getEmail(),
        0,
        {
          decision: result.status,
        },
      );
    } else {
      console.warn(
        `[SECURITY] Approval failed via doPost - Error: ${result.error}`,
      );
    }

    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(
      ContentService.MimeType.JSON,
    );
  } catch (error) {
    console.error("[SECURITY ERROR] doPost error:", error);
    logSystemEvent(
      "APPROVAL_WEBAPP_POST_ERROR",
      Session.getActiveUser().getEmail(),
      0,
      {
        error: error.toString(),
      },
    );
    return ContentService.createTextOutput(
      JSON.stringify({
        success: false,
        error: "An error occurred processing your approval. Please try again.",
      }),
    ).setMimeType(ContentService.MimeType.JSON);
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
    budget: userBudget,
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
 * Uses token-based system for security.
 *
 * @param {string} token - The secure approval token
 * @param {string} decision - 'approve' or 'reject'
 * @param {string} reason - Optional rejection reason
 * @returns {Object} Result with success and status or error
 */
function handleApprovalFromWebApp(token, decision, reason) {
  try {
    console.log(`[SECURITY] WebApp rejection initiated`);

    // Validate token
    const tokenValidation = validateAndRetrieveToken(token);
    if (!tokenValidation.valid) {
      return { success: false, error: tokenValidation.error };
    }

    const tokenData = tokenValidation.data;
    const transactionId = tokenData.transactionId;
    const approverEmail = tokenData.approver;

    // Fetch request
    const request = findRequestInQueues(transactionId);
    if (!request) {
      return {
        success: false,
        error: "Request not found or already processed",
      };
    }
    if (request.status !== "PENDING") {
      return {
        success: false,
        error: `Request already ${request.status.toLowerCase()}`,
      };
    }

    // Process the decision
    const status = decision === "approve" ? "APPROVED" : "REJECTED";
    updateQueueStatus(transactionId, status, approverEmail, false);
    markTokenUsed(token, approverEmail);

    // Send notification to requestor
    if (decision === "reject") {
      sendRejectionNotification(request.email, {
        transactionId: transactionId,
        amount: request.amount,
        type: request.type || "Request",
        approver: approverEmail,
        reason: reason || "",
      });
    } else {
      sendApprovalNotification(request.email, {
        transactionId: transactionId,
        amount: request.amount,
        type: request.type || "Request",
        approver: approverEmail,
      });
    }

    logSystemEvent(
      "WEBAPP_APPROVAL_PROCESSED",
      approverEmail,
      request.amount || 0,
      {
        decision: status,
        reason: reason || "",
        transactionId: transactionId,
      },
    );

    return { success: true, status: status };
  } catch (error) {
    console.error("[SECURITY ERROR] handleApprovalFromWebApp error:", error);
    return { success: false, error: error.toString() };
  }
}

/**
 * Marks an approval token as used to prevent replay attacks
 */
function markTokenUsed(token, usedBy) {
  try {
    const props = PropertiesService.getScriptProperties();
    const tokenKey = `approval_token_${token}`;
    const tokenJson = props.getProperty(tokenKey);
    if (tokenJson) {
      const tokenData = JSON.parse(tokenJson);
      tokenData.used = true;
      tokenData.usedAt = Date.now();
      tokenData.usedBy = usedBy;
      props.setProperty(tokenKey, JSON.stringify(tokenData));
    }
  } catch (e) {
    console.warn(`Could not mark token as used: ${e.message}`);
  }
}

// ============================================================================
// TEST & UTILITIES
// ============================================================================

function testAmazonWorkflowManual() {
  console.log("=== MANUAL AMAZON WORKFLOW TEST ===");
  const engine = new AmazonWorkflowEngine();
  return engine.executeAmazonWorkflow(true);
}

function testWarehouseProcessing() {
  console.log("=== MANUAL WAREHOUSE PROCESSING TEST ===");
  if (typeof processWarehouseOrders === "function") {
    return processWarehouseOrders();
  }
  console.warn("processWarehouseOrders not found");
  return null;
}

function testSequentialIds() {
  console.log("Testing sequential IDs:");
  console.log("Amazon:", generateSequentialTransactionId("AMAZON"));
  console.log("Warehouse:", generateSequentialTransactionId("WAREHOUSE"));
  console.log("Field Trip:", generateSequentialTransactionId("FIELD_TRIP"));
  console.log("Curriculum:", generateSequentialTransactionId("CURRICULUM"));
  console.log("Admin:", generateSequentialTransactionId("ADMIN"));
}
