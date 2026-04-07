/**
 * ============================================================================
 * FORMS ENGINE
 * ============================================================================
 * Handles all Google Form submissions and routing logic.
 *
 * COLUMN_MAP: Named column indices for each form's response sheet.
 * Run dumpAllFormStructures() in Form_Diagnostic.gs to get current values,
 * then update these constants. Column indices are 0-based (matching row[n]).
 */

const COLUMN_MAP = {
  // Amazon: 5 items with desc/url/qty/price, branching "Add another?" at cols 6,11,16,21
  // No total column — total is calculated from item prices
  AMAZON: {
    EMAIL: 1,
    ITEM1_DESC: 2,
    ITEM1_URL: 3,
    ITEM1_QTY: 4,
    ITEM1_PRICE: 5,
    // col 6 = "Add another item?" (branching)
    ITEM2_DESC: 7,
    ITEM2_URL: 8,
    ITEM2_QTY: 9,
    ITEM2_PRICE: 10,
    // col 11 = "Add another item?" (branching)
    ITEM3_DESC: 12,
    ITEM3_URL: 13,
    ITEM3_QTY: 14,
    ITEM3_PRICE: 15,
    // col 16 = "Add another item?" (branching)
    ITEM4_DESC: 17,
    ITEM4_URL: 18,
    ITEM4_QTY: 19,
    ITEM4_PRICE: 20,
    // col 21 = "Add another item?" (branching)
    ITEM5_DESC: 22,
    ITEM5_URL: 23,
    ITEM5_QTY: 24,
    ITEM5_PRICE: 25,
    // No TOTAL column — removed from form. Handler calculates from items.
  },
  // Warehouse: Catalog ID + Quantity per item
  // Description and price are looked up from the WarehouseCatalog sheet
  // Branching "Add another?" at cols 4, 7, 10, 13
  WAREHOUSE: {
    EMAIL: 1,
    ITEM1_ID: 2,
    ITEM1_QTY: 3,
    // col 4 = "Add another item?" (branching)
    ITEM2_ID: 5,
    ITEM2_QTY: 6,
    // col 7 = "Add another item?" (branching)
    ITEM3_ID: 8,
    ITEM3_QTY: 9,
    // col 10 = "Add another item?" (branching)
    ITEM4_ID: 11,
    ITEM4_QTY: 12,
    // col 13 = "Add another item?" (branching)
    ITEM5_ID: 14,
    ITEM5_QTY: 15,
  },
  // Field Trip: Unchanged
  FIELD_TRIP: {
    EMAIL: 1,
    DESTINATION: 2,
    TRIP_DATE: 3,
    NUM_STUDENTS: 4,
    TRANSPORTATION: 5,
    TOTAL_COST: 6,
    PDF_UPLOAD: 7,
  },
  // Curriculum: Restructured with branching (manual entry vs PDF upload)
  CURRICULUM: {
    EMAIL: 1,
    TYPE: 2,
    RESOURCE_NAME: 3,
    GRADE_LEVELS: 4,
    QUANTITY: 5,
    UNIT_PRICE: 6,
    ENTRY_METHOD: 7,
    PUBLISHER: 8,
    LINK: 9,
    PURPOSE: 10,
    PDF_UPLOAD: 11,
    PURPOSE_PDF: 12,
  },
  // Admin: Added Category and Notes columns
  ADMIN: {
    EMAIL: 1,
    DESCRIPTION: 2,
    AMOUNT: 3,
    CATEGORY: 4,
    PDF_UPLOAD: 5,
    NOTES: 6,
  },
};

// ============================================================================
// FISCAL YEAR LOCKDOWN UTILITIES
// ============================================================================

/**
 * Checks if the fiscal year is in lockdown (June 29-30)
 */
function isFiscalYearLocked() {
  const now = new Date();
  // Month is 0-indexed (5 = June), Date is 1-31
  if (now.getMonth() === 5 && now.getDate() >= 29) {
    return true;
  }
  return false;
}

/**
 * Helper to handle locked submissions
 */
function handleLockedSubmission(email, formName) {
  try {
    MailApp.sendEmail({
      to: email,
      subject: `Request Rejected - Fiscal Year Closed (${formName})`,
      body: `Your ${formName} request was rejected because the fiscal year is currently closed for reconciliation.\n\nThe system will resume accepting new orders on July 1st.`
    });
    console.log(`🔒 Rejected submission from ${email} due to fiscal year lockdown.`);
  } catch (e) {
    console.error(`Failed to send lockdown rejection to ${email}: ${e.message}`);
  }
}

// Helper to build item mappings arrays from COLUMN_MAP
function getAmazonItemMappings() {
  const m = COLUMN_MAP.AMAZON;
  return [
    {
      descCol: m.ITEM1_DESC,
      urlCol: m.ITEM1_URL,
      qtyCol: m.ITEM1_QTY,
      priceCol: m.ITEM1_PRICE,
    },
    {
      descCol: m.ITEM2_DESC,
      urlCol: m.ITEM2_URL,
      qtyCol: m.ITEM2_QTY,
      priceCol: m.ITEM2_PRICE,
    },
    {
      descCol: m.ITEM3_DESC,
      urlCol: m.ITEM3_URL,
      qtyCol: m.ITEM3_QTY,
      priceCol: m.ITEM3_PRICE,
    },
    {
      descCol: m.ITEM4_DESC,
      urlCol: m.ITEM4_URL,
      qtyCol: m.ITEM4_QTY,
      priceCol: m.ITEM4_PRICE,
    },
    {
      descCol: m.ITEM5_DESC,
      urlCol: m.ITEM5_URL,
      qtyCol: m.ITEM5_QTY,
      priceCol: m.ITEM5_PRICE,
    },
  ];
}

function getWarehouseItemMappings() {
  const m = COLUMN_MAP.WAREHOUSE;
  return [
    { idCol: m.ITEM1_ID, qtyCol: m.ITEM1_QTY },
    { idCol: m.ITEM2_ID, qtyCol: m.ITEM2_QTY },
    { idCol: m.ITEM3_ID, qtyCol: m.ITEM3_QTY },
    { idCol: m.ITEM4_ID, qtyCol: m.ITEM4_QTY },
    { idCol: m.ITEM5_ID, qtyCol: m.ITEM5_QTY },
  ];
}

// ============================================================================
// QUEUE SHEET HELPER
// ============================================================================

/**
 * Gets or creates the queue sheet for form processing.
 * This ensures processing doesn't fail if sheets are missing.
 * @param {Spreadsheet} hub - The hub spreadsheet
 * @param {string} sheetName - 'AutomatedQueue' or 'ManualQueue'
 * @returns {Sheet} The queue sheet
 */
function getOrCreateQueueSheet(hub, sheetName) {
  let queueSheet = hub.getSheetByName(sheetName);

  if (!queueSheet) {
    console.warn(`⚠️ ${sheetName} not found, creating...`);
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

    queueSheet = hub.insertSheet(sheetName);
    queueSheet.getRange(1, 1, 1, queueHeaders.length).setValues([queueHeaders]);
    queueSheet.setFrozenRows(1);

    // Format header
    const headerRange = queueSheet.getRange(1, 1, 1, queueHeaders.length);
    headerRange.setBackground(
      sheetName === "AutomatedQueue" ? "#1565C0" : "#2E7D32",
    );
    headerRange.setFontColor("#FFFFFF");
    headerRange.setFontWeight("bold");

    console.log(`✅ ${sheetName} created`);
  }

  return queueSheet;
}

/**
 * Safely writes a TransactionID to precisely the 'TransactionID' column.
 * It will create the column if it doesn't exist, but it will never endlessly append.
 */
function safelyWriteTransactionId(sheet, rowIndex, transactionId) {
  try {
    const lastCol = sheet.getLastColumn() || 1;
    let headers = [];
    if (lastCol > 0) {
      headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    }

    let txCol = headers.indexOf("TransactionID") + 1;
    if (txCol === 0) {
      // Not found, create it at the end
      txCol = lastCol + 1;
      sheet.getRange(1, txCol).setValue("TransactionID");
    }

    sheet.getRange(rowIndex, txCol).setValue(transactionId);
  } catch (error) {
    console.error("Error safely writing transaction ID to form sheet:", error);
  }
}

// ============================================================================
// AMAZON FORM PROCESSING
// ============================================================================

