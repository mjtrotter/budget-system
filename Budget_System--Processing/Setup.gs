/**
 * ============================================================================
 * SETUP & CONFIGURATION UTILITY
 * ============================================================================
 * Run 'setupEnvironment' once after deployment to initialize Script Properties.
 * Run 'createFreshHubs' to create new hub spreadsheets owned by the running user.
 */

function setupEnvironment() {
  const props = PropertiesService.getScriptProperties();

  console.log("🛠️ Configuring Environment...");

  const config = {
    ORDER_PROCESSING_HOUR: "10",
    AUTO_APPROVAL_LIMIT: "200",
    TEST_MODE: "true",
    RAPIDAPI_KEY: "689004de57msh37754ed53610ed4p13f831jsn2e4fda873de1",
  };

  props.setProperties(config, false);

  console.log("✅ Environment Keys Updated:");
  console.log(`   TEST_MODE: ${config.TEST_MODE}`);
  console.log(`   AUTO_APPROVAL_LIMIT: ${config.AUTO_APPROVAL_LIMIT}`);
  console.log(`   ORDER_PROCESSING_HOUR: ${config.ORDER_PROCESSING_HOUR}`);

  console.log("✨ Setup Complete. Next Steps:");
  console.log("1. Run testRapidAPISetup() to verify connectivity");
  console.log("2. Run setupAllTriggers() to wire the system");
}

/**
 * Updates the WEBAPP_URL Script Property to point to the latest deployment.
 * Run this after creating a new web app deployment.
 */
function updateWebAppUrl() {
  const props = PropertiesService.getScriptProperties();
  const newUrl =
    "https://script.google.com/a/keswickchristian.org/macros/s/AKfycbwL5PpHn1P8GtppiZOnopXwh_E89Vma9LKi2aarTPlvlYdv8FbuU1M5N3-yt67yCzgadg/exec";
  props.setProperty("WEBAPP_URL", newUrl);
  console.log("✅ Updated WEBAPP_URL to: " + newUrl);
  console.log("   Verify: " + props.getProperty("WEBAPP_URL"));
}

// ============================================================================
// FRESH HUB CREATION
// ============================================================================
// Creates 3 new hub spreadsheets owned by whoever runs this function.
// Migrates reference data (UserDirectory, OrgBudgets, WarehouseCatalog)
// from the old hubs and sets up all sheets with correct headers.
//
// After running: copy the new IDs from the execution log and update
// Config.gs, Invoicing Arm/Main.gs, and Dashboard Arm/Dashboard_BE.gs
// ============================================================================

/**
 * Creates all 3 fresh hub spreadsheets and migrates reference data.
 * RUN THIS from the Apps Script Editor while logged into invoicing@kcs.
 */
