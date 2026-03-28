/**
 * ============================================================================
 * INVOICING ENGINE v2.0
 * ============================================================================
 * Handles invoice generation for the Keswick Budget System.
 *
 * Invoice Types:
 * - BATCH: Amazon (Tue/Fri), Warehouse Internal (Wed) - grouped by division
 * - BATCH: Warehouse External (Wed) - all divisions combined
 * - SINGLE: Field Trip, Curriculum, Admin - generated on approval
 *
 * Features:
 * - Multi-page support with repeating headers
 * - Proper pagination (totals/signatures on last page)
 * - Dual signatures (Approver + Business Office)
 * - Drive folder organization by FY/Quarter/Type/Division
 */

// ============================================================================
// INVOICE ID GENERATION
// ============================================================================

/**
 * Generates an Invoice ID based on form type and division
 * Format: {PREFIX}-{DIVISION/ID}-{MMDD}[-{INCREMENT}]
 */
function generateInvoiceId(formType, divisionOrId, existingIds = []) {
  const now = new Date();
  const mmdd =
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0");

  // Determine prefix and identifier
  let prefix, identifier;

  if (!formType) {
    formType = "INV";
  }

  switch (formType.toUpperCase()) {
    case "AMAZON":
      prefix = "AMZ";
      identifier = divisionOrId; // US, LS, KK
      break;
    case "WAREHOUSE":
    case "WAREHOUSE_INTERNAL":
      prefix = "WHS";
      identifier = divisionOrId; // US, LS, KK
      break;
    case "WAREHOUSE_EXTERNAL":
      prefix = "WHS";
      identifier = null; // No division for external
      break;
    case "FIELD_TRIP":
      prefix = "FLD";
      identifier = divisionOrId; // US, LS, KK
      break;
    case "CURRICULUM":
      prefix = "CUR";
      identifier = divisionOrId; // MATH, SCIENCE, etc.
      break;
    case "ADMIN":
      prefix = "ADM";
      identifier = divisionOrId; // User initials (MJT, etc.)
      break;
    default:
      prefix = "INV";
      identifier = divisionOrId;
  }

  // Build base ID
  const baseId = identifier
    ? `${prefix}-${identifier}-${mmdd}`
    : `${prefix}-${mmdd}`;

  // Check for existing IDs today and increment if needed
  const todayIds = existingIds
    .map((id) => (id || "").toString())
    .filter((id) => id && id.startsWith(baseId));

  if (todayIds.length === 0) {
    return baseId; // First invoice of the day
  }

  // Find highest increment
  let maxIncrement = 1;
  todayIds.forEach((id) => {
    const match = id.toString().match(/-(\d+)$/);
    if (match) {
      maxIncrement = Math.max(maxIncrement, parseInt(match[1]));
    }
  });

  return `${baseId}-${String(maxIncrement + 1).padStart(2, "0")}`;
}

/**
 * Gets user initials from email for Admin invoice IDs
 */
function getUserInitials(email) {
  const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
  const userSheet = budgetHub.getSheetByName("UserDirectory");
  const data = userSheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (
      data[i][0] &&
      data[i][0].toString().toLowerCase() === email.toLowerCase()
    ) {
      const firstName = data[i][1] || "";
      const lastName = data[i][2] || "";
      return (
        (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() ||
        email.split("@")[0].substring(0, 3).toUpperCase()
      );
    }
  }

  // Fallback: use first 3 chars of email
  return email.split("@")[0].substring(0, 3).toUpperCase();
}

// ============================================================================
// BATCH INVOICE GENERATION
// ============================================================================

/**
 * Runs Warehouse batch invoicing (called Wednesday)
 */
function runWarehouseBatch() {
  console.log("🏪 === WAREHOUSE BATCH INVOICING ===");

  // Generate internal invoices (by division)
  const internalResult = runBatchInvoicing("WAREHOUSE_INTERNAL");

  // Generate external invoice (all combined)
  const externalResult = generateWarehouseExternalInvoice(internalResult); // Send combined email to Business Office
  if (
    (internalResult &&
      internalResult.success &&
      internalResult.invoices &&
      internalResult.invoices.length > 0) ||
    (externalResult && externalResult.success && externalResult.fileUrl)
  ) {
    if (typeof sendWarehouseBatchEmailToBusinessOffice === "function") {
      sendWarehouseBatchEmailToBusinessOffice(internalResult, externalResult);
    }
  }

  return {
    internal: internalResult,
    external: externalResult,
  };
}

/**
 * Core batch invoicing logic - groups by division
 */