function processAmazonFormSubmission(e) {
  console.log("🚀 === AMAZON FORM PROCESSING START ===");

  const response = e.response;
  const email = response.getRespondentEmail();

  // CHECK FOR FISCAL YEAR LOCKDOWN
  if (isFiscalYearLocked()) {
    handleLockedSubmission(email, "Amazon Order");
    return;
  }

  let step = 0;

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (lockErr) {
    console.error("❌ Lock timeout:", lockErr);
    throw new Error("System busy (Lock timeout)");
  }

  try {
    step = 1;
    console.log(`📍 Step ${step}: Getting response info`);
    const response = e.response;
    const responseId = response.getId();
    const timestamp = new Date();
    console.log(`   ResponseID: ${responseId}, Timestamp: ${timestamp}`);

    step = 2;
    console.log(`📍 Step ${step}: Waiting for sheet sync (3s)`);
    Utilities.sleep(3000);

    step = 3;
    console.log(`📍 Step ${step}: Opening Automated Hub`);
    const autoHub = SpreadsheetApp.openById(CONFIG.AUTOMATED_HUB_ID);
    console.log(`   Hub opened: ${autoHub.getName()}`);

    step = 4;
    console.log(`📍 Step ${step}: Getting Amazon sheet`);
    const amazonSheet = autoHub.getSheetByName("Amazon");
    if (!amazonSheet) {
      throw new Error("Amazon sheet not found in Automated Hub");
    }
    console.log(`   Amazon sheet found`);

    step = 5;
    console.log(`📍 Step ${step}: Reading Amazon data`);
    const data = amazonSheet.getDataRange().getValues();
    validateFormColumns("AMAZON", data[0]);
    const lastRowIndex = data.length - 1;
    const row = data[lastRowIndex];
    console.log(
      `   Total rows: ${data.length}, Reading row: ${lastRowIndex + 1}`,
    );

    step = 6;
    console.log(`📍 Step ${step}: Extracting email`);
    const email = row[COLUMN_MAP.AMAZON.EMAIL];
    console.log(`   Email: "${email}"`);

    step = 7;
    console.log(`📍 Step ${step}: Validating email`);
    if (!email || !email.includes("@")) {
      throw new Error(`Invalid email address: "${email}"`);
    }
    console.log(`   Email valid`);

    step = 8;
    console.log(
      `📍 Step ${step}: Extracting items (total calculated from items)`,
    );

    step = 9;
    console.log(`📍 Step ${step}: Extracting Amazon items`);
    const amazonItems = [];
    const itemMappings = getAmazonItemMappings();

    itemMappings.forEach((mapping, index) => {
      const description = row[mapping.descCol];
      const url = row[mapping.urlCol];
      const quantity = parseInt(row[mapping.qtyCol]) || 0;
      const unitPrice =
        parseFloat(String(row[mapping.priceCol]).replace(/[$,]/g, "")) || 0;

      if (description && url && quantity > 0 && unitPrice > 0) {
        amazonItems.push({
          description: description,
          url: url,
          quantity: quantity,
          unitPrice: unitPrice,
          totalPrice: quantity * unitPrice,
        });
        console.log(
          `   Item ${index + 1}: "${description}" x${quantity} @ $${unitPrice}`,
        );
      }
    });
    console.log(`   Total items found: ${amazonItems.length}`);

    step = 10;
    console.log(`📍 Step ${step}: Validating items`);
    if (amazonItems.length === 0) {
      throw new Error("No valid Amazon items found");
    }

    // Total is always calculated from parsed items (no Total column on form)
    const totalAmount_FIXED = amazonItems.reduce(
      (sum, item) => sum + item.totalPrice,
      0,
    );
    console.log(`📊 Final Amazon total: $${totalAmount_FIXED}`);

    step = 11;
    console.log(`📍 Step ${step}: Looking up user budget for "${email}"`);
    const userBudget = getUserBudgetInfo(email);
    console.log(`   User budget result: ${userBudget ? "FOUND" : "NULL"}`);
    if (userBudget) {
      console.log(
        `   Department: ${userBudget.department}, Allocated: $${userBudget.allocated}, Available: $${userBudget.available}`,
      );
    }

    if (!userBudget) {
      console.error(`❌ User not found: ${email}`);
      sendErrorNotification(
        email,
        "UNKNOWN",
        "AMAZON",
        "User not found in directory",
      );
      throw new Error(`User ${email} not found in directory`);
    }

    step = 12;
    console.log(`📍 Step ${step}: Generating transaction ID`);
    const division = getDivisionFromDepartment(userBudget.department);
    const transactionId = generateSequentialTransactionId("AMAZON", division);
    console.log(`   Transaction ID: ${transactionId}`);

    // Validate Amazon URLs and ASIN extraction
    console.log(`📍 Step 12b: Validating Amazon URLs/ASINs`);
    if (!validateAmazonOrder(transactionId, amazonItems, email)) {
      console.log(
        "❌ Amazon order failed ASIN validation — requestor notified",
      );
      return;
    }

    step = 13;
    console.log(`📍 Step ${step}: Writing transaction ID to Amazon sheet`);
    safelyWriteTransactionId(amazonSheet, lastRowIndex + 1, transactionId);
    console.log(`   Transaction ID written to row ${lastRowIndex + 1}`);

    step = 14;
    console.log(`📍 Step ${step}: Getting AutomatedQueue sheet`);
    const queueSheet = getOrCreateQueueSheet(autoHub, "AutomatedQueue");
    console.log(`   Queue sheet: ${queueSheet.getName()}`);

    step = 15;
    console.log(`📍 Step ${step}: Creating description`);
    const description = createFormattedMultiItemDescription(amazonItems);
    console.log(`   Description: "${description.substring(0, 50)}..."`);

    step = 16;
    console.log(`📍 Step ${step}: Appending to queue`);
    const queueData = [
      transactionId,
      email,
      "AMAZON",
      userBudget.department,
      getDivisionFromDepartment(userBudget.department),
      totalAmount_FIXED,
      description,
      "PENDING",
      timestamp,
      "",
      "",
      responseId,
    ];
    console.log(`   Queue data: ${JSON.stringify(queueData.slice(0, 4))}...`);
    queueSheet.appendRow(queueData);
    console.log(`   ✅ Queue entry appended!`);

    step = 17;
    console.log(`📍 Step ${step}: Updating encumbrance`);
    updateUserEncumbranceRealTime(email, totalAmount_FIXED, "add");

    step = 18;
    console.log(`📍 Step ${step}: Calculating approval logic`);
    const budgetAvailable =
      userBudget.allocated - userBudget.spent - userBudget.encumbered;
    const withinBudget = totalAmount_FIXED <= budgetAvailable;
    const belowAutoApproval = totalAmount_FIXED < CONFIG.AUTO_APPROVAL_LIMIT;
    console.log(
      `   Available: $${budgetAvailable}, Within: ${withinBudget}, Below limit: ${belowAutoApproval}`,
    );

    step = 19;
    console.log(`📍 Step ${step}: Checking velocity`);
    const velocityCheck = checkDailySpendingVelocity(email, totalAmount_FIXED);
    console.log(
      `   Velocity: allowed=${velocityCheck.allowed}, daily=$${velocityCheck.dailyTotal}`,
    );

    step = 20;
    if (belowAutoApproval && withinBudget && velocityCheck.allowed) {
      console.log(`📍 Step ${step}: AUTO-APPROVING`);
      const actualApprover = getApproverForRequest(
        { amount: totalAmount_FIXED },
        userBudget,
      );
      updateQueueStatus(transactionId, "APPROVED", actualApprover, true);
      logSystemEvent("AMAZON_AUTO_APPROVAL", email, totalAmount_FIXED, {
        transactionId,
        approver: actualApprover,
      });
      // Do NOT send the generic Approval Notification immediately for Amazon.
      // The Amazon workflow engine will send the true Amazon Confirmed Receipt email momentarily.

      if (CONFIG.AMAZON_B2B && CONFIG.AMAZON_B2B.ENABLED) {
        new AmazonWorkflowEngine().dispatchAmazonOrder(transactionId, {
          email: email,
          department: userBudget.department,
          amount: totalAmount_FIXED,
          description: description,
        });
      }
    } else {
      console.log(`📍 Step ${step}: REQUESTING APPROVAL`);
      const approver = getApproverForRequest(
        { amount: totalAmount_FIXED },
        userBudget,
      );
      console.log(`   Approver: ${approver}`);

      if (belowAutoApproval && !velocityCheck.allowed) {
        logSystemEvent(
          "AUTO_APPROVAL_DENIED_VELOCITY",
          email,
          totalAmount_FIXED,
          {
            transactionId,
            dailyTotal: velocityCheck.dailyTotal,
            limit: velocityCheck.limit,
          },
        );
      }

      sendEnhancedApprovalEmail(approver, {
        transactionId,
        type: "Amazon Order",
        amount: totalAmount_FIXED,
        requestor: email,
        description,
        items: amazonItems,
        budgetContext: {
          available: budgetAvailable,
          withinBudget,
          utilization: (
            (userBudget.spent / userBudget.allocated) *
            100
          ).toFixed(1),
        },
      });
      logSystemEvent("AMAZON_APPROVAL_REQUESTED", email, totalAmount_FIXED, {
        transactionId,
        approver,
      });
      console.log(`   ✅ Approval email sent to ${approver}`);
    }

    console.log("🎉 === AMAZON FORM PROCESSING COMPLETE ===");
  } catch (error) {
    console.error(`❌ AMAZON ERROR at Step ${step}:`, error.message);
    console.error("   Stack:", error.stack);
    try {
      handleCriticalError(e.response?.getId() || "UNKNOWN", "AMAZON", error, {
        step: step,
      });
    } catch (logError) {
      console.error("❌ handleCriticalError also failed:", logError.message);
    }
  } finally {
    lock.releaseLock();
    console.log("🔓 Lock released");
  }
}

// ============================================================================
// WAREHOUSE FORM PROCESSING
// ============================================================================

/**
 * Looks up a warehouse catalog item by stock number.
 * Reads from the WarehouseCatalog sheet in the Automated Hub.
 * Columns: A=Stock Number, B=Item Description, C=Price, D=UOM, E=Category
 *
 * @param {string} stockNumber - The catalog stock number to look up
 * @returns {Object|null} { description, unitPrice, uom, category } or null if not found
 */
function lookupWarehouseCatalogItem(stockNumber) {
  const autoHub = SpreadsheetApp.openById(CONFIG.AUTOMATED_HUB_ID);
  const catalog = autoHub.getSheetByName("WarehouseCatalog");
  if (!catalog) {
    console.warn("⚠️ WarehouseCatalog sheet not found in Automated Hub");
    return null;
  }

  const data = catalog.getDataRange().getValues();
  const normalizedId = String(stockNumber).trim().toUpperCase();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toUpperCase() === normalizedId) {
      return {
        description: String(data[i][1] || ""),
        unitPrice: parseFloat(String(data[i][2]).replace(/[$,]/g, "")) || 0,
        uom: String(data[i][3] || ""),
        category: String(data[i][4] || ""),
      };
    }
  }

  console.warn(`⚠️ Catalog item not found: ${stockNumber}`);
  return null;
}