function createFreshHubs() {
  console.log("🏗️ === CREATING FRESH HUB SPREADSHEETS ===");
  console.log("");

  // Old hub IDs for data migration
  const OLD_BUDGET_HUB = "1wbv44RU18vJXlImWwxf4VRX932LgWCTBEn6JNws9HhQ";
  const OLD_AUTO_HUB = "1CfktVXDNTY499U7zgkBVJ0DyBePH_BsYJeMtwyaxolM";
  const OLD_MANUAL_HUB = "1-t7YnyVvk0vxqbKGNteNHOQ92XOJNme4eJPjxVRVI5M";

  // ── 1. BUDGET HUB ──
  console.log("📊 Creating Budget Hub...");
  const budgetHub = SpreadsheetApp.create("KCS Budget Hub");
  const budgetHubId = budgetHub.getId();
  console.log(`   Created: ${budgetHubId}`);

  // TransactionLedger
  const ledger = budgetHub.getSheets()[0]; // Use default Sheet1
  ledger.setName("TransactionLedger");
  ledger.appendRow([
    "TransactionID",
    "OrderID",
    "ProcessedOn",
    "Requestor",
    "Approver",
    "Organization",
    "Form",
    "Amount",
    "Description",
    "FiscalQuarter",
    "InvoiceGenerated",
    "InvoiceURL",
  ]);
  ledger.setFrozenRows(1);
  console.log("   ✅ TransactionLedger");

  // UserDirectory
  const userDir = budgetHub.insertSheet("UserDirectory");
  userDir.appendRow([
    "Email",
    "FirstName",
    "LastName",
    "Role",
    "Department",
    "Division",
    "Approver",
    "BudgetAllocated",
    "BudgetSpent",
    "BudgetEncumbered",
    "BudgetRemaining",
    "UtilizationRate",
    "Active",
    "LastModified",
  ]);
  userDir.setFrozenRows(1);
  console.log("   ✅ UserDirectory");

  // Try to migrate data. Use setFormula on columns.
  try {
    const oldBudgetHub = SpreadsheetApp.openById(OLD_BUDGET_HUB);
    const oldUserDir = oldBudgetHub.getSheetByName("UserDirectory");
    if (oldUserDir && oldUserDir.getLastRow() > 1) {
      const dataRange = oldUserDir.getRange(
        2,
        1,
        oldUserDir.getLastRow() - 1,
        oldUserDir.getLastColumn(),
      );
      const data = dataRange.getValues();
      if (data.length > 0) {
        userDir.getRange(2, 1, data.length, data[0].length).setValues(data);
        console.log(`   ✅ UserDirectory (migrated ${data.length} users)`);
      }
    }
  } catch (e) {
    console.log(`   ⚠️ Could not migrate users: ${e.message}`);
  }

  // Set formulas down to row 1000
  userDir
    .getRange("I2:I1000")
    .setFormula(
      '=IF(A2<>"", SUMIFS(TransactionLedger!H:H, TransactionLedger!D:D, A2), "")',
    );
  userDir.getRange("K2:K1000").setFormula('=IF(A2<>"", H2-I2-J2, "")');
  userDir
    .getRange("L2:L1000")
    .setFormula('=IF(A2<>"", IFERROR((I2+J2)/H2, 0), "")');

  // OrganizationBudgets
  const orgBudgets = budgetHub.insertSheet("OrganizationBudgets");
  orgBudgets.appendRow([
    "Organization",
    "BudgetAllocated",
    "BudgetSpent",
    "BudgetEncumbered",
    "BudgetAvailable",
    "Approver",
    "Active",
    "LastModified",
  ]);
  orgBudgets.setFrozenRows(1);
  try {
    const oldBudgetHub = SpreadsheetApp.openById(OLD_BUDGET_HUB);
    const oldOrgBudgets = oldBudgetHub.getSheetByName("OrganizationBudgets");
    if (oldOrgBudgets && oldOrgBudgets.getLastRow() > 1) {
      const orgData = oldOrgBudgets
        .getRange(
          2,
          1,
          oldOrgBudgets.getLastRow() - 1,
          oldOrgBudgets.getLastColumn(),
        )
        .getValues();
      if (orgData.length > 0) {
        orgBudgets
          .getRange(2, 1, orgData.length, orgData[0].length)
          .setValues(orgData);
        console.log(
          `   ✅ OrganizationBudgets (migrated ${orgData.length} orgs)`,
        );
      }
    } else {
      console.log("   ✅ OrganizationBudgets (empty)");
    }
  } catch (e) {
    console.warn(
      `   ⚠️ OrganizationBudgets created but migration failed: ${e.message}`,
    );
  }

  // SystemLog
  const sysLog = budgetHub.insertSheet("SystemLog");
  sysLog.appendRow([
    "Timestamp",
    "Action",
    "User",
    "Amount",
    "Details",
    "Before",
    "After",
    "Status",
  ]);
  sysLog.setFrozenRows(1);
  console.log("   ✅ SystemLog");

  // TransactionArchive
  const archive = budgetHub.insertSheet("TransactionArchive");
  archive.appendRow([
    "TransactionID",
    "OrderID",
    "ProcessedOn",
    "Requestor",
    "Approver",
    "Organization",
    "Form",
    "Amount",
    "Description",
    "FiscalQuarter",
    "InvoiceGenerated",
    "InvoiceURL",
  ]);
  archive.setFrozenRows(1);
  console.log("   ✅ TransactionArchive");

  // System Config
  const budgetConfig = budgetHub.insertSheet("System Config");
  budgetConfig.appendRow(["Property", "Value", "Description", "Last Updated"]);
  budgetConfig.setFrozenRows(1);
  console.log("   ✅ System Config");

  // ── 2. AUTOMATED HUB ──
  console.log("");
  console.log("🤖 Creating Automated Hub...");
  const autoHub = SpreadsheetApp.create("KCS Automated Hub");
  const autoHubId = autoHub.getId();
  console.log(`   Created: ${autoHubId}`);

  // Amazon (form responses will be linked here — leave empty with just a header placeholder)
  const amazon = autoHub.getSheets()[0];
  amazon.setName("Amazon");
  amazon.appendRow([
    "Timestamp",
    "Email Address",
    "Item 1 - Description",
    "Item 1 - Amazon URL",
    "Item 1 - Quantity",
    "Item 1 - Unit Price ($)",
    "Add another item?",
    "Item 2 - Description",
    "Item 2 - Amazon URL",
    "Item 2 - Quantity",
    "Item 2 - Unit Price ($)",
    "Add another item?",
    "Item 3 - Description",
    "Item 3 - Amazon URL",
    "Item 3 - Quantity",
    "Item 3 - Unit Price ($)",
    "Add another item?",
    "Item 4 - Description",
    "Item 4 - Amazon URL",
    "Item 4 - Quantity",
    "Item 4 - Unit Price ($)",
    "Add another item?",
    "Item 5 - Description",
    "Item 5 - Amazon URL",
    "Item 5 - Quantity",
    "Item 5 - Unit Price ($)",
  ]);
  amazon.setFrozenRows(1);
  console.log("   ✅ Amazon");

  // Warehouse
  const warehouse = autoHub.insertSheet("Warehouse");
  warehouse.appendRow([
    "Timestamp",
    "Email Address",
    "Item 1 - Catalog ID",
    "Item 1 - Quantity",
    "Add another item?",
    "Item 2 - Catalog ID",
    "Item 2 - Quantity",
    "Add another item?",
    "Item 3 - Catalog ID",
    "Item 3 - Quantity",
    "Add another item?",
    "Item 4 - Catalog ID",
    "Item 4 - Quantity",
    "Add another item?",
    "Item 5 - Catalog ID",
    "Item 5 - Quantity",
  ]);
  warehouse.setFrozenRows(1);
  console.log("   ✅ Warehouse");

  // WarehouseCatalog — migrate existing catalog data
  const catalog = autoHub.insertSheet("WarehouseCatalog");
  catalog.appendRow([
    "Stock Number",
    "Item Description",
    "Price",
    "UOM",
    "Category",
  ]);
  catalog.setFrozenRows(1);
  try {
    const oldAutoHub = SpreadsheetApp.openById(OLD_AUTO_HUB);
    const oldCatalog = oldAutoHub.getSheetByName("WarehouseCatalog");
    if (oldCatalog && oldCatalog.getLastRow() > 1) {
      const catData = oldCatalog
        .getRange(2, 1, oldCatalog.getLastRow() - 1, oldCatalog.getLastColumn())
        .getValues();
      if (catData.length > 0) {
        catalog
          .getRange(2, 1, catData.length, catData[0].length)
          .setValues(catData);
        console.log(
          `   ✅ WarehouseCatalog (migrated ${catData.length} items)`,
        );
      }
    } else {
      console.log("   ✅ WarehouseCatalog (empty)");
    }
  } catch (e) {
    console.warn(
      `   ⚠️ WarehouseCatalog created but migration failed: ${e.message}`,
    );
  }

  // AutomatedQueue
  const autoQueue = autoHub.insertSheet("AutomatedQueue");
  autoQueue.appendRow([
    "TransactionID",
    "Requestor",
    "RequestType",
    "Department",
    "Division",
    "Amount",
    "Description",
    "Status",
    "Requested",
    "Approved",
    "Processed",
    "ResponseID",
  ]);
  autoQueue.setFrozenRows(1);
  console.log("   ✅ AutomatedQueue");

  // System Config
  const autoConfig = autoHub.insertSheet("System Config");
  autoConfig.appendRow(["Property", "Value", "Description", "Last Updated"]);
  autoConfig.setFrozenRows(1);
  console.log("   ✅ System Config");

  // ── 3. MANUAL HUB ──
  console.log("");
  console.log("📝 Creating Manual Hub...");
  const manualHub = SpreadsheetApp.create("KCS Manual Hub");
  const manualHubId = manualHub.getId();
  console.log(`   Created: ${manualHubId}`);

  // Field Trip
  const fieldTrip = manualHub.getSheets()[0];
  fieldTrip.setName("Field Trip");
  fieldTrip.appendRow([
    "Timestamp",
    "Email Address",
    "Field Trip Destination",
    "Trip Date",
    "Number of Students",
    "Transportation",
    "Quoted Cost",
    "Upload Quote/PO",
  ]);
  fieldTrip.setFrozenRows(1);
  console.log("   ✅ Field Trip");

  // Curriculum
  const curriculum = manualHub.insertSheet("Curriculum");
  curriculum.appendRow([
    "Timestamp",
    "Email Address",
    "Type of Curriculum Request",
    "Resource Name/Title",
    "Grade Level(s)",
    "Quantity",
    "Unit Price ($)",
    "Entry Method",
    "Publisher/Vendor",
    "Link to resource",
    "Purpose",
    "Upload PDF Quote",
    "Purpose (PDF path)",
  ]);
  curriculum.setFrozenRows(1);
  console.log("   ✅ Curriculum");

  // Admin
  const admin = manualHub.insertSheet("Admin");
  admin.appendRow([
    "Timestamp",
    "Email Address",
    "Purchase Description",
    "Amount ($)",
    "Category",
    "Upload the PO/Receipt",
    "Additional Notes",
  ]);
  admin.setFrozenRows(1);
  console.log("   ✅ Admin");

  // ManualQueue
  const manualQueue = manualHub.insertSheet("ManualQueue");
  manualQueue.appendRow([
    "TransactionID",
    "Requestor",
    "RequestType",
    "Department",
    "Division",
    "Amount",
    "Description",
    "Status",
    "Requested",
    "Approved",
    "Processed",
    "ResponseID",
  ]);
  manualQueue.setFrozenRows(1);
  console.log("   ✅ ManualQueue");

  // System Config
  const manualConfig = manualHub.insertSheet("System Config");
  manualConfig.appendRow(["Property", "Value", "Description", "Last Updated"]);
  manualConfig.setFrozenRows(1);
  console.log("   ✅ System Config");

  // ── SHARE WITH UAT USERS ──
  console.log("");
  console.log("👥 Sharing with UAT users...");
  const uatUsers = [
    "nstratis@keswickchristian.org",
    "bendrulat@keswickchristian.org",
    "sneel@keswickchristian.org",
    "mtrotter@keswickchristian.org",
  ];

  [budgetHub, autoHub, manualHub].forEach((hub) => {
    uatUsers.forEach((user) => {
      try {
        hub.addEditor(user);
      } catch (e) {
        console.warn(
          `   ⚠️ Could not add ${user} to ${hub.getName()}: ${e.message}`,
        );
      }
    });
    console.log(`   ✅ Shared ${hub.getName()} with ${uatUsers.length} users`);
  });

  // ── SUMMARY ──
  console.log("");
  console.log("═══════════════════════════════════════════════════════");
  console.log("  🎉 ALL 3 HUBS CREATED SUCCESSFULLY");
  console.log("═══════════════════════════════════════════════════════");
  console.log("");
  console.log(
    "UPDATE THESE IDs IN Config.gs, Invoicing Arm/Main.gs, Dashboard Arm/Dashboard_BE.gs:",
  );
  console.log("");
  console.log(`  BUDGET_HUB_ID:    '${budgetHubId}'`);
  console.log(`  AUTOMATED_HUB_ID: '${autoHubId}'`);
  console.log(`  MANUAL_HUB_ID:    '${manualHubId}'`);
  console.log("");
  console.log("SPREADSHEET URLS:");
  console.log(
    `  Budget Hub:    https://docs.google.com/spreadsheets/d/${budgetHubId}/edit`,
  );
  console.log(
    `  Automated Hub: https://docs.google.com/spreadsheets/d/${autoHubId}/edit`,
  );
  console.log(
    `  Manual Hub:    https://docs.google.com/spreadsheets/d/${manualHubId}/edit`,
  );
  console.log("");
  console.log("NEXT STEPS:");
  console.log("1. Copy the 3 IDs above and paste them back here");
  console.log("2. Link each Google Form to the correct hub:");
  console.log('   - Amazon form     -> Automated Hub > "Amazon" sheet');
  console.log('   - Warehouse form  -> Automated Hub > "Warehouse" sheet');
  console.log('   - Field Trip form -> Manual Hub > "Field Trip" sheet');
  console.log('   - Curriculum form -> Manual Hub > "Curriculum" sheet');
  console.log('   - Admin form      -> Manual Hub > "Admin" sheet');
  console.log("3. Run setupAllTriggers() to re-register form triggers");

  // Store new IDs in Script Properties for easy retrieval
  const props = PropertiesService.getScriptProperties();
  props.setProperties({
    BUDGET_HUB_ID: budgetHubId,
    AUTOMATED_HUB_ID: autoHubId,
    MANUAL_HUB_ID: manualHubId,
  });
  console.log("");
  console.log(
    "✅ New IDs also saved to Script Properties (CONFIG will pick them up via getDyn)",
  );
}