function runBatchInvoicing(formType) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (e) {
    console.log("Batch skipped: system busy");
    return { success: false, error: "System locked" };
  }

  try {
    const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
    const ledger = budgetHub.getSheetByName("TransactionLedger");

    if (!ledger) {
      return {
        success: true,
        invoicesGenerated: 0,
        message: "No ledger found",
      };
    }

    const data = ledger.getDataRange().getValues();
    const headers = data[0];

    // Find column indices
    const cols = {
      transactionId: 0,
      orderId: 1,
      processedOn: 2,
      requestor: 3,
      approver: 4,
      organization: 5,
      form: 6,
      amount: 7,
      description: 8,
      fiscalQuarter: 9,
      invoiceGenerated: 10,
      invoiceUrl: 11,
    }; // Filter for matching form type, not yet invoiced
    const formTypeMatch = formType.replace("_INTERNAL", "").toUpperCase();
    const pendingTransactions = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowForm = (row[cols.form] || "").toString().toUpperCase();
      const invoiced = row[cols.invoiceGenerated];

      if (rowForm === formTypeMatch && !invoiced) {
        pendingTransactions.push({
          row: i + 1,
          transactionId: row[cols.transactionId],
          orderId: row[cols.orderId],
          date: row[cols.processedOn],
          requestor: row[cols.requestor],
          approver: row[cols.approver],
          organization: row[cols.organization],
          form: row[cols.form],
          amount: parseFloat(row[cols.amount]) || 0,
          description: row[cols.description],
          fiscalQuarter: row[cols.fiscalQuarter],
        });
      }
    }

    if (pendingTransactions.length === 0) {
      console.log("No pending transactions to invoice");
      return { success: true, invoicesGenerated: 0 };
    }

    console.log(
      `Found ${pendingTransactions.length} ${formTypeMatch} transactions to invoice`,
    );

    // Group by division
    const byDivision = {};
    pendingTransactions.forEach((txn) => {
      const div = getDivisionFromOrganization(txn.organization) || "OTHER";
      if (!byDivision[div]) byDivision[div] = [];
      byDivision[div].push(txn);
    });

    // We no longer track invoice IDs in the ledger, so we just use an empty array for existingIds to start at -01
    let existingBatchIds = [];

    const results = [];

    // Generate invoice for each division
    for (const [division, transactions] of Object.entries(byDivision)) {
      if (transactions.length === 0) continue;

      const invoiceId = generateInvoiceId(formType, division, existingBatchIds);
      existingBatchIds.push(invoiceId); // Add to list for increment tracking

      console.log(
        `Generating ${invoiceId} with ${transactions.length} transactions`,
      );

      const result = generateBatchInvoicePDF(transactions, {
        invoiceId: invoiceId,
        formType: formTypeMatch,
        division: division,
        isExternal: false,
      });

      if (result.success) {
        // Update ledger rows and notify requestors
        transactions.forEach((txn) => {
          ledger.getRange(txn.row, cols.invoiceGenerated + 1).setValue("YES");
          // No more invoiceId column in ledger
          ledger
            .getRange(txn.row, cols.invoiceUrl + 1)
            .setValue(result.fileUrl);

          // Just record it in the ledger; emailing the invoice is not needed.
          // (Link is already accessible in their dashboard/hub).
        });
        results.push({
          invoiceId: invoiceId,
          division: division,
          transactionCount: transactions.length,
          total: transactions.reduce((sum, t) => sum + t.amount, 0),
          fileUrl: result.fileUrl,
          rawTransactions: transactions,
        });
      }
    }

    console.log(`✅ Generated ${results.length} ${formTypeMatch} invoices`);
    return {
      success: true,
      invoicesGenerated: results.length,
      invoices: results,
    };
  } catch (error) {
    console.error("❌ Batch invoicing failed:", error);
    return { success: false, error: error.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Generates the combined external warehouse invoice
 */
function generateWarehouseExternalInvoice(internalResult) {
  if (!internalResult || !internalResult.success || !internalResult.invoices) {
    return { success: false, error: "No successful internal batch provided" };
  }

  const warehouseTransactions = [];

  // Pull transactions directly from the internal result
  for (const invoice of internalResult.invoices) {
    if (invoice.rawTransactions && invoice.rawTransactions.length > 0) {
      warehouseTransactions.push(...invoice.rawTransactions);
    }
  }

  if (warehouseTransactions.length === 0) {
    return {
      success: true,
      message: "No warehouse transactions for external invoice",
    };
  }

  const todayForId = new Date();
  const dateStrShort = Utilities.formatDate(
    todayForId,
    "America/New_York",
    "MMddyy",
  );
  const invoiceId = `PCW-${dateStrShort}`;
  const result = generateBatchInvoicePDF(warehouseTransactions, {
    invoiceId: invoiceId,
    formType: "WAREHOUSE",
    division: null,
    isExternal: true,
  });

  return result;
}

// ============================================================================
// PDF CONCATENATION UTILITIES
// ============================================================================

/**
 * Creates a combined invoice package with internal PO and uploaded receipt
 * Since Apps Script can't merge PDFs natively, we create a package folder
 * with both documents and a cover sheet
 *
 * @param {Blob} internalPdfBlob - The generated internal PO PDF
 * @param {string} uploadedPdfUrl - Google Drive URL of uploaded PDF (optional)
 * @param {string} invoiceId - Invoice ID for naming
 * @param {Object} metadata - Transaction metadata
 * @return {Object} Result with package folder URL
 */
function createInvoicePackage(
  internalPdfBlob,
  uploadedPdfUrl,
  invoiceId,
  metadata,
) {
  try {
    // Get the storage folder
    const baseFolder = getInvoiceStorageFolder(
      metadata.formType,
      metadata.division,
      metadata.department,
      null,
      null,
    );

    // Create transaction-specific folder if there's an uploaded PDF
    let targetFolder = baseFolder;
    if (uploadedPdfUrl) {
      const packageFolders = baseFolder.getFoldersByName(invoiceId);
      if (packageFolders.hasNext()) {
        targetFolder = packageFolders.next();
      } else {
        targetFolder = baseFolder.createFolder(invoiceId);
      }
    }

    // Save internal PO
    const poFileName = uploadedPdfUrl
      ? `${invoiceId}_01_Internal_PO.pdf`
      : `${invoiceId}.pdf`;
    internalPdfBlob.setName(poFileName);
    const poFile = targetFolder.createFile(internalPdfBlob);

    try {
      poFile.setSharing(DriveApp.Access.DOMAIN, DriveApp.Permission.VIEW);
    } catch (e) {
      console.warn("Could not set PO permissions:", e.message);
    }

    let receiptFile = null;
    let receiptUrl = null;

    // Copy uploaded PDF if provided
    if (uploadedPdfUrl) {
      try {
        const fileId = extractFileIdFromUrl(uploadedPdfUrl);
        if (fileId) {
          const sourceFile = DriveApp.getFileById(fileId);
          receiptFile = sourceFile.makeCopy(
            `${invoiceId}_02_Receipt.pdf`,
            targetFolder,
          );

          try {
            receiptFile.setSharing(
              DriveApp.Access.DOMAIN,
              DriveApp.Permission.VIEW,
            );
          } catch (e) {
            console.warn("Could not set receipt permissions:", e.message);
          }

          receiptUrl = receiptFile.getUrl();
          console.log(`✅ Copied receipt PDF: ${receiptUrl}`);
        }
      } catch (copyError) {
        console.error("Failed to copy uploaded PDF:", copyError.message);
      }

      // Create cover sheet
      createPackageCoverSheet(
        targetFolder,
        invoiceId,
        metadata,
        poFile.getUrl(),
        receiptUrl,
      );
    }

    const result = {
      success: true,
      invoiceId: invoiceId,
      fileId: poFile.getId(),
      fileUrl: poFile.getUrl(),
      packageFolder: uploadedPdfUrl ? targetFolder.getUrl() : null,
      hasReceipt: !!receiptFile,
    };

    console.log(`✅ Invoice package created: ${invoiceId}`);
    return result;
  } catch (error) {
    console.error("Failed to create invoice package:", error);
    return { success: false, error: error.toString() };
  }
}

/**
 * Creates a cover sheet PDF for the invoice package
 */
function createPackageCoverSheet(
  folder,
  invoiceId,
  metadata,
  poUrl,
  receiptUrl,
) {
  const now = new Date();
  const dateStr = Utilities.formatDate(now, "America/New_York", "MMMM d, yyyy");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page { size: letter; margin: 1in; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #333;
    }
    .header {
      text-align: center;
      padding-bottom: 20px;
      border-bottom: 2px solid #19573B;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #19573B;
      font-size: 24pt;
      margin: 0 0 10px 0;
    }
    .header .subtitle {
      color: #666;
      font-size: 14pt;
    }
    .info-section {
      margin: 20px 0;
      padding: 15px;
      background: #f5f5f5;
      border-radius: 5px;
    }
    .info-row {
      display: flex;
      margin: 8px 0;
    }
    .info-label {
      font-weight: bold;
      width: 150px;
      color: #19573B;
    }
    .documents-section {
      margin-top: 30px;
    }
    .documents-section h2 {
      color: #19573B;
      font-size: 16pt;
      border-bottom: 1px solid #ccc;
      padding-bottom: 10px;
    }
    .document-item {
      margin: 15px 0;
      padding: 15px;
      border: 1px solid #ddd;
      border-radius: 5px;
    }
    .document-item .doc-title {
      font-weight: bold;
      font-size: 14pt;
      color: #333;
    }
    .document-item .doc-desc {
      color: #666;
      margin-top: 5px;
    }
    .footer {
      margin-top: 50px;
      text-align: center;
      font-size: 10pt;
      color: #888;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Invoice Package</h1>
    <div class="subtitle">Keswick Christian School Budget System</div>
  </div>

  <div class="info-section">
    <div class="info-row">
      <span class="info-label">Invoice ID:</span>
      <span>${invoiceId}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Form Type:</span>
      <span>${metadata.formType || "N/A"}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Division:</span>
      <span>${metadata.division || "N/A"}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Generated:</span>
      <span>${dateStr}</span>
    </div>
  </div>

  <div class="documents-section">
    <h2>Package Contents</h2>

    <div class="document-item">
      <div class="doc-title">1. Internal Purchase Order</div>
      <div class="doc-desc">
        Official approval document with signatures and budget authorization.
        <br><em>File: ${invoiceId}_01_Internal_PO.pdf</em>
      </div>
    </div>

    ${
      receiptUrl
        ? `
    <div class="document-item">
      <div class="doc-title">2. Receipt / Supporting Documentation</div>
      <div class="doc-desc">
        Original receipt or documentation uploaded with the request.
        <br><em>File: ${invoiceId}_02_Receipt.pdf</em>
      </div>
    </div>
    `
        : ""
    }
  </div>

  <div class="footer">
    <p>This cover sheet was automatically generated by the Keswick Budget System.</p>
    <p>All documents in this package should be kept together for record-keeping purposes.</p>
  </div>
</body>
</html>`;

  const blob = Utilities.newBlob(html, "text/html", "cover.html");
  const pdf = blob.getAs("application/pdf");
  pdf.setName(`${invoiceId}_00_Cover_Sheet.pdf`);

  const file = folder.createFile(pdf);
  try {
    file.setSharing(DriveApp.Access.DOMAIN, DriveApp.Permission.VIEW);
  } catch (e) {
    console.warn("Could not set cover sheet permissions:", e.message);
  }

  return file;
}

/**
 * Extracts file ID from Google Drive URL
 */
function extractFileIdFromUrl(url) {
  if (!url) return null;

  // Handle various Drive URL formats
  const patterns = [
    /\/d\/([a-zA-Z0-9_-]+)/, // /d/FILE_ID/
    /id=([a-zA-Z0-9_-]+)/, // id=FILE_ID
    /\/file\/d\/([a-zA-Z0-9_-]+)/, // /file/d/FILE_ID
    /^([a-zA-Z0-9_-]{25,})$/, // Just the ID
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Gets uploaded PDF URL from form submission queue
 */
function getUploadedPdfUrl(transactionId, formType) {
  try {
    let hubId, sheetName, pdfColumn;

    // Determine which hub and column based on form type
    switch (formType.toUpperCase()) {
      case "FIELD_TRIP":
        hubId = CONFIG.MANUAL_HUB_ID;
        sheetName = "FieldTrip";
        pdfColumn = 7; // Column H (0-indexed: 7)
        break;
      case "CURRICULUM":
        hubId = CONFIG.MANUAL_HUB_ID;
        sheetName = "Curriculum";
        pdfColumn = 9; // Column J (0-indexed: 9)
        break;
      case "ADMIN":
        hubId = CONFIG.MANUAL_HUB_ID;
        sheetName = "Admin";
        pdfColumn = 5; // Column F (0-indexed: 5)
        break;
      default:
        return null;
    }

    const hub = SpreadsheetApp.openById(hubId);
    const sheet = hub.getSheetByName(sheetName);
    if (!sheet) return null;

    const data = sheet.getDataRange().getValues();

    // Find the transaction by ID (usually in first column or search description)
    for (let i = 1; i < data.length; i++) {
      // Check if this row matches our transaction
      // Transaction IDs often contain form prefix, so check if row ID matches
      const rowId = data[i][0];
      if (rowId && transactionId.includes(rowId.toString())) {
        const pdfValue = data[i][pdfColumn];
        if (pdfValue && pdfValue.toString().includes("drive.google.com")) {
          return pdfValue.toString();
        }
      }
    }

    return null;
  } catch (error) {
    console.error("Error getting uploaded PDF:", error);
    return null;
  }
}

// ============================================================================
// SINGLE INVOICE GENERATION (On Approval)
// ============================================================================

/**
 * Generates a single invoice for Field Trip, Curriculum, or Admin
 * Called immediately upon approval
 * Now includes PDF concatenation for uploaded receipts
 */
function generateSingleInvoice(transactionId) {
  console.log(`📄 Generating single invoice for ${transactionId}`);

  const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
  const ledger = budgetHub.getSheetByName("TransactionLedger");

  if (!ledger) {
    return { success: false, error: "TransactionLedger not found" };
  }

  const data = ledger.getDataRange().getValues();
  let transaction = null;
  let rowIndex = -1;

  // Find the transaction
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === transactionId) {
      transaction = {
        transactionId: data[i][0],
        orderId: data[i][1],
        date: data[i][2],
        requestor: data[i][3],
        approver: data[i][4],
        organization: data[i][5],
        form: data[i][6],
        amount: parseFloat(data[i][7]) || 0,
        description: data[i][8],
        fiscalQuarter: data[i][9],
      };
      rowIndex = i + 1;
      break;
    }
  }

  if (!transaction) {
    return { success: false, error: "Transaction not found" };
  }

  // For single invoices, we just use the transaction ID directly
  const invoiceId = transaction.transactionId;

  // Generate the PDF
  const result = generateSingleInvoicePDF(transaction, {
    invoiceId: invoiceId,
    formType: formType,
  });

  if (result.success) {
    // Update ledger
    ledger.getRange(rowIndex, 11).setValue("YES");
    ledger.getRange(rowIndex, 12).setValue(result.fileUrl);

    // Notify requestor that their invoice is ready
    // (Link is already accessible in their dashboard/hub, emailing is not needed).
  }
  return result;
}

// ============================================================================
// PDF GENERATION - BATCH TEMPLATE
// ============================================================================

/**
 * Generates a batch invoice PDF (Amazon/Warehouse)
 */
function generateBatchInvoicePDF(transactions, metadata) {
  try {
    const html = generateBatchInvoiceHTML(transactions, metadata);

    const blob = Utilities.newBlob(
      html,
      "text/html",
      `${metadata.invoiceId}.html`,
    );
    const pdf = blob.getAs("application/pdf");
    pdf.setName(`${metadata.invoiceId}.pdf`);

    // Store in appropriate folder
    const folder = getInvoiceStorageFolder(
      metadata.formType,
      metadata.division,
      null,
      null,
      null,
    );

    const file = folder.createFile(pdf);
    file.setSharing(DriveApp.Access.DOMAIN, DriveApp.Permission.VIEW);

    console.log(`✅ Invoice ${metadata.invoiceId} created: ${file.getUrl()}`);

    return {
      success: true,
      invoiceId: metadata.invoiceId,
      fileId: file.getId(),
      fileUrl: file.getUrl(),
    };
  } catch (error) {
    console.error("❌ PDF generation failed:", error);
    return { success: false, error: error.toString() };
  }
}

/**
 * Generates batch invoice HTML with multi-page support
 * Updated design: larger header, qty/unit price columns, better signatures
 */
function generateBatchInvoiceHTML(transactions, metadata) {
  const now = new Date();
  const dateStr = Utilities.formatDate(now, "America/New_York", "MMMM d, yyyy");
  const pcwDateStr = Utilities.formatDate(now, "America/New_York", "MMddyy");

  let totalAmount = 0;
  let totalLineItems = 0;

  const divisionName = getDivisionFullName(metadata.division);

  const isWarehouse = metadata.formType === "WAREHOUSE";
  const isExternalWarehouse = metadata.isExternal && isWarehouse;
  const isInternalWarehouse = !metadata.isExternal && isWarehouse;

  const primaryRequestorEmail = transactions[0]
    ? transactions[0].requestor
    : "";
  const primaryRequestorName =
    getDisplayNameFromEmail(primaryRequestorEmail) || primaryRequestorEmail;

  let orderNumber;
  if (isExternalWarehouse) {
    orderNumber = `PCW-${pcwDateStr}`;
  } else if (transactions.length > 0 && !isWarehouse) {
    orderNumber = transactions[0].transactionId;
  } else {
    orderNumber = metadata.invoiceId;
  }

  const approverSig = isExternalWarehouse
    ? null
    : getApproverSignatureForDivision(metadata.division);
  const boSig = getBusinessOfficeSignature(metadata.formType);

  const groupedTransactions = [];
  let currentGroup = null;

  transactions.forEach((txn) => {
    if (!currentGroup || currentGroup.transactionId !== txn.transactionId) {
      const requestorName =
        getDisplayNameFromEmail(txn.requestor) || txn.requestor;
      currentGroup = {
        transactionId: txn.transactionId,
        requestor: requestorName,
        items: [],
      };
      groupedTransactions.push(currentGroup);
    }
    const txnItems = txn.items || [
      {
        description: txn.description,
        quantity: 1,
        unitPrice: txn.amount,
        totalPrice: txn.amount,
      },
    ];
    txnItems.forEach((item) => currentGroup.items.push(item));
  });

  let itemsHtml = "";

  groupedTransactions.forEach((group) => {
    const items = group.items;

    items.forEach((item, itemIndex) => {
      const qty = item.quantity || 1;
      const unitPrice = item.unitPrice || item.totalPrice || 0;
      const lineTotal = item.totalPrice || qty * unitPrice;
      totalAmount += lineTotal;
      totalLineItems++;

      let rowClass;
      if (items.length === 1) {
        rowClass = "txn-group-first txn-group-last";
      } else if (itemIndex === 0) {
        rowClass = "txn-group-first";
      } else if (itemIndex === items.length - 1) {
        rowClass = "txn-group-last";
      } else {
        rowClass = "txn-group-middle";
      }

      itemsHtml += `
        <tr class="${rowClass}">
          ${isWarehouse ? `<td class="txn-id">${group.transactionId || ""}</td>` : ""}
          ${isInternalWarehouse ? `<td class="requestor">${group.requestor || ""}</td>` : ""}
          <td class="description">${item.description || ""}</td>
          <td class="qty">${qty}</td>
          <td class="unit-price">$${unitPrice.toFixed(2)}</td>
          <td class="amount">$${lineTotal.toFixed(2)}</td>
        </tr>
      `;
    });
  });

  if (totalAmount === 0) {
    totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
  }

  // --- Calculate Spacer to force Footer to the bottom ---
  let currentY = 240 + 35; // header + thead approx
  groupedTransactions.forEach((group) => {
    group.items.forEach((item) => {
      let textLength = (item.description || "").length;
      let rowH = textLength > 50 ? 55 : 35; // wrap estimation
      if (currentY + rowH > 912) {
        currentY = 35 + rowH; // new page with thead
      } else {
        currentY += rowH;
      }
    });
  });

  // check if footer fits on the current page
  if (currentY + 220 > 912) {
    currentY = 35; // pushed to next page
  }

  // calculate gap needed to push footer to y = (912-220)=692
  let gap = 692 - currentY;
  if (gap < 0) gap = 0;
  gap = Math.max(0, gap - 40); // safety margin against overflow

  const bonheurFont = getBonheurRoyaleBase64();
  const schoolNameBase64 = getSchoolNameBase64();
  const crestBase64 = getCrestBase64();
  const sealBase64 = getSealBase64();

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @font-face {
      font-family: 'Bonheur Royale';
      font-style: normal;
      font-weight: 400;
      src: url(data:font/truetype;base64,${bonheurFont}) format('truetype');
    }

    :root {
      --logo-green: #13381f;
    }

    @page { size: letter; margin: 0.75in; }
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif;
      font-size: 9pt;
      line-height: 1.4;
      color: #333;
    }

    .watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      opacity: 0.04;
      z-index: 0;
      pointer-events: none;
    }
    .watermark img { width: 400px; }

    .header { margin-bottom: 18px; padding-bottom: 12px; position: relative; z-index: 1; }

    .header-top {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      column-gap: 40px;
      margin-bottom: 18px;
    }

    .school-name-img { display: flex; justify-content: flex-start; align-items: center; }
    .school-name-img img { height: 81px; width: auto; }

    .shield-crest { display: flex; justify-content: center; align-items: center; flex-shrink: 0; }
    .shield-crest img { height: 102px; width: auto; }

    .invoice-title { display: flex; justify-content: flex-end; align-items: center; text-align: right; }
    .invoice-title-text { display: flex; flex-direction: column; align-items: flex-end; }
    .invoice-title-text .main-word {
      font-family: 'Lucida Bright', 'Lucida Serif', Georgia, serif;
      font-size: 32pt;
      font-weight: 600;
      color: var(--logo-green);
      line-height: 1.1;
      letter-spacing: 0.8px;
    }
    .invoice-title-text .sub-word {
      font-family: 'Lucida Bright', 'Lucida Serif', Georgia, serif;
      font-size: 32pt;
      font-weight: 600;
      color: var(--logo-green);
      line-height: 1.1;
      letter-spacing: 0.8px;
    }

    .header-bottom {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 40px;
      margin-top: 15px;
    }

    .school-info { font-size: 10pt; color: #333; line-height: 1.7; font-weight: 500; flex: 1; max-width: 45%; }

    .invoice-details { text-align: right; font-size: 10pt; color: #333; line-height: 1.7; flex: 1; max-width: 45%; }
    .invoice-details .detail-row { margin-bottom: 3px; }
    .invoice-details .label { color: #666; display: inline; font-weight: 400; }
    .invoice-details .value { color: #000; font-weight: 700; display: inline; margin-left: 8px; }

    /* table spacing */
    .table-wrapper { display: block; margin-bottom: 40px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 15px; position: relative; z-index: 1; }
    thead { display: table-header-group; }
    thead th {
      background: #f5f5f5;
      border-top: 2px solid var(--logo-green);
      border-bottom: 2px solid var(--logo-green);
      padding: 10px 8px;
      text-align: left;
      font-size: 8pt;
      font-weight: 600;
      text-transform: uppercase;
      color: #333;
    }
    thead th.right { text-align: right; }
    thead th.center { text-align: center; }

    tbody tr { page-break-inside: avoid; }
    tbody td { padding: 8px; border-bottom: 1px solid #eee; vertical-align: top; font-size: 9pt; }

    td.txn-id { width: 85px; font-family: Consolas, monospace; font-size: 8pt; color: var(--logo-green); font-weight: 500; }
    td.requestor { width: 120px; }
    td.description { text-align: left; }
    td.qty { width: 40px; text-align: center; }
    td.unit-price { width: 70px; text-align: right; font-family: monospace; }
    td.amount { width: 75px; text-align: right; font-family: monospace; font-weight: 500; }

    .txn-group-first td { border-top: 1px solid #ddd; padding-top: 10px; }
    .txn-group-first:not(.txn-group-last) td { border-bottom: none; }
    .txn-group-middle td { border-bottom: none; padding-top: 4px; padding-bottom: 4px; }
    .txn-group-middle td.txn-id, .txn-group-middle td.requestor { color: transparent; }
    .txn-group-last td { padding-bottom: 10px; }
    .txn-group-last:not(.txn-group-first) td.txn-id, .txn-group-last:not(.txn-group-first) td.requestor { color: transparent; }

    .footer-section { margin-top: 30px; position: relative; z-index: 1; page-break-inside: avoid; }
    .totals { display: flex; justify-content: flex-end; margin-bottom: 35px; }
    .totals-box { width: 200px; border-top: 2px solid var(--logo-green); padding-top: 8px; }
    .totals-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 10pt; }
    .totals-row.grand { font-size: 14pt; font-weight: 700; }
    .totals-row.grand .value { color: var(--logo-green); }

    .signatures { display: flex; justify-content: space-between; padding-top: 25px; border-top: 2px solid var(--logo-green); }
    .signature-block { text-align: center; width: 220px; }
    .signature-label { font-size: 8pt; color: var(--logo-green); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px; font-weight: 600; }
    .signature-line { height: 55px; border-bottom: 2px solid var(--logo-green); display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px; }
    .signature-line .signature { font-family: 'Bonheur Royale', cursive; font-size: 28pt; color: #000; line-height: 1; }
    .signature-line img { max-height: 50px; max-width: 180px; }
    .sig-name { font-weight: 600; font-size: 9pt; }
    .sig-title { font-size: 8pt; color: #666; }
    .sig-date { font-size: 8pt; color: #999; margin-top: 3px; }
  </style>
</head>
<body>
  ${sealBase64 ? `<div class="watermark"><img src="data:image/jpeg;base64,${sealBase64}" /></div>` : ""}

  <div class="header">
    <div class="header-top">
      <div class="school-name-img">
        ${schoolNameBase64 ? `<img src="data:image/png;base64,${schoolNameBase64}" alt="Keswick Christian School" />` : ""}
      </div>
      <div class="shield-crest">
        ${crestBase64 ? `<img src="data:image/png;base64,${crestBase64}" alt="KCS Crest" />` : ""}
      </div>
      <div class="invoice-title">
        <div class="invoice-title-text">
          <div class="main-word">${isExternalWarehouse ? "EXTERNAL" : "Purchase"}</div>
          ${isExternalWarehouse ? "" : '<div class="sub-word">Order</div>'}
        </div>
      </div>
    </div>
    <div class="header-bottom">
      <div class="school-info">
        10101 54th Avenue North<br>
        St. Petersburg, FL 33708<br>
        businessoffice@keswickchristian.org<br>
        (727) 522-2111
      </div>
      <div class="invoice-details">
        <div class="detail-row"><span class="label">Order No:</span> <span class="value">${orderNumber}</span></div>
        <div class="detail-row"><span class="label">Date:</span> <span class="value">${dateStr}</span></div>
        <div class="detail-row"><span class="label">Division:</span> <span class="value">${isExternalWarehouse ? "All Divisions" : divisionName}</span></div>
        ${!isInternalWarehouse && !isExternalWarehouse ? `<div class="detail-row"><span class="label">Requestor:</span> <span class="value">${primaryRequestorName}</span></div>` : ""}
      </div>
    </div>
  </div>

  <div class="table-wrapper">
    <table>
      <thead>
        <tr>
          ${isWarehouse ? `<th>Transaction</th>` : ""}
          ${isInternalWarehouse ? "<th>Requestor</th>" : ""}
          <th>Description</th>
          <th class="center">Qty</th>
          <th class="right">Unit Price</th>
          <th class="right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>
  </div>

  <!-- dynamically calculated spacer to push the footer to the bottom of the page -->
  <div style="height: ${gap}px;"></div>

  <div class="footer-section">
    <div class="totals">
      <div class="totals-box">
        <div class="totals-row">
          <span>Line items</span>
          <span class="value">${totalLineItems || transactions.length}</span>
        </div>
        <div class="totals-row grand">
          <span>TOTAL</span>
          <span class="value">$${totalAmount.toFixed(2)}</span>
        </div>
      </div>
    </div>

    <div class="signatures">
      ${
        isExternalWarehouse
          ? `
        <div class="signature-block">
          <div class="signature-label">Ordered By</div>
          <div class="signature-line">
            ${boSig.base64 ? `<img src="data:image/png;base64,${boSig.base64}" />` : `<span class="signature">${boSig.name}</span>`}
          </div>
          <div class="sig-name">${boSig.name}</div>
          <div class="sig-title">${boSig.title}</div>
          <div class="sig-date">${dateStr}</div>
        </div>
      `
          : `
        <div class="signature-block">
          <div class="signature-label">Approved By</div>
          <div class="signature-line">
            ${approverSig && approverSig.base64 ? `<img src="data:image/png;base64,${approverSig.base64}" />` : `<span class="signature">${approverSig ? approverSig.name : "Approver"}</span>`}
          </div>
          <div class="sig-name">${approverSig ? approverSig.name : "Division Approver"}</div>
          <div class="sig-title">${approverSig ? approverSig.title : ""}</div>
          <div class="sig-date">${dateStr}</div>
        </div>

        <div class="signature-block">
          <div class="signature-label">Ordered By</div>
          <div class="signature-line">
            ${boSig.base64 ? `<img src="data:image/png;base64,${boSig.base64}" />` : `<span class="signature">${boSig.name}</span>`}
          </div>
          <div class="sig-name">${boSig.name}</div>
          <div class="sig-title">${boSig.title}</div>
          <div class="sig-date">${dateStr}</div>
        </div>
      `
      }
    </div>
  </div>
</body>
</html>`;
}
function generateSingleInvoicePDF(transaction, metadata) {
  try {
    const html = generateSingleInvoiceHTML(transaction, metadata);

    const blob = Utilities.newBlob(
      html,
      "text/html",
      `${metadata.invoiceId}.html`,
    );
    const pdf = blob.getAs("application/pdf");
    pdf.setName(`${metadata.invoiceId}.pdf`);

    // Determine folder path
    const division = getDivisionFromOrganization(transaction.organization);
    const department =
      metadata.formType === "CURRICULUM" ? transaction.organization : null;

    // Check for uploaded PDF
    const uploadedPdfUrl = getUploadedPdfUrl(
      transaction.transactionId,
      metadata.formType,
    );

    if (uploadedPdfUrl) {
      console.log(
        `📎 Found uploaded PDF for ${metadata.invoiceId}, creating package...`,
      );

      // Create invoice package with both PDFs
      return createInvoicePackage(pdf, uploadedPdfUrl, metadata.invoiceId, {
        formType: metadata.formType,
        division: division,
        department: department,
      });
    }

    // No uploaded PDF - save single file as before
    const folder = getInvoiceStorageFolder(
      metadata.formType,
      division,
      department,
      null,
      null,
    );

    const file = folder.createFile(pdf);
    try {
      file.setSharing(DriveApp.Access.DOMAIN, DriveApp.Permission.VIEW);
    } catch (e) {
      console.warn("Could not set file permissions:", e.message);
    }

    console.log(`✅ Invoice ${metadata.invoiceId} created: ${file.getUrl()}`);

    return {
      success: true,
      invoiceId: metadata.invoiceId,
      fileId: file.getId(),
      fileUrl: file.getUrl(),
      hasReceipt: false,
    };
  } catch (error) {
    console.error("❌ Single invoice PDF failed:", error);
    return { success: false, error: error.toString() };
  }
}

/**
 * Generates single invoice HTML
 */
function generateSingleInvoiceHTML(transaction, metadata) {
  const now = new Date();
  const dateStr = Utilities.formatDate(now, "America/New_York", "MMMM d, yyyy");

  const schoolNameBase64 = getSchoolNameBase64();
  const crestBase64 = getCrestBase64();
  const sealBase64 = getSealBase64();
  const logoBase64 = getLogoBase64();

  // Get requestor info
  const requestorInfo = getUserBudgetInfo(transaction.requestor) || {};
  const requestorName =
    `${requestorInfo.firstName || ""} ${requestorInfo.lastName || ""}`.trim() ||
    transaction.requestor;

  const division = getDivisionFromOrganization(transaction.organization);
  const divisionName = getDivisionFullName(division);

  let approverSig, boSig;
  const isAdmin = metadata.formType === "ADMIN";

  if (isAdmin) {
    approverSig = getApproverSignatureInfo(transaction.requestor);
    boSig = getBusinessOfficeSignature("ADMIN");
  } else if (metadata.formType === "FIELD_TRIP") {
    approverSig = getApproverSignatureForDivision(division);
    boSig = getBusinessOfficeSignature("FIELD_TRIP");
  } else {
    approverSig = getApproverSignatureForDivision(division);
    boSig = getBusinessOfficeSignature("CURRICULUM");
  }

  // --- Calculate Spacer to force Footer to the bottom ---
  // Header is approx 240px + thead 35px = 275px
  // 1 item row = 35-50px.
  let textLength = (transaction.description || "").length;
  let rowH = textLength > 50 ? 55 : 35;
  let currentY = 275 + rowH;

  // Gap needed to push footer to y = 692 (which is 912 total page height - 220 footer height)
  let gap = 692 - currentY;
  if (gap < 0) gap = 0;
  gap = Math.max(0, gap - 40);

  const bonheurFont = getBonheurRoyaleBase64();

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @font-face {
      font-family: 'Bonheur Royale';
      font-style: normal;
      font-weight: 400;
      src: url(data:font/truetype;base64,${bonheurFont}) format('truetype');
    }
    :root {
      --logo-green: #13381f;
    }

    @page {
      size: letter;
      margin: 0.75in;
      counter-increment: page;
      @bottom-left {
        content: "Page " counter(page) " of " counter(pages);
        font-family: 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif;
        font-size: 7pt;
        color: var(--logo-green);
        font-weight: 600;
        border-top: 1px solid var(--logo-green);
        padding-top: 8px;
      }
      @bottom-center {
        content: "Keswick Christian School Purchase Order System";
        font-family: 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif;
        font-size: 7pt;
        color: var(--logo-green);
        border-top: 1px solid var(--logo-green);
        padding-top: 8px;
      }
      @bottom-right {
        content: "";
        border-top: 1px solid var(--logo-green);
        padding-top: 8px;
      }
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif; font-size: 9pt; line-height: 1.4; color: #333; background: #ffffff; }

    .page-container { width: 100%; margin: 0 auto; background: white; position: relative; }
    .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); opacity: 0.04; z-index: 0; pointer-events: none; }
    .watermark img { width: 400px; }

    .header { margin-bottom: 18px; padding-bottom: 12px; position: relative; z-index: 1; }
    .header-top { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; column-gap: 40px; margin-bottom: 18px; }
    .school-name-img { display: flex; justify-content: flex-start; align-items: center; }
    .school-name-img img { height: 81px; width: auto; }
    .shield-crest { display: flex; justify-content: center; align-items: center; flex-shrink: 0; }
    .shield-crest img { height: 102px; width: auto; }
    .invoice-title { display: flex; justify-content: flex-end; align-items: center; text-align: right; }
    .invoice-title-text { display: flex; flex-direction: column; align-items: flex-end; }
    .main-word, .sub-word { font-family: 'Lucida Bright', 'Lucida Serif', Georgia, serif; font-size: 32pt; font-weight: 600; color: #13381f; line-height: 1.1; letter-spacing: 0.8px; }
    
    .header-bottom { display: flex; justify-content: space-between; align-items: flex-start; gap: 40px; margin-top: 15px; }
    .school-info { font-size: 10pt; color: #333; line-height: 1.7; font-weight: 500; flex: 1; max-width: 45%; }
    .invoice-details { text-align: right; font-size: 10pt; color: #333; line-height: 1.7; flex: 1; max-width: 45%; }
    .detail-row { margin-bottom: 3px; }
    .label { color: #666; display: inline; font-weight: 400; min-width: 80px; text-align: right; }
    .value { color: #000; font-weight: 700; display: inline; margin-left: 8px; }

    /* REMOVED min-height: 400px entirely to fix 1-item invoice split across pages */
    .table-wrapper { display: block; margin-bottom: 40px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 15px; position: relative; z-index: 1; }
    thead { display: table-header-group; }
    thead th { background: #f5f5f5; border-top: 2px solid var(--logo-green); border-bottom: 2px solid var(--logo-green); padding: 10px 8px; text-align: left; font-size: 8pt; font-weight: 600; text-transform: uppercase; color: #333; }
    thead th.right { text-align: right; }
    thead th.center { text-align: center; }
    tbody tr { page-break-inside: avoid; }
    tbody td { padding: 8px; border-bottom: 1px solid #eee; vertical-align: top; font-size: 9pt; }

    td.description { text-align: left; }
    td.qty { width: 40px; text-align: center; }
    td.unit-price { width: 70px; text-align: right; font-family: monospace; }
    td.amount { width: 75px; text-align: right; font-family: monospace; font-weight: 500; }

    .footer-section { margin-top: 30px; position: relative; z-index: 1; page-break-inside: avoid; }
    .totals { display: flex; justify-content: flex-end; margin-bottom: 35px; }
    .totals-box { width: 200px; border-top: 2px solid var(--logo-green); padding-top: 8px; }
    .totals-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 10pt; }
    .totals-row.grand { font-size: 14pt; font-weight: 700; }
    .totals-row.grand .value { color: var(--logo-green); }

    .signatures { display: flex; justify-content: space-between; padding-top: 25px; border-top: 2px solid var(--logo-green); }
    .signature-block { text-align: center; width: 220px; }
    .signature-label { font-size: 8pt; color: var(--logo-green); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px; font-weight: 600; }
    .signature-line { height: 55px; border-bottom: 2px solid var(--logo-green); display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px; }
    .signature-line .signature-text { font-family: 'Bonheur Royale', cursive; font-size: 28pt; color: #000; line-height: 1; }
    .signature-line img { max-width: 160px; max-height: 48px; object-fit: contain; }
    .sig-name { font-weight: 600; font-size: 9pt; }
    .sig-title { font-size: 8pt; color: #666; }
    .sig-date { font-size: 8pt; color: #999; margin-top: 3px; }
  </style>
</head>
<body>
  <div class="page-container">
    ${sealBase64 ? `<div class="watermark"><img src="data:image/jpeg;base64,${sealBase64}" /></div>` : ""}

    <div class="header">
      <div class="header-top">
        <div class="school-name-img">
          ${schoolNameBase64 ? `<img src="data:image/png;base64,${schoolNameBase64}" alt="Keswick Christian School" />` : logoBase64 ? `<img src="data:image/png;base64,${logoBase64}" alt="Keswick Christian School" />` : `<div style="font-family: 'Lucida Bright', Georgia, serif; font-size: 18pt; font-weight: 600; color: var(--logo-green);">Keswick Christian School</div>`}
        </div>
        <div class="shield-crest">
          ${crestBase64 ? `<img src="data:image/png;base64,${crestBase64}" alt="KCS Crest" />` : sealBase64 ? `<img src="data:image/jpeg;base64,${sealBase64}" alt="KCS Seal" />` : ""}
        </div>
        <div class="invoice-title">
          <div class="invoice-title-text">
            <div class="main-word">Purchase</div>
            <div class="sub-word">Order</div>
          </div>
        </div>
      </div>

      <div class="header-bottom">
        <div class="school-info">
          10101 54th Avenue North<br>
          St. Petersburg, FL 33708<br>
          businessoffice@keswickchristian.org<br>
          (727) 522-2111
        </div>
        <div class="invoice-details">
          <div class="detail-row"><span class="label">Order No:</span> <span class="value">${transaction.transactionId}</span></div>
          <div class="detail-row"><span class="label">Date:</span> <span class="value">${dateStr}</span></div>
          <div class="detail-row"><span class="label">Division:</span> <span class="value">${divisionName || division}</span></div>
          ${!isAdmin ? `<div class="detail-row"><span class="label">Requestor:</span> <span class="value">${requestorName}</span></div>` : ""}
        </div>
      </div>
    </div>

    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th class="center">Qty</th>
            <th class="right">Unit Price</th>
            <th class="right">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="description">${transaction.description || "Purchase"}</td>
            <td class="qty">1</td>
            <td class="unit-price">$${transaction.amount.toFixed(2)}</td>
            <td class="amount">$${transaction.amount.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- dynamically calculated spacer to push the footer to the bottom of the page -->
    <div style="height: ${gap}px;"></div>

    <div class="footer-section">
      <div class="totals">
        <div class="totals-box">
          <div class="totals-row">
            <span>Line items</span>
            <span class="value">1</span>
          </div>
          <div class="totals-row grand">
            <span>TOTAL</span>
            <span class="value">$${transaction.amount.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div class="signatures">
        <div class="signature-block">
          <div class="signature-label">Approved By</div>
          <div class="signature-line">
            ${approverSig && approverSig.base64 ? `<img src="data:image/png;base64,${approverSig.base64}" />` : `<span class="signature-text">${approverSig ? approverSig.name : "Approver"}</span>`}
          </div>
          <div class="sig-name">${approverSig ? approverSig.name : isAdmin ? "Administrator" : "Division Approver"}</div>
          <div class="sig-title">${approverSig ? approverSig.title : ""}</div>
          <div class="sig-date">${dateStr}</div>
        </div>

        <div class="signature-block">
          <div class="signature-label">Ordered By</div>
          <div class="signature-line">
            ${boSig && boSig.base64 ? `<img src="data:image/png;base64,${boSig.base64}" />` : `<span class="signature-text">${boSig ? boSig.name : "Business Office"}</span>`}
          </div>
          <div class="sig-name">${boSig ? boSig.name : "Business Office"}</div>
          <div class="sig-title">${boSig ? boSig.title : ""}</div>
          <div class="sig-date">${dateStr}</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}
// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Gets division code from organization name
 */
function getDivisionFromOrganization(org) {
  if (!org) return "AD";
  const orgLower = org.toString().toLowerCase();

  if (orgLower.includes("upper") || orgLower === "us") return "US";
  if (orgLower.includes("lower") || orgLower === "ls") return "LS";
  if (
    orgLower.includes("keswick kids") ||
    orgLower === "kk" ||
    orgLower.includes("prek")
  )
    return "KK";
  if (orgLower.includes("admin")) return "AD";

  // Check if it's a department name - map to division
  const deptDivisionMap = {
    math: "US",
    science: "US",
    english: "US",
    history: "US",
    elementary: "LS",
    kindergarten: "KK",
    prek: "KK",
  };

  for (const [dept, div] of Object.entries(deptDivisionMap)) {
    if (orgLower.includes(dept)) return div;
  }

  return "AD";
}

/**
 * Gets full division name
 */
function getDivisionFullName(divCode) {
  const names = {
    US: "Upper School",
    LS: "Lower School",
    KK: "Keswick Kids",
    AD: "Admin",
  };
  return names[divCode] || divCode || "General";
}

/**
 * Gets display name from email address
 * Looks up in UserDirectory, falls back to formatted email prefix
 */
function getDisplayNameFromEmail(email) {
  if (!email) return "";

  try {
    // Try to look up in UserDirectory
    const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
    const userSheet = budgetHub.getSheetByName("UserDirectory");

    if (userSheet) {
      const data = userSheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (
          data[i][0] &&
          data[i][0].toString().toLowerCase() === email.toLowerCase()
        ) {
          const firstName = data[i][1] || "";
          const lastName = data[i][2] || "";
          if (firstName || lastName) {
            return `${firstName} ${lastName}`.trim();
          }
        }
      }
    }
  } catch (e) {
    // Fall through to fallback
  }

  // Fallback: Format email prefix nicely (e.g., "sjohnson" -> "S Johnson")
  const prefix = email.split("@")[0];
  // Try to split on common patterns
  const match = prefix.match(/^([a-z])([a-z]+)$/i);
  if (match) {
    // Single word like "sjohnson" - capitalize first letter
    return prefix.charAt(0).toUpperCase() + prefix.slice(1);
  }
  // Return as-is with first letter capitalized
  return prefix.charAt(0).toUpperCase() + prefix.slice(1);
}

/**
 * Gets department code for invoice ID
 */
function getDepartmentCode(org) {
  if (!org) return "GEN";

  const codes = {
    math: "MATH",
    science: "SCI",
    english: "ENG",
    history: "HIST",
    "foreign language": "LANG",
    spanish: "LANG",
    bible: "BIBL",
    art: "ART",
    music: "MUS",
    pe: "PE",
    "physical education": "PE",
    technology: "TECH",
    library: "LIB",
    media: "LIB",
  };

  const orgLower = org.toString().toLowerCase();
  for (const [key, code] of Object.entries(codes)) {
    if (orgLower.includes(key)) return code;
  }

  return org.toString().substring(0, 4).toUpperCase();
}

/**
 * Gets approver signature for a division
 */
function getApproverSignatureForDivision(division) {
  const approvers = {
    US: "lmortimer@keswickchristian.org",
    LS: "ddumais@keswickchristian.org",
    KK: "scarmichael@keswickchristian.org",
    AD: CONFIG.BUSINESS_OFFICE_EMAIL,
  };

  const email = approvers[division] || approvers["AD"];
  return getApproverSignatureInfo(email);
}

/**
 * Gets business office signature based on form type
 */
function getBusinessOfficeSignature(formType) {
  const type = formType.toString().toUpperCase();

  // CFO signs Field Trip and Admin
  if (type === "FIELD_TRIP" || type === "ADMIN") {
    return {
      name: "Beth Endrulat",
      title: "Chief Financial Officer",
      base64: getSignatureBase64ForUser("bendrulat@keswickchristian.org"),
    };
  }

  // BO signs Amazon, Warehouse, Curriculum
  return {
    name: "Sherilyn Neel",
    title: "Business Office",
    base64: getSignatureBase64ForUser("sneel@keswickchristian.org"),
  };
}

/**
 * Gets signature base64 for a user
 */
function getSignatureBase64ForUser(email) {
  // Try to get from SIGNATURE_CONFIG if defined
  if (typeof SIGNATURE_CONFIG !== "undefined" && SIGNATURE_CONFIG[email]) {
    const config = SIGNATURE_CONFIG[email];
    if (config.fileId) {
      return getSignatureBase64(config.fileId);
    }
  }
  return null;
}

/**
 * Gets logo as base64
 */
function getLogoBase64() {
  try {
    const logoId = "1HDkW_xGIc4jOBH4REnXb3VJcZaEjPHKj"; // KCS text logo
    const file = DriveApp.getFileById(logoId);
    return Utilities.base64Encode(file.getBlob().getBytes());
  } catch (e) {
    console.warn("Could not load logo:", e);
    return null;
  }
}

/**
 * Gets seal as base64
 */
function getSealBase64() {
  try {
    // Look for seal in signatures folder or use uploaded seal
    const folders = DriveApp.getFoldersByName("Budget_System_Signatures");
    if (folders.hasNext()) {
      const folder = folders.next();
      const files = folder.getFilesByName("seal.jpg");
      if (files.hasNext()) {
        return Utilities.base64Encode(files.next().getBlob().getBytes());
      }
    }
    return null;
  } catch (e) {
    console.warn("Could not load seal:", e);
    return null;
  }
}

/**
 * Gets school crest/shield image as base64 for centered header
 */
function getCrestBase64() {
  try {
    // Look for crest in Budget_System_Assets folder
    const folders = DriveApp.getFoldersByName("Budget_System_Assets");
    if (folders.hasNext()) {
      const folder = folders.next();
      const files = folder.getFilesByName("crest.png");
      if (files.hasNext()) {
        return Utilities.base64Encode(files.next().getBlob().getBytes());
      }
    }
    // Fallback: use seal as crest
    return getSealBase64();
  } catch (e) {
    console.warn("Could not load crest:", e);
    return null;
  }
}

/**
 * Gets school name image as base64 for left side of header
 */
function getSchoolNameBase64() {
  try {
    // Look for school-name in Budget_System_Assets folder
    const folders = DriveApp.getFoldersByName("Budget_System_Assets");
    if (folders.hasNext()) {
      const folder = folders.next();
      const files = folder.getFilesByName("school-name.png");
      if (files.hasNext()) {
        return Utilities.base64Encode(files.next().getBlob().getBytes());
      }
    }
    // Fallback: use existing logo
    return getLogoBase64();
  } catch (e) {
    console.warn("Could not load school name:", e);
    return null;
  }
}

/**
 * Gets current fiscal quarter string
 */
function getCurrentFiscalQuarter() {
  const month = new Date().getMonth();
  if (month >= 6 && month <= 8) return "Q1";
  if (month >= 9 && month <= 11) return "Q2";
  if (month >= 0 && month <= 2) return "Q3";
  return "Q4";
}

// ============================================================================
// BATCH TRIGGERS SETUP
// ============================================================================

/**
 * Creates triggers for Warehouse (Wed) batch
 */
function setupBatchInvoiceTriggers() {
  // Remove existing batch triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach((trigger) => {
    const fn = trigger.getHandlerFunction();
    if (fn === "runWarehouseBatch") {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // Warehouse batch - Wednesday 6 AM
  ScriptApp.newTrigger("runWarehouseBatch")
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.WEDNESDAY)
    .atHour(6)
    .create();

  console.log("✅ Batch invoice triggers created: Warehouse (Wed 6AM)");
}

// ============================================================================
// TEST FUNCTIONS
// ============================================================================

/**
 * Test batch invoice generation with sample data
 * Includes: grouped transactions (same ID), multi-page support (25+ items)
 */
function testBatchInvoice() {
  // Test data with display names (matching preview format)
  const sampleTransactions = [
    // Group 1: Sarah Johnson - 3 items under same transaction ID
    {
      transactionId: "AMZ-0142",
      requestor: "Sarah Johnson",
      organization: "Upper School",
      amount: 74.97,
      description: "Science Lab Safety Goggles (12-pack)",
    },
    {
      transactionId: "AMZ-0142",
      requestor: "Sarah Johnson",
      organization: "Upper School",
      amount: 62.5,
      description: "Digital Thermometer Set",
    },
    {
      transactionId: "AMZ-0142",
      requestor: "Sarah Johnson",
      organization: "Upper School",
      amount: 37.5,
      description: "Beaker Set 250ml (6-pack)",
    },

    // Group 2: Mike Chen - 2 items
    {
      transactionId: "AMZ-0145",
      requestor: "Mike Chen",
      organization: "Upper School",
      amount: 589.95,
      description: "TI-84 Plus CE Graphing Calculator",
    },
    {
      transactionId: "AMZ-0145",
      requestor: "Mike Chen",
      organization: "Upper School",
      amount: 35.0,
      description: "Classroom Whiteboard Markers, Bulk",
    },

    // Single item transactions
    {
      transactionId: "AMZ-0151",
      requestor: "Lisa Park",
      organization: "Upper School",
      amount: 45.99,
      description: "HP Printer Paper, 8.5x11, 10 reams",
    },

    // Group 3: David Wilson - 3 items
    {
      transactionId: "AMZ-0153",
      requestor: "David Wilson",
      organization: "Upper School",
      amount: 113.94,
      description: "Acrylic Paint Set, 24 colors",
    },
    {
      transactionId: "AMZ-0153",
      requestor: "David Wilson",
      organization: "Upper School",
      amount: 53.94,
      description: "Artist Brush Set, 15-piece",
    },
    {
      transactionId: "AMZ-0153",
      requestor: "David Wilson",
      organization: "Upper School",
      amount: 39.24,
      description: "Canvas Panel, 11x14, 6-pack",
    },

    // More items for multi-page testing
    {
      transactionId: "AMZ-0155",
      requestor: "Emily Davis",
      organization: "Upper School",
      amount: 225.0,
      description: "To Kill a Mockingbird, Paperback",
    },
    {
      transactionId: "AMZ-0156",
      requestor: "John Smith",
      organization: "Upper School",
      amount: 89.99,
      description: "Document Camera for Classroom",
    },
    {
      transactionId: "AMZ-0157",
      requestor: "Amy Brown",
      organization: "Upper School",
      amount: 149.99,
      description: "Laminating Machine",
    },
    {
      transactionId: "AMZ-0158",
      requestor: "Chris Jones",
      organization: "Upper School",
      amount: 29.99,
      description: "Stapler Heavy Duty",
    },
    {
      transactionId: "AMZ-0159",
      requestor: "Mary Williams",
      organization: "Upper School",
      amount: 75.0,
      description: "Classroom Timer Set",
    },
    {
      transactionId: "AMZ-0160",
      requestor: "Kevin Thomas",
      organization: "Upper School",
      amount: 199.99,
      description: "Wireless Presentation Clicker",
    },
    {
      transactionId: "AMZ-0161",
      requestor: "Linda Miller",
      organization: "Upper School",
      amount: 45.5,
      description: "Dry Erase Markers, Assorted Colors",
    },
    {
      transactionId: "AMZ-0162",
      requestor: "Robert Garcia",
      organization: "Upper School",
      amount: 189.0,
      description: "Scientific Calculator",
    },
    {
      transactionId: "AMZ-0163",
      requestor: "Nancy Martinez",
      organization: "Upper School",
      amount: 65.0,
      description: "Protractors and Rulers Set",
    },
    {
      transactionId: "AMZ-0164",
      requestor: "Steve Anderson",
      organization: "Upper School",
      amount: 125.0,
      description: "Colored Pencils, Classroom Pack",
    },
    {
      transactionId: "AMZ-0165",
      requestor: "Tina Taylor",
      organization: "Upper School",
      amount: 85.0,
      description: "Classroom Headphones",
    },
    {
      transactionId: "AMZ-0166",
      requestor: "William Moore",
      organization: "Upper School",
      amount: 299.99,
      description: "Portable Projector",
    },
    {
      transactionId: "AMZ-0167",
      requestor: "Helen Jackson",
      organization: "Upper School",
      amount: 55.0,
      description: "Globe, 12-inch Diameter",
    },
    {
      transactionId: "AMZ-0168",
      requestor: "Paul White",
      organization: "Upper School",
      amount: 175.0,
      description: "Wall Maps, US and World Set",
    },
    {
      transactionId: "AMZ-0169",
      requestor: "Diana Harris",
      organization: "Upper School",
      amount: 95.0,
      description: "Reading Light Set",
    },
  ];

  const result = generateBatchInvoicePDF(sampleTransactions, {
    invoiceId: "AMZ-US-0212-TEST",
    formType: "AMAZON",
    division: "US",
    isExternal: false,
  });

  console.log("Test result:", result);
  return result;
}

/**
 * Test single invoice generation
 */
function testSingleInvoice() {
  const sampleTransaction = {
    transactionId: "FLD-0001",
    orderId: null,
    date: new Date(),
    requestor: "teacher1@keswickchristian.org",
    approver: "lmortimer@keswickchristian.org",
    organization: "Upper School",
    form: "FIELD_TRIP",
    amount: 450.0,
    description: "Museum of Science field trip - 45 students",
    fiscalQuarter: "Q3",
  };

  const result = generateSingleInvoicePDF(sampleTransaction, {
    invoiceId: "FLD-US-0211-TEST",
    formType: "FIELD_TRIP",
  });

  console.log("Test result:", result);
  return result;
}

// ============================================================================
// DEMO INVOICE GENERATION - All Form Types
// ============================================================================

/**
 * Generate sample invoices for ALL form types for demo purposes
 * Creates a complete set of invoices in the Budget_System_Invoices folder
 */
function generateAllDemoInvoices() {
  console.log("🎯 Generating demo invoices for all form types...");
  const results = {
    amazon: null,
    warehouse: null,
    warehouseExternal: null,
    fieldTrip: null,
    curriculum: null,
    admin: null,
  };

  // 1. Amazon Batch Invoice (Upper School)
  console.log("📦 Generating Amazon batch invoice...");
  results.amazon = generateDemoAmazonInvoice();

  // 2. Warehouse Internal Batch Invoice (Lower School)
  console.log("🏪 Generating Warehouse internal invoice...");
  results.warehouse = generateDemoWarehouseInternalInvoice();

  // 3. Warehouse External Invoice (Combined)
  console.log("📋 Generating Warehouse external invoice...");
  results.warehouseExternal = generateDemoWarehouseExternalInvoice();

  // 4. Field Trip Single Invoice
  console.log("🚌 Generating Field Trip invoice...");
  results.fieldTrip = generateDemoFieldTripInvoice();

  // 5. Curriculum Single Invoice
  console.log("📚 Generating Curriculum invoice...");
  results.curriculum = generateDemoCurriculumInvoice();

  // 6. Admin Single Invoice
  console.log("🏢 Generating Admin invoice...");
  results.admin = generateDemoAdminInvoice();

  console.log("✅ Demo invoice generation complete!");
  console.log("Results:", JSON.stringify(results, null, 2));

  return results;
}

/**
 * Demo Amazon Batch Invoice
 */
function generateDemoAmazonInvoice() {
  const transactions = [
    {
      transactionId: "AMZ-DEMO-001",
      requestor: "Sarah Johnson",
      organization: "Upper School",
      amount: 299.99,
      description: "TI-84 Plus CE Graphing Calculator (5 pack)",
    },
    {
      transactionId: "AMZ-DEMO-001",
      requestor: "Sarah Johnson",
      organization: "Upper School",
      amount: 89.99,
      description: "Scientific Calculator (10 pack)",
    },
    {
      transactionId: "AMZ-DEMO-002",
      requestor: "Michael Chen",
      organization: "Upper School",
      amount: 149.95,
      description: "Classroom Headphones, Bulk Pack",
    },
    {
      transactionId: "AMZ-DEMO-003",
      requestor: "Emily Davis",
      organization: "Upper School",
      amount: 225.0,
      description: "Literature Set - To Kill a Mockingbird (30 copies)",
    },
    {
      transactionId: "AMZ-DEMO-003",
      requestor: "Emily Davis",
      organization: "Upper School",
      amount: 175.5,
      description: "Literature Set - The Great Gatsby (30 copies)",
    },
    {
      transactionId: "AMZ-DEMO-004",
      requestor: "Robert Martinez",
      organization: "Upper School",
      amount: 445.0,
      description: "Lab Equipment - Microscope Set",
    },
    {
      transactionId: "AMZ-DEMO-005",
      requestor: "Jennifer Wilson",
      organization: "Upper School",
      amount: 85.0,
      description: "Art Supplies - Acrylic Paint Set",
    },
  ];

  return generateBatchInvoicePDF(transactions, {
    invoiceId: "AMZ-US-DEMO",
    formType: "AMAZON",
    division: "US",
    isExternal: false,
  });
}

/**
 * Demo Warehouse Internal Invoice (Lower School)
 */
function generateDemoWarehouseInternalInvoice() {
  const transactions = [
    {
      transactionId: "WHS-DEMO-001",
      requestor: "Amanda Foster",
      organization: "Lower School",
      amount: 45.5,
      description: "Copy Paper, 8.5x11, 10 reams",
    },
    {
      transactionId: "WHS-DEMO-001",
      requestor: "Amanda Foster",
      organization: "Lower School",
      amount: 28.75,
      description: "Pencils #2, Gross Box",
    },
    {
      transactionId: "WHS-DEMO-002",
      requestor: "Thomas Brown",
      organization: "Lower School",
      amount: 67.25,
      description: "Glue Sticks, Bulk Pack",
    },
    {
      transactionId: "WHS-DEMO-002",
      requestor: "Thomas Brown",
      organization: "Lower School",
      amount: 32.0,
      description: "Scissors, Safety, 24 pack",
    },
    {
      transactionId: "WHS-DEMO-003",
      requestor: "Karen White",
      organization: "Lower School",
      amount: 89.99,
      description: "Construction Paper, Assorted Colors",
    },
  ];

  return generateBatchInvoicePDF(transactions, {
    invoiceId: "WHS-LS-DEMO",
    formType: "WAREHOUSE",
    division: "LS",
    isExternal: false,
  });
}

/**
 * Demo Warehouse External Invoice (Combined for vendor)
 */
function generateDemoWarehouseExternalInvoice() {
  const transactions = [
    {
      transactionId: "WHS-EXT-001",
      requestor: "Upper School",
      organization: "Upper School",
      amount: 125.0,
      description: "Printer Toner, Black",
    },
    {
      transactionId: "WHS-EXT-002",
      requestor: "Lower School",
      organization: "Lower School",
      amount: 89.5,
      description: "Laminating Pouches, 200 count",
    },
    {
      transactionId: "WHS-EXT-003",
      requestor: "Keswick Kids",
      organization: "Keswick Kids",
      amount: 45.75,
      description: "Crayons, Classroom Pack",
    },
    {
      transactionId: "WHS-EXT-004",
      requestor: "Admin",
      organization: "Admin",
      amount: 156.0,
      description: "Office Supplies - Misc",
    },
  ];

  const todayForId = new Date();
  const dateStrShort = Utilities.formatDate(
    todayForId,
    "America/New_York",
    "MMddyy",
  );

  return generateBatchInvoicePDF(transactions, {
    invoiceId: `PCW-${dateStrShort}-DEMO`,
    formType: "WAREHOUSE",
    division: null,
    isExternal: true,
  });
}

/**
 * Demo Field Trip Invoice
 */
function generateDemoFieldTripInvoice() {
  const transaction = {
    transactionId: "FLD-DEMO-001",
    orderId: null,
    date: new Date(),
    requestor: "teacher1@keswickchristian.org",
    approver: "lmortimer@keswickchristian.org",
    organization: "Upper School",
    form: "FIELD_TRIP",
    amount: 1250.0,
    description:
      "Museum of Science & Industry Field Trip - Grade 10 Biology (45 students, includes admission and bus)",
    fiscalQuarter: getCurrentFiscalQuarter(),
  };

  return generateSingleInvoicePDF(transaction, {
    invoiceId: "FLD-US-DEMO",
    formType: "FIELD_TRIP",
  });
}

/**
 * Demo Curriculum Invoice
 */
function generateDemoCurriculumInvoice() {
  const transaction = {
    transactionId: "CUR-DEMO-001",
    orderId: null,
    date: new Date(),
    requestor: "mathhead@keswickchristian.org",
    approver: "lmortimer@keswickchristian.org",
    organization: "Math",
    form: "CURRICULUM",
    amount: 875.0,
    description:
      "Saxon Math Curriculum Update - Grade 7 Teacher Editions and Student Workbooks",
    fiscalQuarter: getCurrentFiscalQuarter(),
  };

  return generateSingleInvoicePDF(transaction, {
    invoiceId: "CUR-MATH-DEMO",
    formType: "CURRICULUM",
  });
}

/**
 * Demo Admin Invoice
 */
function generateDemoAdminInvoice() {
  const transaction = {
    transactionId: "ADM-DEMO-001",
    orderId: null,
    date: new Date(),
    requestor: "mtrotter@keswickchristian.org",
    approver: "cfo@keswickchristian.org",
    organization: "Admin",
    form: "ADMIN",
    amount: 2500.0,
    description: "Annual Software License Renewal - Student Information System",
    fiscalQuarter: getCurrentFiscalQuarter(),
  };

  return generateSingleInvoicePDF(transaction, {
    invoiceId: "ADM-MJT-DEMO",
    formType: "ADMIN",
  });
}

/**
 * Check existing test data in queues
 */
function checkQueueTestData() {
  console.log("📊 Checking for existing test data in queues...");
  const report = {
    automatedQueue: { amazon: 0, warehouse: 0 },
    manualQueue: { fieldTrip: 0, curriculum: 0, admin: 0 },
    transactionLedger: { total: 0, unprocessed: 0 },
  };

  try {
    // Check Automated Hub
    const automatedHub = SpreadsheetApp.openById(CONFIG.AUTOMATED_HUB_ID);
    const autoQueue = automatedHub.getSheetByName("AutomatedQueue");
    if (autoQueue) {
      const autoData = autoQueue.getDataRange().getValues();
      for (let i = 1; i < autoData.length; i++) {
        const type = (autoData[i][2] || "").toString().toUpperCase();
        if (type.includes("AMAZON")) report.automatedQueue.amazon++;
        if (type.includes("WAREHOUSE")) report.automatedQueue.warehouse++;
      }
    }

    // Check Manual Hub
    const manualHub = SpreadsheetApp.openById(CONFIG.MANUAL_HUB_ID);
    const manualQueue = manualHub.getSheetByName("ManualQueue");
    if (manualQueue) {
      const manualData = manualQueue.getDataRange().getValues();
      for (let i = 1; i < manualData.length; i++) {
        const type = (manualData[i][2] || "").toString().toUpperCase();
        if (type.includes("FIELD")) report.manualQueue.fieldTrip++;
        if (type.includes("CURRICULUM")) report.manualQueue.curriculum++;
        if (type.includes("ADMIN")) report.manualQueue.admin++;
      }
    }

    // Check Transaction Ledger
    const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
    const ledger = budgetHub.getSheetByName("TransactionLedger");
    if (ledger) {
      const ledgerData = ledger.getDataRange().getValues();
      report.transactionLedger.total = ledgerData.length - 1;
      for (let i = 1; i < ledgerData.length; i++) {
        if (!ledgerData[i][10]) {
          // InvoiceGenerated column empty
          report.transactionLedger.unprocessed++;
        }
      }
    }

    console.log("Queue Status Report:");
    console.log("====================");
    console.log("Automated Queue:");
    console.log(`  - Amazon: ${report.automatedQueue.amazon} items`);
    console.log(`  - Warehouse: ${report.automatedQueue.warehouse} items`);
    console.log("Manual Queue:");
    console.log(`  - Field Trip: ${report.manualQueue.fieldTrip} items`);
    console.log(`  - Curriculum: ${report.manualQueue.curriculum} items`);
    console.log(`  - Admin: ${report.manualQueue.admin} items`);
    console.log("Transaction Ledger:");
    console.log(`  - Total: ${report.transactionLedger.total} transactions`);
    console.log(
      `  - Unprocessed: ${report.transactionLedger.unprocessed} transactions`,
    );

    return report;
  } catch (error) {
    console.error("Error checking queues:", error);
    return { error: error.toString() };
  }
}