function processWarehouseFormSubmission(e) {
  const response = e.response;
  const email = response.getRespondentEmail();

  // CHECK FOR FISCAL YEAR LOCKDOWN
  if (isFiscalYearLocked()) {
    handleLockedSubmission(email, "Warehouse Order");
    return;
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (e) {
    throw new Error("System busy (Lock timeout)");
  }

  console.log("🏪 === WAREHOUSE FORM PROCESSING START ===");

  try {
    const response = e.response;
    const responseId = response.getId();
    const timestamp = new Date();

    Utilities.sleep(5000); // Wait for sheet update

    // Read from the Warehouse tab in the Automated Hub (matches COLUMN_MAP)
    const autoHub = SpreadsheetApp.openById(CONFIG.AUTOMATED_HUB_ID);
    const warehouseSheet = autoHub.getSheetByName("Warehouse");
    if (!warehouseSheet) {
      throw new Error("Warehouse sheet not found in Automated Hub");
    }
    const data = warehouseSheet.getDataRange().getValues();
    validateFormColumns("WAREHOUSE", data[0]);

    // Find the actual submission row by matching timestamp
    let submissionRow = null;
    let submissionRowIndex = -1;

    for (let i = data.length - 1; i >= 1; i--) {
      const row = data[i];
      if (row[0] && row[1] && row[1].toString().includes("@")) {
        const rowTimestamp = new Date(row[0]);
        if (Math.abs(rowTimestamp - timestamp) < 120000) {
          // 2 minutes
          submissionRow = row;
          submissionRowIndex = i;
          break;
        }
      }
    }

    if (!submissionRow) {
      throw new Error("Could not find warehouse form submission data");
    }

    // Process the found submission row
    const email = submissionRow[COLUMN_MAP.WAREHOUSE.EMAIL].toString().trim();

    if (!email || !email.includes("@")) {
      throw new Error(`Invalid email: ${email}`);
    }

    // Extract warehouse items — form collects Catalog ID + Quantity
    // Description and pricing are looked up from the WarehouseCatalog sheet
    const warehouseItems = [];
    const itemMappings = getWarehouseItemMappings();
    const invalidItems = [];

    itemMappings.forEach((mapping, index) => {
      const itemId = String(submissionRow[mapping.idCol] || "").trim();
      const quantity = parseInt(submissionRow[mapping.qtyCol]) || 0;

      if (itemId && quantity > 0) {
        let catalogItem = null;
        try {
          catalogItem = lookupWarehouseCatalogItem(itemId);
        } catch (lookupErr) {
          console.warn(
            `⚠️ Catalog lookup failed for ${itemId}: ${lookupErr.message}`,
          );
        }

        if (!catalogItem) {
          invalidItems.push(itemId);
          console.warn(`⚠️ Invalid catalog ID: ${itemId}`);
        } else {
          warehouseItems.push({
            itemId: itemId,
            description: catalogItem.description || `Warehouse Item ${itemId}`,
            quantity: quantity,
            unitPrice: catalogItem.unitPrice || 0,
            totalPrice: (catalogItem.unitPrice || 0) * quantity,
          });
          console.log(
            `   Item ${index + 1}: ID="${itemId}" x${quantity} @ $${catalogItem.unitPrice || 0}`,
          );
        }
      }
    });

    // If any catalog IDs were invalid, notify the requestor and stop processing
    if (invalidItems.length > 0) {
      console.error(`❌ Invalid catalog IDs: ${invalidItems.join(", ")}`);
      sendSubmissionErrorEmail(email, {
        formType: "Warehouse Request",
        errorMessage: `The following Catalog ID(s) were not found: ${invalidItems.join(", ")}. Please verify the correct Stock Numbers from the warehouse catalog and resubmit your request.`,
        items: invalidItems,
      });
      return;
    }

    // Calculate total from looked-up prices
    let totalCost = warehouseItems.reduce(
      (sum, item) => sum + item.totalPrice,
      0,
    );
    console.log(
      `📊 Warehouse total: $${totalCost} (${warehouseItems.length} items)`,
    );

    if (warehouseItems.length === 0) {
      throw new Error("No valid warehouse items found in submission");
    }

    const userBudget = getUserBudgetInfo(email);
    if (!userBudget) {
      throw new Error(`User ${email} not found in directory`);
    }

    const division = getDivisionFromDepartment(userBudget.department);
    const transactionId = generateSequentialTransactionId(
      "WAREHOUSE",
      division,
    );

    safelyWriteTransactionId(
      warehouseSheet,
      submissionRowIndex + 1,
      transactionId,
    );

    const queueSheet = getOrCreateQueueSheet(autoHub, "AutomatedQueue");
    const description = warehouseItems
      .map((item) =>
        item.quantity > 1
          ? `${item.quantity}x ${item.description}`
          : item.description,
      )
      .join(", ");

    queueSheet.appendRow([
      transactionId,
      email,
      "WAREHOUSE",
      userBudget.department,
      getDivisionFromDepartment(userBudget.department),
      totalCost,
      description,
      "PENDING",
      timestamp,
      "",
      "",
      responseId,
    ]);

    updateUserEncumbranceRealTime(email, totalCost, "add");

    // Approval Logic
    const budgetAvailable =
      userBudget.allocated - userBudget.spent - userBudget.encumbered;
    const withinBudget = totalCost <= budgetAvailable;
    const belowAutoApproval = totalCost < CONFIG.AUTO_APPROVAL_LIMIT;

    if (belowAutoApproval && withinBudget) {
      const actualApprover = getApproverForRequest(
        { amount: totalCost },
        userBudget,
      );
      updateQueueStatus(transactionId, "APPROVED", actualApprover, true);
      sendApprovalNotification(email, {
        transactionId: transactionId,
        amount: totalCost,
        type: "Warehouse Request",
        description: description,
        approver: actualApprover,
      });
    } else {
      const approver = getApproverForRequest({ amount: totalCost }, userBudget);
      sendEnhancedApprovalEmail(approver, {
        transactionId,
        type: "Warehouse Request",
        amount: totalCost,
        requestor: email,
        description,
        items: warehouseItems,
        budgetContext: {
          available: budgetAvailable,
          withinBudget,
          utilization: (
            (userBudget.spent / userBudget.allocated) *
            100
          ).toFixed(1),
        },
      });
    }

    console.log("🏪 === WAREHOUSE PROCESSING COMPLETE ===");
  } catch (error) {
    console.error("❌ WAREHOUSE ERROR:", error);
    handleProcessingError(e, error);
  } finally {
    lock.releaseLock();
  }
}

// ============================================================================
// FIELD TRIP FORM PROCESSING
// ============================================================================

function processFieldTripFormSubmission(e) {
  const response = e.response;
  const email = response.getRespondentEmail();

  // CHECK FOR FISCAL YEAR LOCKDOWN
  if (isFiscalYearLocked()) {
    handleLockedSubmission(email, "Field Trip Request");
    return;
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (e) {
    throw new Error("System busy (Lock timeout)");
  }

  try {
    console.log("🚌 === FIELD TRIP FORM PROCESSING START ===");
    const response = e.response;
    const responseId = response.getId();
    const timestamp = new Date();

    Utilities.sleep(3000);

    const manualHub = SpreadsheetApp.openById(CONFIG.MANUAL_HUB_ID);
    const formSheet = manualHub.getSheetByName("Field Trip");
    const data = formSheet.getDataRange().getValues();
    validateFormColumns("FIELD_TRIP", data[0]);
    const lastRowIndex = data.length - 1;
    const row = data[lastRowIndex];

    const ft = COLUMN_MAP.FIELD_TRIP;
    const email = row[ft.EMAIL];
    const destination = row[ft.DESTINATION];
    const tripDate = row[ft.TRIP_DATE];
    const numStudents = parseInt(row[ft.NUM_STUDENTS]) || 0;
    const transportation = row[ft.TRANSPORTATION];
    const totalCost =
      parseFloat(String(row[ft.TOTAL_COST]).replace(/[$,]/g, "")) || 0;
    const pdfUpload = row[ft.PDF_UPLOAD];

    if (!email || !email.includes("@"))
      throw new Error(`Invalid email: "${email}"`);

    const userBudget = getUserBudgetInfo(email);
    if (!userBudget) throw new Error(`User ${email} not found in directory`);

    const division = getDivisionFromDepartment(userBudget.department);
    const orgBudget = getOrganizationBudgetInfo(division);
    if (!orgBudget)
      throw new Error(`Division budget ${division} not found for Field Trip`);

    const transactionId = generateSequentialTransactionId(
      "FIELD_TRIP",
      division,
    );

    safelyWriteTransactionId(formSheet, lastRowIndex + 1, transactionId);

    // Format the date so it doesn't dump the GMT time block into the description
    let cleanDate = tripDate;
    if (
      Object.prototype.toString.call(tripDate) === "[object Date]" &&
      !isNaN(tripDate)
    ) {
      cleanDate = Utilities.formatDate(
        tripDate,
        Session.getScriptTimeZone(),
        "EEE MMM d, yyyy",
      );
    }

    const queueSheet = getOrCreateQueueSheet(manualHub, "ManualQueue");
    const description = `Field trip to ${destination} on ${cleanDate} - ${numStudents} students via ${transportation}`;

    queueSheet.appendRow([
      transactionId,
      email,
      "FIELD_TRIP",
      userBudget.department,
      division,
      totalCost,
      description,
      "PENDING",
      timestamp,
      "",
      "",
      responseId,
    ]);

    // ENFORCE DIVISION BUDGET SCOPING
    updateOrganizationEncumbranceRealTime(division);
    const budgetAvailable =
      orgBudget.allocated - orgBudget.spent - orgBudget.encumbered;
    const approver = getApproverForRequest({ amount: totalCost }, orgBudget);
    const pdfLink = pdfUpload ? extractPdfLink(pdfUpload) : null;

    // AUDIT COMPLIANCE: Escalate ONLY when submitter is their own approver AND funds are insufficient.
    // If within budget: the principal/dept head self-approves.
    // If over budget: escalate to Division Principal so someone else can review.
    const isDeptHead = email.toLowerCase() === approver.toLowerCase();
    const withinBudget = totalCost <= budgetAvailable;
    // Safely calculate per-student cost (avoid divide-by-zero)
    const safeStudentCount = parseInt(numStudents) > 0 ? parseInt(numStudents) : 1;
    const perStudentCost = totalCost / safeStudentCount;

    if (isDeptHead && !withinBudget) {
      // Over budget and self-submitting: escalate to Division Principal
      const divisionPrincipal = getDivisionPrincipal(email, division) || CONFIG.BUSINESS_OFFICE_EMAIL;
      console.log(`📍 Escalating DEPT HEAD submission (${email}) to ${divisionPrincipal} — over budget`);
      
      sendEnhancedApprovalEmail(divisionPrincipal, {
        transactionId,
        type: "Field Trip Request (Escalated — Over Budget)",
        amount: totalCost,
        requestor: email,
        description: description,
        items: [
          {
            description: `Field trip to ${destination}`,
            quantity: safeStudentCount,
            unitPrice: perStudentCost,
            totalPrice: totalCost,
          },
        ],
        budgetContext: {
          allocated: orgBudget.allocated,
          spent: orgBudget.spent,
          encumbered: orgBudget.encumbered,
          available: budgetAvailable,
          withinBudget: withinBudget,
          utilization: ((orgBudget.spent / orgBudget.allocated) * 100).toFixed(1),
        },
        pdfLink: pdfLink,
      });

      logSystemEvent("ESCALATED_SELF_SUBMISSION", email, totalCost, { 
        transactionId,
        escalatedTo: divisionPrincipal,
        reason: "Over budget"
      });
    } else if (isDeptHead && withinBudget) {
      // Within budget and self-submitting: self-approve
      console.log(`📍 Field Trip self-approval: ${email} is their own approver and within budget`);
      updateQueueStatus(transactionId, "APPROVED", email, false);
      sendApprovalNotification(email, {
        transactionId: transactionId,
        amount: totalCost,
        type: "Field Trip Request",
        description: description,
        approver: email,
      });
      logSystemEvent("FIELD_TRIP_SELF_APPROVED", email, totalCost, { transactionId });
    } else {
      sendEnhancedApprovalEmail(approver, {
        transactionId,
        type: "Field Trip Request",
        amount: totalCost,
        requestor: email,
        description: description,
        items: [
          {
            description: `Field trip to ${destination}`,
            quantity: safeStudentCount,
            unitPrice: perStudentCost,
            totalPrice: totalCost,
          },
        ],
        budgetContext: {
          allocated: orgBudget.allocated,
          spent: orgBudget.spent,
          encumbered: orgBudget.encumbered,
          available: budgetAvailable,
          withinBudget: withinBudget,
          utilization: ((orgBudget.spent / orgBudget.allocated) * 100).toFixed(1),
        },
        pdfLink: pdfLink,
      });

      logSystemEvent("FIELD_TRIP_SUBMITTED", email, totalCost, { transactionId });
    }
  } catch (error) {
    handleProcessingError(e, error);
  } finally {
    lock.releaseLock();
  }
}

// ============================================================================
// CURRICULUM FORM PROCESSING
// ============================================================================

function processCurriculumFormSubmission(e) {
  const response = e.response;
  const email = response.getRespondentEmail();

  // CHECK FOR FISCAL YEAR LOCKDOWN
  if (isFiscalYearLocked()) {
    handleLockedSubmission(email, "Curriculum Request");
    return;
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (e) {
    throw new Error("System busy (Lock timeout)");
  }

  try {
    console.log("📚 === CURRICULUM FORM PROCESSING START ===");
    const response = e.response;
    const responseId = response.getId();
    const timestamp = new Date();

    Utilities.sleep(3000);

    const manualHub = SpreadsheetApp.openById(CONFIG.MANUAL_HUB_ID);
    const formSheet = manualHub.getSheetByName("Curriculum");
    const data = formSheet.getDataRange().getValues();
    validateFormColumns("CURRICULUM", data[0]);
    const lastRowIndex = data.length - 1;
    const row = data[lastRowIndex];

    const cur = COLUMN_MAP.CURRICULUM;
    const email = row[cur.EMAIL];
    const curriculumType = row[cur.TYPE];
    const resourceName = row[cur.RESOURCE_NAME];
    const quantity = parseInt(row[cur.QUANTITY]) || 0;
    const unitPrice =
      parseFloat(String(row[cur.UNIT_PRICE]).replace(/[$,]/g, "")) || 0;
    const totalCost = quantity * unitPrice;
    const pdfUpload = row[cur.PDF_UPLOAD];
    const itemLink = row[cur.LINK] ? String(row[cur.LINK]).trim() : "";

    console.log(`📊 Curriculum: ${quantity} x $${unitPrice} = $${totalCost}`);

    if (!email || !email.includes("@"))
      throw new Error(`Invalid email: "${email}"`);

    const userBudget = getUserBudgetInfo(email);
    if (!userBudget) throw new Error(`User ${email} not found in directory`);

    const orgBudget = getOrganizationBudgetInfo(userBudget.department);
    if (!orgBudget)
      throw new Error(
        `Department budget ${userBudget.department} not found for Curriculum`,
      );

    const division = getDivisionFromDepartment(userBudget.department);

    // ========================================================================
    // NEW: AMAZON AUTO-ROUTING DETECTION
    // ========================================================================
    const isAmazonLink =
      itemLink.toLowerCase().includes("amazon.com") ||
      itemLink.toLowerCase().includes("amzn.to");
    let asin = null;
    if (isAmazonLink) {
      try {
        const testEngine = new AmazonWorkflowEngine();
        asin = testEngine.extractASIN(itemLink);
      } catch (e) {
        console.warn("Amazon form parsing failed, proceeding natively", e);
      }
    }

    if (asin) {
      console.log(
        `🔄 Curriculum Amazon Routing Detected: ASIN ${asin} found for ${resourceName}`,
      );

      const transactionId = generateSequentialTransactionId(
        "CURRICULUM_AMAZON",
        division,
      );

      safelyWriteTransactionId(formSheet, lastRowIndex + 1, transactionId);

      // Bridge to Amazon Pipeline
      const autoHub = SpreadsheetApp.openById(CONFIG.AUTOMATED_HUB_ID);
      const amazonFormData = autoHub.getSheetByName("Amazon");

      const amazonHeaders = amazonFormData
        .getRange(1, 1, 1, amazonFormData.getLastColumn())
        .getValues()[0];
      const newAmazonRow = new Array(amazonHeaders.length).fill("");
      newAmazonRow[0] = timestamp;
      newAmazonRow[1] = email;
      newAmazonRow[2] = resourceName;
      newAmazonRow[3] = itemLink;
      newAmazonRow[4] = quantity > 0 ? quantity : 1;
      newAmazonRow[5] = unitPrice;

      const txColIdx = amazonHeaders.indexOf("TransactionID");
      if (txColIdx !== -1) {
        newAmazonRow[txColIdx] = transactionId;
      } else {
        newAmazonRow[newAmazonRow.length - 1] = transactionId;
      }
      amazonFormData.appendRow(newAmazonRow);

      const queueSheet = getOrCreateQueueSheet(autoHub, "AutomatedQueue");
      const description = `[Curriculum Auto-Routed] ${resourceName} (Qty: ${quantity})`;

      queueSheet.appendRow([
        transactionId,
        email,
        "CURRICULUM_AMAZON",  // FIX #5: distinct type so budget check uses dept org budget
        userBudget.department,
        division,
        totalCost,
        description,
        "PENDING",
        timestamp,
        "",
        "",
        responseId,
      ]);

      // ENFORCE DEPARTMENT BUDGET SCOPING
      updateOrganizationEncumbranceRealTime(userBudget.department);

      const budgetAvailable =
        orgBudget.allocated - orgBudget.spent - orgBudget.encumbered;
      const withinBudget = totalCost <= budgetAvailable;

      // AUDIT COMPLIANCE: Escalate ONLY when submitter is their own approver AND funds are insufficient.
      const approver = getApproverForRequest(
        { amount: totalCost },
        orgBudget,
      );
      const isDeptHead = email.toLowerCase() === approver.toLowerCase();

      if (isDeptHead && !withinBudget) {
        // Over budget and self-submitting: escalate to Division Principal
        const divisionPrincipal = getDivisionPrincipal(email, userBudget.division) || CONFIG.BUSINESS_OFFICE_EMAIL;
        console.log(`📍 Escalating Curriculum-Amazon DEPT HEAD submission (${email}) to ${divisionPrincipal} — over budget`);
        
        sendEnhancedApprovalEmail(divisionPrincipal, {
          transactionId,
          type: "Curriculum (Amazon Auto-Routed - Escalated Over Budget)",
          amount: totalCost,
          requestor: email,
          description: description,
          items: [
            {
              description: resourceName,
              quantity: quantity || 1,
              unitPrice: unitPrice,
              totalPrice: totalCost,
            },
          ],
          budgetContext: {
            allocated: orgBudget.allocated,
            spent: orgBudget.spent,
            encumbered: orgBudget.encumbered,
            available: budgetAvailable,
            withinBudget: false,
            utilization: (
              (orgBudget.spent / orgBudget.allocated) *
              100
            ).toFixed(1),
          },
        });
        logSystemEvent("ESCALATED_SELF_SUBMISSION", email, totalCost, {
          transactionId,
          escalatedTo: divisionPrincipal,
          reason: "Over budget",
        });
      } else if (isDeptHead && withinBudget) {
        // Within budget and self-submitting: self-approve, dispatch to Amazon
        console.log(`📍 Curriculum-Amazon self-approval: ${email} is their own approver and within budget`);
        updateQueueStatus(transactionId, "APPROVED", email, true);
        if (CONFIG.AMAZON_B2B && CONFIG.AMAZON_B2B.ENABLED) {
          new AmazonWorkflowEngine().dispatchAmazonOrder(transactionId, {
            email: email,
            department: userBudget.department,
            amount: totalCost,
            description: description,
          });
        }
        logSystemEvent("CURRICULUM_AMAZON_SELF_APPROVED", email, totalCost, { transactionId });
      } else {
        console.log(`📍 Curriculum-Amazon: REQUESTING DEPT HEAD APPROVAL`);
        sendEnhancedApprovalEmail(approver, {
          transactionId,
          type: "Curriculum (Amazon Auto-Routed)",
          amount: totalCost,
          requestor: email,
          description: description,
          items: [
            {
              description: resourceName,
              quantity: quantity || 1,
              unitPrice: unitPrice,
              totalPrice: totalCost,
            },
          ],
          budgetContext: {
            allocated: orgBudget.allocated,
            spent: orgBudget.spent,
            encumbered: orgBudget.encumbered,
            available: budgetAvailable,
            withinBudget: totalCost <= budgetAvailable,
            utilization: (
              (orgBudget.spent / orgBudget.allocated) *
              100
            ).toFixed(1),
          },
        });
        logSystemEvent("AMAZON_APPROVAL_REQUESTED", email, totalCost, {
          transactionId,
          approver,
        });
      }

      return;
    }
    // ========================================================================
    // END NEW AMAZON ROUTING
    // ========================================================================

    const transactionId = generateSequentialTransactionId(
      "CURRICULUM",
      division,
    );

    safelyWriteTransactionId(formSheet, lastRowIndex + 1, transactionId);

    const queueSheet = getOrCreateQueueSheet(manualHub, "ManualQueue");
    const description = `${curriculumType} - ${resourceName}`;

    queueSheet.appendRow([
      transactionId,
      email,
      "CURRICULUM",
      userBudget.department,
      division,
      totalCost,
      description,
      "PENDING",
      timestamp,
      "",
      "",
      responseId,
    ]);

    // ENFORCE DEPARTMENT BUDGET SCOPING
    updateOrganizationEncumbranceRealTime(userBudget.department);
    const budgetAvailable =
      orgBudget.allocated - orgBudget.spent - orgBudget.encumbered;
    const approver = getApproverForRequest({ amount: totalCost }, orgBudget);
    const pdfLink = pdfUpload ? extractPdfLink(pdfUpload) : null;

    // AUDIT COMPLIANCE: Escalate ONLY when submitter is their own approver AND funds are insufficient.
    // If within budget: the dept head self-approves.
    // If over budget: escalate to Division Principal.
    const isDeptHead = email.toLowerCase() === approver.toLowerCase();
    const withinBudget = totalCost <= budgetAvailable;

    if (isDeptHead && !withinBudget) {
      // Over budget and self-submitting: escalate to Division Principal
      const divisionPrincipal = getDivisionPrincipal(email, division) || CONFIG.BUSINESS_OFFICE_EMAIL;
      console.log(`📍 Escalating DEPT HEAD submission (${email}) to ${divisionPrincipal} — over budget`);
      
      sendEnhancedApprovalEmail(divisionPrincipal, {
        transactionId,
        type: "Curriculum Request (Escalated — Over Budget)",
        amount: totalCost,
        requestor: email,
        description: description,
        items: [
          {
            description: resourceName,
            quantity: quantity || 1,
            unitPrice: unitPrice,
            totalPrice: totalCost,
          },
        ],
        budgetContext: {
          allocated: orgBudget.allocated,
          spent: orgBudget.spent,
          encumbered: orgBudget.encumbered,
          available: budgetAvailable,
          withinBudget: false,
          utilization: ((orgBudget.spent / orgBudget.allocated) * 100).toFixed(1),
        },
        pdfLink: pdfLink,
      });

      logSystemEvent("ESCALATED_SELF_SUBMISSION", email, totalCost, { 
        transactionId,
        escalatedTo: divisionPrincipal,
        reason: "Over budget"
      });
    } else if (isDeptHead && withinBudget) {
      // Within budget and self-submitting: self-approve
      console.log(`📍 Curriculum self-approval: ${email} is their own approver and within budget`);
      updateQueueStatus(transactionId, "APPROVED", email, false);
      sendApprovalNotification(email, {
        transactionId: transactionId,
        amount: totalCost,
        type: "Curriculum Request",
        description: description,
        approver: email,
      });
      logSystemEvent("CURRICULUM_SELF_APPROVED", email, totalCost, { transactionId });
    } else {
      sendEnhancedApprovalEmail(approver, {
        transactionId,
        type: "Curriculum Request",
        amount: totalCost,
        requestor: email,
        description: description,
        items: [
          {
            description: resourceName,
            quantity: quantity || 1,
            unitPrice: unitPrice,
            totalPrice: totalCost,
          },
        ],
        budgetContext: {
          allocated: orgBudget.allocated,
          spent: orgBudget.spent,
          encumbered: orgBudget.encumbered,
          available: budgetAvailable,
          withinBudget: withinBudget,
          utilization: ((orgBudget.spent / orgBudget.allocated) * 100).toFixed(1),
        },
        pdfLink: pdfLink,
      });

      logSystemEvent("CURRICULUM_APPROVAL_REQUESTED", email, totalCost, {
        transactionId,
        approver,
      });
    }
  } catch (error) {
    handleProcessingError(e, error);
  } finally {
    lock.releaseLock();
  }
}

// ============================================================================
// ADMIN FORM PROCESSING
// ============================================================================

function processAdminFormSubmission(e) {
  const response = e.response;
  const email = response.getRespondentEmail();

  // CHECK FOR FISCAL YEAR LOCKDOWN
  if (isFiscalYearLocked()) {
    handleLockedSubmission(email, "Admin Request");
    return;
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (e) {
    throw new Error("System busy (Lock timeout)");
  }

  try {
    console.log("💼 === ADMIN FORM PROCESSING START ===");
    const response = e.response;
    const responseId = response.getId();
    const timestamp = new Date();

    Utilities.sleep(3000);

    const manualHub = SpreadsheetApp.openById(CONFIG.MANUAL_HUB_ID);
    const formSheet = manualHub.getSheetByName("Admin");
    const data = formSheet.getDataRange().getValues();
    validateFormColumns("ADMIN", data[0]);
    const lastRowIndex = data.length - 1;
    const row = data[lastRowIndex];

    const adm = COLUMN_MAP.ADMIN;
    const email = row[adm.EMAIL];
    const description = row[adm.DESCRIPTION];
    const amount =
      parseFloat(String(row[adm.AMOUNT]).replace(/[$,]/g, "")) || 0;
    const pdfUpload = row[adm.PDF_UPLOAD];

    if (!email || !email.includes("@"))
      throw new Error(`Invalid email: "${email}"`);

    const userBudget = getUserBudgetInfo(email);
    if (!userBudget) throw new Error(`User ${email} not found in directory`);

    const division = getDivisionFromDepartment(userBudget.department);
    const transactionId = generateSequentialTransactionId("ADMIN", division);

    safelyWriteTransactionId(formSheet, lastRowIndex + 1, transactionId);

    const queueSheet = getOrCreateQueueSheet(manualHub, "ManualQueue");

    queueSheet.appendRow([
      transactionId,
      email,
      "ADMIN",
      userBudget.department,
      getDivisionFromDepartment(userBudget.department),
      amount,
      description,
      "PENDING",
      timestamp,
      "",
      "",
      responseId,
    ]);

    updateUserEncumbranceRealTime(email, amount, "add");
    const budgetAvailable =
      userBudget.allocated - userBudget.spent - userBudget.encumbered;
    const approver = getApproverForRequest({ amount: amount }, userBudget);

    const pdfLink = pdfUpload ? extractPdfLink(pdfUpload) : null;

    sendEnhancedApprovalEmail(approver, {
      transactionId,
      type: "Admin Purchase",
      amount: amount,
      requestor: email,
      description: description,
      items: [
        {
          description: description,
          quantity: 1,
          unitPrice: amount,
          totalPrice: amount,
        },
      ],
      budgetContext: {
        available: budgetAvailable,
        withinBudget: amount <= budgetAvailable,
        utilization: ((userBudget.spent / userBudget.allocated) * 100).toFixed(
          1,
        ),
      },
      pdfLink: pdfLink,
    });

    logSystemEvent("ADMIN_APPROVAL_REQUESTED", email, amount, {
      transactionId,
      approver,
    });
  } catch (error) {
    handleProcessingError(e, error);
  } finally {
    lock.releaseLock();
  }
}

// ============================================================================
// APPROVAL & ROUTING HELPERS
// ============================================================================

/**
 * Processes approval/rejection decision using secure token validation.
 * Validates token exists, hasn't expired, matches request, and hasn't been used.
 *
 * @param {string} token - The secure approval token
 * @param {string} decision - 'approve' or 'reject'
 * @returns {Object} Result with success, status, or error
 */
function processApprovalDecision(token, decision) {
  let tokenData = null;
  let request = null;
  let approverEmail = null;

  try {
    // Step 1: Validate and retrieve token from storage
    const tokenValidation = validateAndRetrieveToken(token);
    if (!tokenValidation.valid) {
      logSystemEvent("APPROVAL_TOKEN_REJECTED", "UNKNOWN", 0, {
        reason: tokenValidation.error,
      });
      return { success: false, error: tokenValidation.error };
    }

    tokenData = tokenValidation.data;
    const transactionId = tokenData.transactionId;
    approverEmail = tokenData.approver;

    // Step 2: Verify current user matches token approver (identity verification)
    const currentUser = Session.getActiveUser().getEmail();
    if (currentUser !== approverEmail) {
      console.warn(
        `[SECURITY] Identity mismatch: Token approver ${approverEmail} != Current user ${currentUser}`,
      );
      logSystemEvent("APPROVAL_IDENTITY_MISMATCH", currentUser, 0, {
        transactionId: transactionId,
        tokenApprover: approverEmail,
      });
      return {
        success: false,
        error:
          "Identity verification failed. You must be logged in as the designated approver.",
      };
    }

    // Step 3: Retrieve transaction details
    request = findRequestInQueues(transactionId);
    if (!request) {
      logSystemEvent("APPROVAL_REQUEST_NOT_FOUND", approverEmail, 0, {
        transactionId: transactionId,
      });
      return {
        success: false,
        error: "Request not found or already processed",
      };
    }

    if (request.status !== "PENDING") {
      logSystemEvent(
        "APPROVAL_REQUEST_NOT_PENDING",
        approverEmail,
        request.amount,
        {
          transactionId: transactionId,
          currentStatus: request.status,
        },
      );
      return {
        success: false,
        error: `Request already ${request.status.toLowerCase()}`,
      };
    }

    // Step 4: Validate budget if approving
    if (decision === "approve") {
      const budgetCheck = validateBudgetBeforeApproval(request);
      if (!budgetCheck.valid) {
        const divisionPrincipalEmail = getDivisionPrincipal(request.email, request.division);
        
        if (divisionPrincipalEmail && approverEmail.toLowerCase().trim() === divisionPrincipalEmail.toLowerCase().trim()) {
            console.log(`[OVERAGE OVERRIDE] Division Principal ${approverEmail} overriding budget check for ${transactionId}`);
            logSystemEvent("APPROVAL_OVERAGE_OVERRIDE", approverEmail, request.amount, { transactionId: transactionId });
        } else if (divisionPrincipalEmail) {
            console.log(`[ESCALATION] Overage on ${transactionId}. Forwarding to ${divisionPrincipalEmail}`);
            
            // Mark token as used since Dept Head action is done
            markTokenAsUsed(token, currentUser);

            // Escalate in Queue
            escalateQueueApprover(transactionId, divisionPrincipalEmail, request.isAutomated);

            // Send new approval email to Division Principal
            sendEnhancedApprovalEmail(divisionPrincipalEmail, {
              transactionId: transactionId,
              type: request.type + " (Overage Escalation)",
              amount: request.amount,
              requestor: request.email,
              description: request.description,
              items: request.items || [],
              budgetContext: {
                available: budgetCheck.available,
                withinBudget: false,
                utilization: 100
              },
              pdfLink: request.pdfLink || null
            });

            logSystemEvent("REQUEST_ESCALATED", approverEmail, request.amount, {
              transactionId: transactionId,
              newApprover: divisionPrincipalEmail
            });

            return {
              success: true,
              status: "ESCALATED",
              message: `Approved on your end, but request exceeded budget by $${(request.amount - budgetCheck.available).toFixed(2)}. Escalated to Division Principal (${divisionPrincipalEmail}) for final override.`
            };
        } else {
            // No division principal found to escalate to, block it.
            logSystemEvent(
              "APPROVAL_BLOCKED_OVERBUDGET",
              approverEmail,
              request.amount,
              {
                transactionId: transactionId,
                available: budgetCheck.available,
                encumbrance: budgetCheck.encumbrance,
              },
            );

            return {
              success: false,
              error: `Cannot approve: ${budgetCheck.message}. Current available budget: $${budgetCheck.available.toFixed(2)}`,
            };
        }
      }
    }

    // Step 5: Final approver validation
    const validApprover = validateApprover(approverEmail, request);
    if (!validApprover) {
      logSystemEvent(
        "APPROVAL_UNAUTHORIZED_APPROVER",
        approverEmail,
        request.amount,
        {
          transactionId: transactionId,
        },
      );
      return {
        success: false,
        error: "You are not authorized to approve this request",
      };
    }

    // Step 6: Process the decision
    const newStatus = decision === "approve" ? "APPROVED" : "REJECTED";
    const updateSuccess = updateQueueStatus(
      transactionId,
      newStatus,
      approverEmail,
      request.isAutomated,
    );

    if (!updateSuccess) {
      logSystemEvent(
        "APPROVAL_STATUS_UPDATE_FAILED",
        approverEmail,
        request.amount,
        {
          transactionId: transactionId,
        },
      );
      return { success: false, error: "Failed to update queue status" };
    }

    // Step 7: Mark token as used (prevent replay attacks)
    markTokenAsUsed(token, currentUser);

    if (newStatus === "APPROVED") {
      sendApprovalNotification(request.email, {
        transactionId: transactionId,
        amount: request.amount,
        type: request.type,
        description: request.description,
        approver: approverEmail,
      });
      updateUserBudgetEncumbrance(request.email, request.amount, "add");

      if (!request.isAutomated) {
        const orderId = generateOrderID(
          request.division || request.department,
          request.type,
        );
        moveToTransactionLedger({
          transactionId: transactionId,
          orderId: orderId,
          requestor: request.email,
          approver: approverEmail,
          organization: request.department,
          form: request.type,
          amount: request.amount,
          description: request.description,
        });

        console.log(
          `🧾 Queuing Single Invoice generation for approved request: ${transactionId}`,
        );
        try {
          const cache = CacheService.getScriptCache();
          const trigger = ScriptApp.newTrigger("runGenerateSingleInvoiceAsync")
            .timeBased()
            .after(100)
            .create();
          cache.put(
            "async_invoice_" + trigger.getUniqueId(),
            transactionId,
            3600,
          ); // 1 hour
        } catch (invoiceErr) {
          console.error(
            `❌ Failed to queue single invoice for ${transactionId}: ${invoiceErr.message}`,
          );
        }
      } else {
        console.log(
          `Automated item ${transactionId} approved - routing payloads`,
        );
        if (
          request.type === "AMAZON" &&
          typeof AmazonWorkflowEngine !== "undefined"
        ) {
          console.log(
            `🚀 Routing manually approved Amazon order to Dispatch Engine: ${transactionId}`,
          );
          try {
            new AmazonWorkflowEngine().dispatchAmazonOrder(transactionId, {
              email: request.email,
              department: request.department,
              amount: request.amount,
              description: request.description,
            });
          } catch (amzErr) {
            console.error(
              `❌ Failed to dispatch Amazon order ${transactionId}: ${amzErr.message}`,
            );
          }
        }
      }
    } else {
      sendRejectionNotification(request.email, {
        transactionId: transactionId,
        type: request.type,
        amount: request.amount,
        description: request.description,
        approver: approverEmail,
      });

      if (request.wasOverBudget) {
        releaseBudgetHold(request.email, request.amount);
      }

      if (request.isAutomated && decision === "reject") {
        // Offer to resubmit with different pricing or alternatives
        sendResubmissionNotification(
          request.email,
          request.type,
          {
            transactionId: transactionId,
            description: request.description,
            amount: request.amount,
          },
          "Your request was rejected. You may resubmit with updated information.",
        );
      }
    }

    console.log(
      `[SECURITY] Approval processed successfully - TxnID: ${transactionId} | Approver: ${approverEmail} | Decision: ${newStatus}`,
    );
    logSystemEvent(`REQUEST_${newStatus}`, approverEmail, request.amount, {
      transactionId: transactionId,
      requestor: request.email,
      timestamp: new Date(),
      tokenId: token.substring(0, 8),
    });

    return { success: true, status: newStatus };
  } catch (error) {
    console.error(
      "[SECURITY ERROR] Unexpected error in approval processing:",
      error,
    );
    logSystemEvent("APPROVAL_ERROR", approverEmail || "UNKNOWN", 0, {
      error: error.toString(),
      stack: error.stack,
    });
    return {
      success: false,
      error:
        "An error occurred while processing your approval. Please try again.",
    };
  }
}

function updateQueueStatus(transactionId, status, approver, isAutomated) {
  const hubId = isAutomated ? CONFIG.AUTOMATED_HUB_ID : CONFIG.MANUAL_HUB_ID;
  const hub = SpreadsheetApp.openById(hubId);
  const queue = hub.getSheetByName(
    isAutomated ? "AutomatedQueue" : "ManualQueue",
  );
  const data = queue.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === transactionId) {
      const oldStatus = data[i][7];
      const requestor = data[i][1];
      const amount = parseFloat(data[i][5]) || 0;

      queue.getRange(i + 1, 8).setValue(status); // Status
      queue.getRange(i + 1, 10).setValue(new Date()); // ApprovedOn
      queue.getRange(i + 1, 11).setValue(approver); // Approver

      if (oldStatus !== status) {
        // If status changed to REJECTED or VOID, remove encumbrance
        if (status === "REJECTED" || status === "VOID") {
          updateUserEncumbranceRealTime(requestor, amount, "remove");
        }
        // FIX #6: When a transaction moves to ORDERED, record it as actual spend
        // in UserDirectory.BudgetSpent, and recalculate encumbrance (ORDERED items
        // are no longer PENDING so they drop out of the encumbrance scan).
        if (status === "ORDERED") {
          recordBudgetSpent(requestor, amount);
        }
      }

      return true;
    }
  }
  return false;
}

/**
 * ============================================================================
 * SECURITY: TOKEN VALIDATION & ANTI-REPLAY FUNCTIONS
 * ============================================================================
 */

/**
 * Validates a secure token and retrieves its data.
 * Checks:
 * - Token exists in storage
 * - Token hasn't expired (1 hour)
 * - Token hasn't been used before (replay protection)
 *
 * @param {string} token - The secure approval token
 * @returns {Object} { valid: boolean, data: Object|null, error: string|null }
 */
function validateAndRetrieveToken(token) {
  if (!token || typeof token !== "string" || token.trim() === "") {
    return {
      valid: false,
      data: null,
      error: "No valid token provided",
    };
  }

  try {
    const scriptProperties = PropertiesService.getScriptProperties();
    const tokenKey = `approval_token_${token}`;
    const tokenJson = scriptProperties.getProperty(tokenKey);

    if (!tokenJson) {
      console.warn(`[SECURITY] Token not found: ${token.substring(0, 8)}...`);
      return {
        valid: false,
        data: null,
        error: "Token not found or has been deleted",
      };
    }

    const tokenData = JSON.parse(tokenJson);

    // Check if token has already been used (replay attack prevention)
    if (tokenData.used === true) {
      console.warn(
        `[SECURITY] Token replay attempt detected: ${token.substring(0, 8)}... | Used by: ${tokenData.usedBy} at ${tokenData.usedAt}`,
      );
      return {
        valid: false,
        data: null,
        error: "This approval link has already been used",
      };
    }

    // Check if token has expired
    const now = Date.now();
    if (now > tokenData.expiresAt) {
      const expiresDate = new Date(tokenData.expiresAt);
      console.warn(
        `[SECURITY] Token expired: ${token.substring(0, 8)}... | Expired at: ${expiresDate}`,
      );
      return {
        valid: false,
        data: null,
        error: `Approval link has expired. It was only valid until ${expiresDate.toLocaleString()}`,
      };
    }

    console.log(
      `[SECURITY] Token validated successfully: ${token.substring(0, 8)}... | TxnID: ${tokenData.transactionId}`,
    );
    return {
      valid: true,
      data: tokenData,
      error: null,
    };
  } catch (error) {
    console.error("[SECURITY ERROR] Token validation failed:", error);
    return {
      valid: false,
      data: null,
      error:
        "Token validation error - please try accessing the approval link again",
    };
  }
}

/**
 * Marks a token as used to prevent replay attacks.
 * Once a token is used, it cannot be used again.
 *
 * @param {string} token - The secure approval token
 * @param {string} usedBy - Email of the user who used the token
 */
function markTokenAsUsed(token, usedBy) {
  try {
    const scriptProperties = PropertiesService.getScriptProperties();
    const tokenKey = `approval_token_${token}`;
    const tokenJson = scriptProperties.getProperty(tokenKey);

    if (!tokenJson) {
      console.warn(
        `[SECURITY] Cannot mark token as used - token not found: ${token.substring(0, 8)}...`,
      );
      return;
    }

    const tokenData = JSON.parse(tokenJson);
    tokenData.used = true;
    tokenData.usedAt = new Date().toISOString();
    tokenData.usedBy = usedBy;

    scriptProperties.setProperty(tokenKey, JSON.stringify(tokenData));
    console.log(
      `[SECURITY] Token marked as used: ${token.substring(0, 8)}... | Used by: ${usedBy}`,
    );
  } catch (error) {
    console.error("[SECURITY ERROR] Failed to mark token as used:", error);
  }
}

/**
 * Cleanup function to remove expired tokens from storage.
 * This prevents PropertiesService from filling up over time.
 * Should be run periodically (e.g., daily via trigger).
 *
 * @returns {Object} { deleted: number, errors: number }
 */
function cleanupExpiredTokens() {
  const scriptProperties = PropertiesService.getScriptProperties();
  const allProperties = scriptProperties.getProperties();
  let deleted = 0;
  let errors = 0;
  const now = Date.now();

  for (const [key, value] of Object.entries(allProperties)) {
    // Only process approval tokens
    if (!key.startsWith("approval_token_")) continue;

    try {
      const tokenData = JSON.parse(value);
      // Delete if expired (more than 1 hour old) or already used
      if (now > tokenData.expiresAt || tokenData.used === true) {
        scriptProperties.deleteProperty(key);
        deleted++;
      }
    } catch (error) {
      console.warn(`Error parsing token property ${key}:`, error);
      errors++;
    }
  }

  console.log(
    `[SECURITY] Token cleanup complete - Deleted: ${deleted}, Errors: ${errors}`,
  );
  logSystemEvent("APPROVAL_TOKEN_CLEANUP", "SYSTEM", 0, {
    deletedCount: deleted,
    errorCount: errors,
  });

  return { deleted, errors };
}

function moveToTransactionLedger(transaction) {
  const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
  let ledger = budgetHub.getSheetByName("TransactionLedger");

  if (!ledger) {
    ledger = budgetHub.insertSheet("TransactionLedger");
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
  }

  ledger.appendRow([
    transaction.transactionId,
    transaction.orderId,
    new Date(),
    transaction.requestor,
    transaction.approver,
    transaction.organization,
    transaction.form,
    transaction.amount,
    transaction.description,
    getCurrentQuarter(),
    "",
    "",
  ]);
}
function createFormattedMultiItemDescription(items) {
  if (!items || items.length === 0) return "No items";
  const descriptions = items.map((item) => {
    const qty = item.quantity || 1;
    const desc = item.description || item.itemDescription || "Unknown Item";
    const cleanDesc = String(desc).trim().substring(0, 50);
    return qty > 1 ? `${qty}x ${cleanDesc}` : cleanDesc;
  });
  const fullDesc = descriptions.join(", ");
  return fullDesc.length > 200 ? fullDesc.substring(0, 197) + "..." : fullDesc;
}

// ============================================================================
// WAREHOUSE ORDER PROCESSING
// ============================================================================

function processWarehouseOrders() {
  try {
    console.log("🏪 Processing warehouse orders");

    const autoHub = SpreadsheetApp.openById(CONFIG.AUTOMATED_HUB_ID);
    const queueSheet = autoHub.getSheetByName("AutomatedQueue");
    const queueData = queueSheet.getDataRange().getValues();

    let processedCount = 0;
    const processedItems = [];

    for (let i = 1; i < queueData.length; i++) {
      if (queueData[i][2] === "WAREHOUSE" && queueData[i][7] === "APPROVED") {
        const transactionId = queueData[i][0];
        const division = queueData[i][4] || "General";
        const orderId = generateOrderID(division, "WAREHOUSE");

        // Move to transaction ledger
        moveToTransactionLedger({
          transactionId,
          orderId,
          requestor: queueData[i][1],
          approver: queueData[i][10],
          organization: queueData[i][3],
          form: "WAREHOUSE",
          amount: queueData[i][5],
          description: queueData[i][6],
        });

        // Update status to ORDERED
        queueSheet.getRange(i + 1, 8).setValue("ORDERED");
        queueSheet.getRange(i + 1, 10).setValue(new Date());

        processedItems.push({
          transactionId,
          requestor: queueData[i][1],
          department: queueData[i][3],
          amount: queueData[i][5],
          description: queueData[i][6],
        });

        processedCount++;
      }
    }

    if (processedCount > 0) {
      const lastOrderId = processedItems.length > 0 ? "batch" : "";
      console.log(`✅ Processed ${processedCount} warehouse orders`);
      // Invoice generation will handle sending to business office
    }

    return { success: true, processedCount, processedItems };
  } catch (error) {
    console.error("❌ Warehouse processing error:", error);
    return { success: false, error: error.toString() };
  }
}

function validateApprover(approverEmail, request) {
  // TEST MODE SUPER-ADMIN OVERRIDE
  if (isTestMode() && CONFIG.TEST_MODE === true) {
    const currentUser = Session.getActiveUser().getEmail();
    if (
      currentUser === CONFIG.ADMIN_EMAIL ||
      approverEmail === CONFIG.ADMIN_EMAIL ||
      currentUser === "invoicing@keswickchristian.org"
    ) {
      // Log this explicit override
      console.warn(
        `🔓 TEST MODE: Allowing approval for ${approverEmail} by ${currentUser}`,
      );
      return true;
    }
  }

  // Always allow business office
  if (approverEmail.toLowerCase() === CONFIG.BUSINESS_OFFICE_EMAIL.toLowerCase()) {
    return true;
  }

  // 1. Check if they are the designated approver for the user
  const userBudget = getUserBudgetInfo(request.email);
  if (userBudget && userBudget.approver.toLowerCase() === approverEmail.toLowerCase()) {
    return true;
  }

  // 2. Check if they are the Division Principal for the requested division
  const divisionPrincipal = getDivisionPrincipal(request.email, request.division);
  if (divisionPrincipal && divisionPrincipal.toLowerCase() === approverEmail.toLowerCase()) {
    return true;
  }

  return false;
}

function escalateQueueApprover(transactionId, newApprover, isAutomated) {
  const hubId = isAutomated ? CONFIG.AUTOMATED_HUB_ID : CONFIG.MANUAL_HUB_ID;
  const hub = SpreadsheetApp.openById(hubId);
  const queue = hub.getSheetByName(
    isAutomated ? "AutomatedQueue" : "ManualQueue",
  );
  const data = queue.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === transactionId) {
      // Just update the Approver and keep status as PENDING, don't update ApprovedOn
      queue.getRange(i + 1, 11).setValue(newApprover);
      return true;
    }
  }
  return false;
}