// ============================================================================
// CLEANUP OLD HUBS
// ============================================================================
// Moves old hub spreadsheets to trash. Run AFTER confirming new hubs work.
// Only trashes the 3 OLD hub spreadsheets — does NOT touch forms or new hubs.
// ============================================================================

function cleanupOldHubs() {
  console.log("🗑️ === CLEANING UP OLD HUB SPREADSHEETS ===");
  console.log("");

  // Old hub IDs to trash
  const oldHubs = [
    {
      name: "Old Budget Hub",
      id: "1wbv44RU18vJXlImWwxf4VRX932LgWCTBEn6JNws9HhQ",
    },
    {
      name: "Old Automated Hub",
      id: "1CfktVXDNTY499U7zgkBVJ0DyBePH_BsYJeMtwyaxolM",
    },
    {
      name: "Old Manual Hub",
      id: "1-t7YnyVvk0vxqbKGNteNHOQ92XOJNme4eJPjxVRVI5M",
    },
  ];

  // Verify new hubs are accessible first
  const newHubs = [
    { name: "New Budget Hub", id: CONFIG.BUDGET_HUB_ID },
    { name: "New Automated Hub", id: CONFIG.AUTOMATED_HUB_ID },
    { name: "New Manual Hub", id: CONFIG.MANUAL_HUB_ID },
  ];

  console.log("Verifying new hubs are accessible...");
  for (const hub of newHubs) {
    try {
      const ss = SpreadsheetApp.openById(hub.id);
      console.log(
        `   ✅ ${hub.name}: "${ss.getName()}" (${ss.getSheets().length} sheets)`,
      );
    } catch (e) {
      console.error(
        `   ❌ ${hub.name} (${hub.id}) NOT ACCESSIBLE: ${e.message}`,
      );
      console.error("ABORTING CLEANUP — fix new hub access first.");
      return;
    }
  }

  console.log("");
  console.log("Trashing old hubs...");
  for (const hub of oldHubs) {
    try {
      const file = DriveApp.getFileById(hub.id);
      const fileName = file.getName();
      file.setTrashed(true);
      console.log(`   🗑️ ${hub.name}: "${fileName}" -> TRASHED`);
    } catch (e) {
      console.warn(`   ⚠️ ${hub.name} (${hub.id}): ${e.message}`);
      console.warn("      (May not have access or already trashed)");
    }
  }

  console.log("");
  console.log(
    "✅ Cleanup complete. Old hubs are in Trash (recoverable for 30 days).",
  );
  console.log("   New hubs are now the sole active hubs.");
}