function findRequestInQueues(transactionId) {
  // Check automated queue
  try {
    const autoHub = SpreadsheetApp.openById(CONFIG.AUTOMATED_HUB_ID);
    const autoQueue = autoHub.getSheetByName("AutomatedQueue");
    const autoData = autoQueue.getDataRange().getValues();

    for (let i = 1; i < autoData.length; i++) {
      if (autoData[i][0] === transactionId) {
        return {
          isAutomated: true,
          transactionId: autoData[i][0],
          email: autoData[i][1],
          type: autoData[i][2],
          department: autoData[i][3],
          division: autoData[i][4],
          amount: autoData[i][5],
          description: autoData[i][6],
          status: autoData[i][7],
          formPrefix: autoData[i][2] === "AMAZON" ? "AMZ" : "PCW",
          row: i + 1,
        };
      }
    }
  } catch (error) {
    console.error("Error checking automated queue:", error);
  }

  // Check manual queue
  try {
    const manualHub = SpreadsheetApp.openById(CONFIG.MANUAL_HUB_ID);
    const manualQueue = manualHub.getSheetByName("ManualQueue");
    const manualData = manualQueue.getDataRange().getValues();

    for (let i = 1; i < manualData.length; i++) {
      if (manualData[i][0] === transactionId) {
        const typeMap = {
          FIELD_TRIP: "FT",
          CURRICULUM: "CI",
          ADMIN: "ADMIN",
        };

        return {
          isAutomated: false,
          transactionId: manualData[i][0],
          email: manualData[i][1],
          type: manualData[i][2],
          department: manualData[i][3],
          division: manualData[i][4],
          amount: manualData[i][5],
          description: manualData[i][6],
          status: manualData[i][7],
          formPrefix: typeMap[manualData[i][2]] || "TXN",
          row: i + 1,
        };
      }
    }
  } catch (error) {
    console.error("Error checking manual queue:", error);
  }

  return null;
}

// ============================================================================
// VALIDATION & ORDER UTILITIES
// ============================================================================

function validateAmazonOrder(transactionId, items, requestorEmail) {
  const invalidItems = [];

  items.forEach((item, index) => {
    // Check if URL is valid Amazon URL
    if (!isValidAmazonUrl(item.url)) {
      invalidItems.push({
        itemNumber: index + 1,
        description: item.description,
        url: item.url,
        issue: "Invalid or non-Amazon URL",
      });
    }

    // Check if ASIN can be extracted
    const asin = extractASIN(item.url);
    if (!asin && item.url.includes("amazon.com")) {
      invalidItems.push({
        itemNumber: index + 1,
        description: item.description,
        url: item.url,
        issue: "Cannot extract ASIN from Amazon URL",
      });
    }
  });

  if (invalidItems.length > 0) {
    voidOrderAndNotifyRequestor(
      transactionId,
      requestorEmail,
      "AMAZON",
      invalidItems,
    );
    return false;
  }

  return true;
}

function validateWarehouseOrder(transactionId, warehouseItems, requestorEmail) {
  // Warehouse validation is handled during item extraction via catalog lookup
  // Invalid catalog IDs are caught in processWarehouseFormSubmission
  // This function is kept for consistency with validateAmazonOrder
  return true;
}

function isValidAmazonUrl(url) {
  if (!url) return false;

  const urlStr = String(url).toLowerCase().trim();

  // Must contain amazon.com
  if (!urlStr.includes("amazon.com")) return false;

  // Basic URL regex validation
  const urlPattern = /^https?:\/\/(?:www\.)?amazon\.com\/.+/i;
  return urlPattern.test(urlStr);
}

function voidOrderAndNotifyRequestor(
  transactionId,
  requestorEmail,
  orderType,
  invalidItems,
) {
  try {
    // Update queue status to VOID
    const isAutomated = ["AMAZON", "WAREHOUSE"].includes(orderType);
    updateQueueStatus(transactionId, "VOID", "SYSTEM_VALIDATION", isAutomated);

    // Send detailed notification to requestor
    sendValidationErrorEmail(
      requestorEmail,
      transactionId,
      orderType,
      invalidItems,
    );

    // Log the validation failure
    logSystemEvent("ORDER_VALIDATION_FAILED", requestorEmail, 0, {
      transactionId,
      orderType,
      invalidItems,
    });
  } catch (error) {
    console.error("Error voiding order:", error);
    // Fall back to business office notification
    handleCriticalError(transactionId, orderType, error, {
      requestorEmail,
      invalidItems,
    });
  }
}

/**
 * Generates a secure approval token and stores token data server-side.
 * Uses cryptographic UUID instead of predictable timestamps.
 * Token expires after 72 hours (3 days) to give approvers a realistic window.
 *
 * @param {string} transactionId - The transaction/request ID
 * @param {string} approverEmail - The approver's email address
 * @param {string} decision - 'approve' or 'reject' (pre-stored decision)
 * @returns {string} URL with secure token parameter only
 */
function generateApprovalUrl(transactionId, approverEmail, decision) {
  try {
    // Generate cryptographically secure random token
    const token = Utilities.getUuid();
    const now = Date.now();
    const expiresAt = now + (72 * 60 * 60 * 1000); // 72-hour (3 day) expiration — FIX #4

    // Store token data server-side in PropertiesService
    const tokenData = {
      transactionId: transactionId,
      approver: approverEmail,
      decision: decision,
      createdAt: now,
      expiresAt: expiresAt,
      used: false,
      usedAt: null,
      usedBy: null,
    };

    const scriptProperties = PropertiesService.getScriptProperties();
    scriptProperties.setProperty(
      `approval_token_${token}`,
      JSON.stringify(tokenData),
    );

    // Log token generation for audit trail
    console.log(
      `[SECURITY] Approval token generated - Token: ${token.substring(0, 8)}... | TxnID: ${transactionId} | Approver: ${approverEmail} | Expires: ${new Date(expiresAt)}`,
    );
    logSystemEvent("APPROVAL_TOKEN_GENERATED", approverEmail, 0, {
      transactionId: transactionId,
      tokenId: token.substring(0, 8),
      expiresAt: expiresAt,
    });

    // Return URL with only the token parameter
    return `${CONFIG.WEBAPP_URL}?token=${encodeURIComponent(token)}`;
  } catch (error) {
    console.error("Error generating approval URL:", error);
    logSystemEvent("APPROVAL_TOKEN_GENERATION_ERROR", approverEmail, 0, {
      transactionId: transactionId,
      error: error.toString(),
    });
    throw new Error(`Failed to generate approval token: ${error.toString()}`);
  }
}

// ============================================================================
// COLUMN VALIDATION HELPER
// ============================================================================

/**
 * Validates that form response sheet headers match expected COLUMN_MAP positions.
 * Logs warnings for any mismatches. Run this after form edits to detect column drift.
 * Can be called manually or wired into form submission handlers for ongoing monitoring.
 *
 * @param {string} formType - 'AMAZON', 'WAREHOUSE', 'FIELD_TRIP', 'CURRICULUM', or 'ADMIN'
 * @param {Array} headerRow - The first row (headers) from the response sheet
 */
function validateFormColumns(formType, headerRow) {
  if (!headerRow || headerRow.length === 0) return;

  // Expected header keywords per column (partial match, case-insensitive)
  const EXPECTED_HEADERS = {
    AMAZON: {
      [COLUMN_MAP.AMAZON.EMAIL]: "email",
      [COLUMN_MAP.AMAZON.ITEM1_DESC]: "description",
      [COLUMN_MAP.AMAZON.ITEM1_URL]: "url",
      [COLUMN_MAP.AMAZON.ITEM1_QTY]: "quantity",
      [COLUMN_MAP.AMAZON.ITEM1_PRICE]: "price",
    },
    WAREHOUSE: {
      [COLUMN_MAP.WAREHOUSE.EMAIL]: "email",
      [COLUMN_MAP.WAREHOUSE.ITEM1_ID]: "catalog",
      [COLUMN_MAP.WAREHOUSE.ITEM1_QTY]: "quantity",
    },
    FIELD_TRIP: {
      [COLUMN_MAP.FIELD_TRIP.EMAIL]: "email",
      [COLUMN_MAP.FIELD_TRIP.DESTINATION]: "destination",
      [COLUMN_MAP.FIELD_TRIP.TRIP_DATE]: "date",
      [COLUMN_MAP.FIELD_TRIP.TOTAL_COST]: "cost",
    },
    CURRICULUM: {
      [COLUMN_MAP.CURRICULUM.EMAIL]: "email",
      [COLUMN_MAP.CURRICULUM.TYPE]: "type",
      [COLUMN_MAP.CURRICULUM.RESOURCE_NAME]: "resource",
      [COLUMN_MAP.CURRICULUM.QUANTITY]: "quantity",
      [COLUMN_MAP.CURRICULUM.UNIT_PRICE]: "price",
    },
    ADMIN: {
      [COLUMN_MAP.ADMIN.EMAIL]: "email",
      [COLUMN_MAP.ADMIN.DESCRIPTION]: "description",
      [COLUMN_MAP.ADMIN.AMOUNT]: "amount",
    },
  };

  const expected = EXPECTED_HEADERS[formType];
  if (!expected) return;

  let mismatches = 0;
  for (const [colIdx, keyword] of Object.entries(expected)) {
    const idx = parseInt(colIdx);
    if (idx >= headerRow.length) {
      console.warn(
        `⚠️ [COLUMN_DRIFT] ${formType}: Expected column ${idx} ("${keyword}") but sheet only has ${headerRow.length} columns`,
      );
      mismatches++;
      continue;
    }
    const actual = String(headerRow[idx] || "").toLowerCase();
    if (!actual.includes(keyword.toLowerCase())) {
      console.warn(
        `⚠️ [COLUMN_DRIFT] ${formType}: Column ${idx} expected "${keyword}" but found "${headerRow[idx]}"`,
      );
      mismatches++;
    }
  }

  if (mismatches > 0) {
    console.error(
      `🚨 [COLUMN_DRIFT] ${formType}: ${mismatches} column(s) may have shifted. Run dumpAllFormStructures() and update COLUMN_MAP.`,
    );
  } else {
    console.log(
      `✅ [COLUMN_CHECK] ${formType}: All checked columns match expected headers.`,
    );
  }
}

/**
 * Asynchronous trigger target to generate single invoice in the background.
 * Unblocks the doGet HTTP response.
 */
function runGenerateSingleInvoiceAsync(e) {
  if (!e || !e.triggerUid) return;
  const triggerUid = e.triggerUid;

  const cache = CacheService.getScriptCache();
  const transactionId = cache.get("async_invoice_" + triggerUid);

  // Clean up trigger instance immediately
  ScriptApp.getProjectTriggers().forEach((t) => {
    if (t.getUniqueId() === triggerUid) {
      ScriptApp.deleteTrigger(t);
    }
  });

  if (!transactionId) {
    console.warn(`No transaction ID found in cache for trigger ${triggerUid}`);
    return;
  }

  console.log(
    `🧾 Executing async Single Invoice generation for request: ${transactionId}`,
  );
  try {
    const result = generateSingleInvoice(transactionId);
    if (result && result.success) {
      const isManual = transactionId.startsWith('FIELD') || transactionId.startsWith('ADMIN') || transactionId.startsWith('CURRIC');
      if (isManual) {
        const req = findRequestInQueues(transactionId);
        if (req && req.email) {
           sendInvoiceReadyNotification(req.email, {
             transactionId: transactionId,
             invoiceId: result.invoiceId || transactionId,
             invoiceUrl: result.fileUrl,
             packageFolder: result.packageFolder,
             type: req.type,
             amount: req.amount
           });
        }
      }
    }
  } catch (err) {
    console.error(
      `❌ Async invoice runner failed for ${transactionId}: ${err.message}`,
    );
  }
}
