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
  const mmdd = String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');

  // Determine prefix and identifier
  let prefix, identifier;

  if (!formType) {
    formType = 'INV';
  }

  switch (formType.toUpperCase()) {
    case 'AMAZON':
      prefix = 'AMZ';
      identifier = divisionOrId; // US, LS, KK
      break;
    case 'WAREHOUSE':
    case 'WAREHOUSE_INTERNAL':
      prefix = 'WHS';
      identifier = divisionOrId; // US, LS, KK
      break;
    case 'WAREHOUSE_EXTERNAL':
      prefix = 'WHS';
      identifier = null; // No division for external
      break;
    case 'FIELD_TRIP':
      prefix = 'FLD';
      identifier = divisionOrId; // US, LS, KK
      break;
    case 'CURRICULUM':
      prefix = 'CUR';
      identifier = divisionOrId; // MATH, SCIENCE, etc.
      break;
    case 'ADMIN':
      prefix = 'ADM';
      identifier = divisionOrId; // User initials (MJT, etc.)
      break;
    default:
      prefix = 'INV';
      identifier = divisionOrId;
  }

  // Build base ID
  const baseId = identifier ? `${prefix}-${identifier}-${mmdd}` : `${prefix}-${mmdd}`;

  // Check for existing IDs today and increment if needed
  const todayIds = existingIds.filter(id => id && id.startsWith(baseId));

  if (todayIds.length === 0) {
    return baseId; // First invoice of the day
  }

  // Find highest increment
  let maxIncrement = 1;
  todayIds.forEach(id => {
    const match = id.match(/-(\d+)$/);
    if (match) {
      maxIncrement = Math.max(maxIncrement, parseInt(match[1]));
    }
  });

  return `${baseId}-${String(maxIncrement + 1).padStart(2, '0')}`;
}

/**
 * Gets user initials from email for Admin invoice IDs
 */
function getUserInitials(email) {
  const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
  const userSheet = budgetHub.getSheetByName('UserDirectory');
  const data = userSheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] && data[i][0].toString().toLowerCase() === email.toLowerCase()) {
      const firstName = data[i][1] || '';
      const lastName = data[i][2] || '';
      return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || email.split('@')[0].substring(0, 3).toUpperCase();
    }
  }

  // Fallback: use first 3 chars of email
  return email.split('@')[0].substring(0, 3).toUpperCase();
}

// ============================================================================
// BATCH INVOICE GENERATION
// ============================================================================

/**
 * Runs Amazon batch invoicing (called Tuesday & Friday)
 */
function runAmazonBatch() {
  console.log('📦 === AMAZON BATCH INVOICING ===');
  return runBatchInvoicing('AMAZON');
}

/**
 * Runs Warehouse batch invoicing (called Wednesday)
 */
function runWarehouseBatch() {
  console.log('🏪 === WAREHOUSE BATCH INVOICING ===');

  // Generate internal invoices (by division)
  const internalResult = runBatchInvoicing('WAREHOUSE_INTERNAL');

  // Generate external invoice (all combined)
  const externalResult = generateWarehouseExternalInvoice();

  return {
    internal: internalResult,
    external: externalResult
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
    console.log('Batch skipped: system busy');
    return { success: false, error: 'System locked' };
  }

  try {
    const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
    const ledger = budgetHub.getSheetByName('TransactionLedger');

    if (!ledger) {
      return { success: true, invoicesGenerated: 0, message: 'No ledger found' };
    }

    const data = ledger.getDataRange().getValues();
    const headers = data[0];

    // Find column indices
    const cols = {
      transactionId: 0, orderId: 1, processedOn: 2, requestor: 3,
      approver: 4, organization: 5, form: 6, amount: 7,
      description: 8, fiscalQuarter: 9, invoiceGenerated: 10,
      invoiceId: 11, invoiceUrl: 12
    };

    // Filter for matching form type, not yet invoiced
    const formTypeMatch = formType.replace('_INTERNAL', '').toUpperCase();
    const pendingTransactions = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowForm = (row[cols.form] || '').toString().toUpperCase();
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
          fiscalQuarter: row[cols.fiscalQuarter]
        });
      }
    }

    if (pendingTransactions.length === 0) {
      console.log('No pending transactions to invoice');
      return { success: true, invoicesGenerated: 0 };
    }

    console.log(`Found ${pendingTransactions.length} ${formTypeMatch} transactions to invoice`);

    // Group by division
    const byDivision = {};
    pendingTransactions.forEach(txn => {
      const div = getDivisionFromOrganization(txn.organization) || 'OTHER';
      if (!byDivision[div]) byDivision[div] = [];
      byDivision[div].push(txn);
    });

    // Get existing invoice IDs for today (to handle increments)
    const existingIds = data.slice(1).map(row => row[cols.invoiceId]).filter(Boolean);

    const results = [];

    // Generate invoice for each division
    for (const [division, transactions] of Object.entries(byDivision)) {
      if (transactions.length === 0) continue;

      const invoiceId = generateInvoiceId(formType, division, existingIds);
      existingIds.push(invoiceId); // Add to list for increment tracking

      console.log(`Generating ${invoiceId} with ${transactions.length} transactions`);

      const result = generateBatchInvoicePDF(transactions, {
        invoiceId: invoiceId,
        formType: formTypeMatch,
        division: division,
        isExternal: false
      });

      if (result.success) {
        // Update ledger rows
        transactions.forEach(txn => {
          ledger.getRange(txn.row, cols.invoiceGenerated + 1).setValue('YES');
          ledger.getRange(txn.row, cols.invoiceId + 1).setValue(invoiceId);
          ledger.getRange(txn.row, cols.invoiceUrl + 1).setValue(result.fileUrl);
        });

        results.push({
          invoiceId: invoiceId,
          division: division,
          transactionCount: transactions.length,
          total: transactions.reduce((sum, t) => sum + t.amount, 0),
          fileUrl: result.fileUrl
        });
      }
    }

    console.log(`✅ Generated ${results.length} ${formTypeMatch} invoices`);
    return { success: true, invoicesGenerated: results.length, invoices: results };

  } catch (error) {
    console.error('❌ Batch invoicing failed:', error);
    return { success: false, error: error.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Generates the combined external warehouse invoice
 */
function generateWarehouseExternalInvoice() {
  const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
  const ledger = budgetHub.getSheetByName('TransactionLedger');

  if (!ledger) return { success: false, error: 'No ledger' };

  const data = ledger.getDataRange().getValues();

  // Find warehouse transactions invoiced today (from internal batch)
  const today = new Date();
  const todayStr = Utilities.formatDate(today, 'America/New_York', 'MMdd');

  const warehouseTransactions = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const form = (row[6] || '').toString().toUpperCase();
    const invoiceId = row[11] || '';

    // Match warehouse transactions invoiced today
    if (form === 'WAREHOUSE' && invoiceId.includes(`WHS-`) && invoiceId.includes(`-${todayStr}`)) {
      warehouseTransactions.push({
        transactionId: row[0],
        requestor: row[3],
        organization: row[5],
        amount: parseFloat(row[7]) || 0,
        description: row[8]
      });
    }
  }

  if (warehouseTransactions.length === 0) {
    return { success: true, message: 'No warehouse transactions for external invoice' };
  }

  const invoiceId = generateInvoiceId('WAREHOUSE_EXTERNAL', null);

  const result = generateBatchInvoicePDF(warehouseTransactions, {
    invoiceId: invoiceId,
    formType: 'WAREHOUSE',
    division: null,
    isExternal: true
  });

  return result;
}

// ============================================================================
// SINGLE INVOICE GENERATION (On Approval)
// ============================================================================

/**
 * Generates a single invoice for Field Trip, Curriculum, or Admin
 * Called immediately upon approval
 */
function generateSingleInvoice(transactionId) {
  console.log(`📄 Generating single invoice for ${transactionId}`);

  const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
  const ledger = budgetHub.getSheetByName('TransactionLedger');

  if (!ledger) {
    return { success: false, error: 'TransactionLedger not found' };
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
        fiscalQuarter: data[i][9]
      };
      rowIndex = i + 1;
      break;
    }
  }

  if (!transaction) {
    return { success: false, error: 'Transaction not found' };
  }

  // Determine invoice ID based on form type
  const formType = transaction.form.toUpperCase();
  let invoiceId;

  const existingIds = data.slice(1).map(row => row[11]).filter(Boolean);

  switch (formType) {
    case 'FIELD_TRIP':
      const ftDivision = getDivisionFromOrganization(transaction.organization);
      invoiceId = generateInvoiceId('FIELD_TRIP', ftDivision, existingIds);
      break;
    case 'CURRICULUM':
      const deptCode = getDepartmentCode(transaction.organization);
      invoiceId = generateInvoiceId('CURRICULUM', deptCode, existingIds);
      break;
    case 'ADMIN':
      const initials = getUserInitials(transaction.requestor);
      invoiceId = generateInvoiceId('ADMIN', initials, existingIds);
      break;
    default:
      invoiceId = generateInvoiceId(formType, 'GEN', existingIds);
  }

  // Generate the PDF
  const result = generateSingleInvoicePDF(transaction, {
    invoiceId: invoiceId,
    formType: formType
  });

  if (result.success) {
    // Update ledger
    ledger.getRange(rowIndex, 11).setValue('YES');
    ledger.getRange(rowIndex, 12).setValue(invoiceId);
    ledger.getRange(rowIndex, 13).setValue(result.fileUrl);
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

    const blob = Utilities.newBlob(html, 'text/html', `${metadata.invoiceId}.html`);
    const pdf = blob.getAs('application/pdf');
    pdf.setName(`${metadata.invoiceId}.pdf`);

    // Store in appropriate folder
    const folder = getInvoiceStorageFolder(
      metadata.formType,
      metadata.division,
      null,
      null,
      null
    );

    const file = folder.createFile(pdf);
    file.setSharing(DriveApp.Access.DOMAIN, DriveApp.Permission.VIEW);

    console.log(`✅ Invoice ${metadata.invoiceId} created: ${file.getUrl()}`);

    return {
      success: true,
      invoiceId: metadata.invoiceId,
      fileId: file.getId(),
      fileUrl: file.getUrl()
    };

  } catch (error) {
    console.error('❌ PDF generation failed:', error);
    return { success: false, error: error.toString() };
  }
}

/**
 * Generates batch invoice HTML with multi-page support
 * Updated design: larger header, qty/unit price columns, better signatures
 */
function generateBatchInvoiceHTML(transactions, metadata) {
  const now = new Date();
  const dateStr = Utilities.formatDate(now, 'America/New_York', 'MMMM d, yyyy');

  // Get logo and seal as base64
  const logoBase64 = getLogoBase64();
  const sealBase64 = getSealBase64();

  // Calculate total and count line items
  let totalAmount = 0;
  let totalLineItems = 0;

  // Get division full name
  const divisionName = getDivisionFullName(metadata.division);

  // Get signatures
  const approverSig = metadata.isExternal ? null : getApproverSignatureForDivision(metadata.division);
  const boSig = getBusinessOfficeSignature(metadata.formType);

  // Pre-process: Group transactions by ID so items with same txnId are grouped together
  const groupedTransactions = [];
  let currentGroup = null;

  transactions.forEach((txn) => {
    if (!currentGroup || currentGroup.transactionId !== txn.transactionId) {
      // Look up requestor display name from email
      const requestorName = getDisplayNameFromEmail(txn.requestor) || txn.requestor;

      // Start new group
      currentGroup = {
        transactionId: txn.transactionId,
        requestor: requestorName,
        items: []
      };
      groupedTransactions.push(currentGroup);
    }
    // Add item to current group (use txn.items if present, otherwise create single item)
    const txnItems = txn.items || [{ description: txn.description, quantity: 1, unitPrice: txn.amount, totalPrice: txn.amount }];
    txnItems.forEach(item => currentGroup.items.push(item));
  });

  // Build line items HTML with proper grouping (matching preview structure exactly)
  let itemsHtml = '';

  groupedTransactions.forEach((group) => {
    const items = group.items;

    items.forEach((item, itemIndex) => {
      const qty = item.quantity || 1;
      const unitPrice = item.unitPrice || item.totalPrice || 0;
      const lineTotal = item.totalPrice || (qty * unitPrice);
      totalAmount += lineTotal;
      totalLineItems++;

      // Determine row class for visual grouping (single items get both first and last)
      let rowClass;
      if (items.length === 1) {
        rowClass = 'txn-group-first txn-group-last';
      } else if (itemIndex === 0) {
        rowClass = 'txn-group-first';
      } else if (itemIndex === items.length - 1) {
        rowClass = 'txn-group-last';
      } else {
        rowClass = 'txn-group-middle';
      }

      // ALL rows have txn-id and requestor data - CSS hides non-first rows
      itemsHtml += `
        <tr class="${rowClass}">
          <td class="txn-id">${group.transactionId || ''}</td>
          <td class="requestor">${group.requestor || ''}</td>
          <td class="description">${item.description || ''}</td>
          <td class="qty">${qty}</td>
          <td class="unit-price">$${unitPrice.toFixed(2)}</td>
          <td class="amount">$${lineTotal.toFixed(2)}</td>
        </tr>
      `;
    });
  });

  // If no items structure, use simple amount total
  if (totalAmount === 0) {
    totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
  }

  // Get embedded font data for PDF generation
  const bonheurFont = getBonheurRoyaleBase64();
  const playfairFont = getPlayfairDisplayBase64();

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
    @font-face {
      font-family: 'Playfair Display';
      font-style: normal;
      font-weight: 700;
      src: url(data:font/truetype;base64,${playfairFont}) format('truetype');
    }
    @page { size: letter; margin: 0.5in; }
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Segoe UI', -apple-system, Arial, sans-serif;
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

    .header {
      padding-bottom: 15px;
      border-bottom: 2px solid #1B5E20;
      margin-bottom: 20px;
    }
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .header-row.top {
      align-items: center;
      min-height: 70px;
    }
    .logo { height: 70px; }
    .header-right-top h1 {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 36pt;
      font-weight: 700;
      color: #1B5E20;
      letter-spacing: 2px;
      margin: 0;
      text-align: right;
      line-height: 70px;
    }
    .header-row.bottom {
      margin-top: 8px;
      align-items: flex-start;
    }
    .school-info { font-size: 9pt; color: #555; line-height: 1.5; }
    .invoice-meta { text-align: right; line-height: 1.5; }
    .invoice-id { font-family: 'Playfair Display', Georgia, serif; font-size: 12pt; color: #1B5E20; font-weight: 700; letter-spacing: 0.5px; }
    .invoice-date { font-size: 9pt; color: #555; margin-top: 2px; }

    .meta-section {
      display: flex;
      justify-content: space-between;
      margin-bottom: 20px;
      padding: 10px 15px;
      background: #f8f8f8;
      border-radius: 4px;
    }
    .meta-item { font-size: 9pt; }
    .meta-label { color: #666; }
    .meta-value { font-weight: 600; color: #1B5E20; }

    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    thead { display: table-header-group; }
    thead th {
      background: #f5f5f5;
      border-bottom: 2px solid #1B5E20;
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

    td.txn-id { width: 85px; font-family: Consolas, monospace; font-size: 8pt; color: #1B5E20; font-weight: 500; }
    td.requestor { width: 120px; }
    td.description { }
    td.qty { width: 40px; text-align: center; }
    td.unit-price { width: 70px; text-align: right; font-family: monospace; }
    td.amount { width: 75px; text-align: right; font-family: monospace; font-weight: 500; }

    /* Transaction group styling - matches preview exactly */
    .txn-group-first td { border-top: 1px solid #ddd; padding-top: 10px; }
    .txn-group-first:not(.txn-group-last) td { border-bottom: none; }
    .txn-group-middle td { border-bottom: none; padding-top: 4px; padding-bottom: 4px; }
    .txn-group-middle td.txn-id, .txn-group-middle td.requestor { color: transparent; }
    .txn-group-last td { padding-bottom: 10px; }
    .txn-group-last:not(.txn-group-first) td.txn-id, .txn-group-last:not(.txn-group-first) td.requestor { color: transparent; }

    .footer-section { page-break-inside: avoid; margin-top: 30px; }
    .totals { display: flex; justify-content: flex-end; margin-bottom: 50px; }
    .totals-box { width: 200px; border-top: 2px solid #1B5E20; padding-top: 10px; }
    .totals-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 10pt; }
    .totals-row.grand { font-size: 14pt; font-weight: 700; }
    .totals-row.grand .value { color: #1B5E20; }

    .signatures { display: flex; justify-content: space-between; padding-top: 30px; border-top: 1px solid #ddd; }
    .signature-block { text-align: center; width: 220px; }
    .signature-label { font-size: 8pt; color: #666; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
    .signature-line { height: 50px; border-bottom: 1px solid #333; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 2px; }
    .signature-line .signature { font-family: 'Bonheur Royale', 'Brush Script MT', cursive; font-size: 28pt; color: #000; }
    .signature-line img { max-height: 45px; max-width: 180px; }
    .sig-name { font-weight: 600; font-size: 9pt; margin-top: 5px; }
    .sig-title { font-size: 8pt; color: #666; }
    .sig-date { font-size: 8pt; color: #888; margin-top: 3px; }

    .doc-footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #eee; text-align: center; font-size: 7pt; color: #999; }
  </style>
</head>
<body>
  ${sealBase64 ? `<div class="watermark"><img src="data:image/jpeg;base64,${sealBase64}" /></div>` : ''}

  <div class="header">
    <div class="header-row top">
      ${logoBase64 ? `<img class="logo" src="data:image/png;base64,${logoBase64}" alt="KCS" />` : ''}
      <div class="header-right-top"><h1>INVOICE</h1></div>
    </div>
    <div class="header-row bottom">
      <div class="school-info">
        10100 54th Avenue North<br>
        St. Petersburg, FL 33708<br>
        (727) 522-2111
      </div>
      <div class="invoice-meta">
        <div class="invoice-id">${metadata.invoiceId}</div>
        <div class="invoice-date">${dateStr}</div>
      </div>
    </div>
  </div>

  <div class="meta-section">
    <div class="meta-item">
      <span class="meta-label">Division:</span>
      <span class="meta-value">${metadata.isExternal ? 'All Divisions' : divisionName}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Type:</span>
      <span class="meta-value">${metadata.formType} ${metadata.isExternal ? '(External)' : 'Orders'}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Period:</span>
      <span class="meta-value">${getCurrentFiscalQuarter()} ${getCurrentFiscalYear()}</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">Items:</span>
      <span class="meta-value">${totalLineItems || transactions.length}</span>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Transaction</th>
        <th>Requestor</th>
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

  <div class="footer-section">
    <div class="totals">
      <div class="totals-box">
        <div class="totals-row grand">
          <span>TOTAL</span>
          <span class="value">$${totalAmount.toFixed(2)}</span>
        </div>
      </div>
    </div>

    <div class="signatures">
      ${metadata.isExternal ? `
        <div class="signature-block">
          <div class="signature-label">Ordered By</div>
          <div class="signature-line">
            ${boSig.base64 ? `<img src="data:image/png;base64,${boSig.base64}" />` : `<span class="signature">${boSig.name}</span>`}
          </div>
          <div class="sig-name">${boSig.name}</div>
          <div class="sig-title">${boSig.title}</div>
          <div class="sig-date">${dateStr}</div>
        </div>
      ` : `
        <div class="signature-block">
          <div class="signature-label">Approved By</div>
          <div class="signature-line">
            ${approverSig && approverSig.base64 ? `<img src="data:image/png;base64,${approverSig.base64}" />` : `<span class="signature">${approverSig ? approverSig.name : 'Approver'}</span>`}
          </div>
          <div class="sig-name">${approverSig ? approverSig.name : 'Division Approver'}</div>
          <div class="sig-title">${approverSig ? approverSig.title : ''}</div>
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
      `}
    </div>
  </div>

  <div class="doc-footer">
    Keswick Christian School | Budget Management System
  </div>
</body>
</html>`;
}

// ============================================================================
// PDF GENERATION - SINGLE TEMPLATE
// ============================================================================

/**
 * Generates a single invoice PDF (Field Trip/Curriculum/Admin)
 */
function generateSingleInvoicePDF(transaction, metadata) {
  try {
    const html = generateSingleInvoiceHTML(transaction, metadata);

    const blob = Utilities.newBlob(html, 'text/html', `${metadata.invoiceId}.html`);
    const pdf = blob.getAs('application/pdf');
    pdf.setName(`${metadata.invoiceId}.pdf`);

    // Determine folder path
    const division = getDivisionFromOrganization(transaction.organization);
    const department = metadata.formType === 'CURRICULUM' ? transaction.organization : null;

    const folder = getInvoiceStorageFolder(
      metadata.formType,
      division,
      department,
      null,
      null
    );

    const file = folder.createFile(pdf);
    file.setSharing(DriveApp.Access.DOMAIN, DriveApp.Permission.VIEW);

    console.log(`✅ Invoice ${metadata.invoiceId} created: ${file.getUrl()}`);

    return {
      success: true,
      invoiceId: metadata.invoiceId,
      fileId: file.getId(),
      fileUrl: file.getUrl()
    };

  } catch (error) {
    console.error('❌ Single invoice PDF failed:', error);
    return { success: false, error: error.toString() };
  }
}

/**
 * Generates single invoice HTML
 */
function generateSingleInvoiceHTML(transaction, metadata) {
  const now = new Date();
  const dateStr = Utilities.formatDate(now, 'America/New_York', 'MMMM d, yyyy');

  const logoBase64 = getLogoBase64();
  const sealBase64 = getSealBase64();

  // Get requestor info
  const requestorInfo = getUserBudgetInfo(transaction.requestor) || {};
  const requestorName = `${requestorInfo.firstName || ''} ${requestorInfo.lastName || ''}`.trim() || transaction.requestor;

  // Get division
  const division = getDivisionFromOrganization(transaction.organization);
  const divisionName = getDivisionFullName(division);

  // Get signatures based on form type
  let approverSig, boSig;

  if (metadata.formType === 'ADMIN') {
    // Admin: Self + CFO
    approverSig = getApproverSignatureInfo(transaction.requestor);
    boSig = getBusinessOfficeSignature('ADMIN');
  } else if (metadata.formType === 'FIELD_TRIP') {
    // Field Trip: Division Principal + CFO
    approverSig = getApproverSignatureForDivision(division);
    boSig = getBusinessOfficeSignature('FIELD_TRIP');
  } else {
    // Curriculum: Division Principal + BO
    approverSig = getApproverSignatureForDivision(division);
    boSig = getBusinessOfficeSignature('CURRICULUM');
  }

  // Get embedded font data for PDF generation
  const bonheurFont = getBonheurRoyaleBase64();
  const playfairFont = getPlayfairDisplayBase64();

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
    @font-face {
      font-family: 'Playfair Display';
      font-style: normal;
      font-weight: 700;
      src: url(data:font/truetype;base64,${playfairFont}) format('truetype');
    }
    @page { size: letter; margin: 0.5in; }
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Segoe UI', -apple-system, Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.5;
      color: #333;
      padding: 20px;
    }

    .watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      opacity: 0.04;
      z-index: 0;
    }
    .watermark img { width: 400px; }

    .header {
      padding-bottom: 15px;
      border-bottom: 2px solid #1B5E20;
      margin-bottom: 20px;
    }
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .header-row.top {
      align-items: center;
      min-height: 70px;
    }
    .logo { height: 70px; }
    .header-right-top h1 {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 36pt;
      font-weight: 700;
      color: #1B5E20;
      letter-spacing: 2px;
      margin: 0;
      text-align: right;
      line-height: 70px;
    }
    .header-row.bottom {
      margin-top: 8px;
      align-items: flex-start;
    }
    .school-info { font-size: 9pt; color: #555; line-height: 1.5; }
    .invoice-meta { text-align: right; line-height: 1.5; }
    .invoice-id { font-family: 'Playfair Display', Georgia, serif; font-size: 12pt; color: #1B5E20; font-weight: 700; letter-spacing: 0.5px; }
    .invoice-date { font-size: 9pt; color: #555; margin-top: 2px; }

    .info-section {
      display: flex;
      justify-content: space-between;
      margin-bottom: 25px;
      gap: 30px;
    }

    .info-block { flex: 1; }

    .info-block h3 {
      font-size: 9pt;
      font-weight: 600;
      color: #1B5E20;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 10px;
      padding-bottom: 5px;
      border-bottom: 1px solid #ddd;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      font-size: 9pt;
    }

    .info-label { color: #666; }
    .info-value { font-weight: 500; }
    .info-value.highlight { color: #1B5E20; font-family: monospace; }

    .items-section { margin-bottom: 25px; }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    thead th {
      background: #f5f5f5;
      border-bottom: 2px solid #1B5E20;
      padding: 10px;
      text-align: left;
      font-size: 8pt;
      font-weight: 600;
      text-transform: uppercase;
    }

    thead th.amount { text-align: right; }

    tbody td {
      padding: 12px 10px;
      border-bottom: 1px solid #eee;
      vertical-align: top;
    }

    td.amount { text-align: right; font-family: monospace; }

    .item-desc { font-weight: 500; }
    .item-details { font-size: 8pt; color: #888; margin-top: 3px; }

    .totals-section {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 40px;
    }

    .totals-box { width: 200px; }

    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-top: 2px solid #1B5E20;
      font-size: 14pt;
      font-weight: 700;
    }

    .totals-row .value { color: #1B5E20; }

    .signatures {
      display: flex;
      justify-content: space-between;
      padding-top: 30px;
      border-top: 1px solid #ddd;
      page-break-inside: avoid;
    }

    .signature-block {
      text-align: center;
      width: 200px;
    }

    .signature-line {
      height: 45px;
      border-bottom: 1px solid #333;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      margin-bottom: 5px;
    }

    .signature-line img { max-height: 45px; max-width: 180px; }
    .signature-line .signature { font-family: 'Bonheur Royale', 'Brush Script MT', cursive; font-size: 28pt; color: #000; }

    .signature-label { font-size: 8pt; color: #666; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
    .sig-name { font-weight: 600; font-size: 9pt; margin-top: 5px; }
    .sig-title { font-size: 8pt; color: #666; }
    .sig-date { font-size: 8pt; color: #888; margin-top: 3px; }

    .doc-footer {
      margin-top: 30px;
      padding-top: 10px;
      border-top: 1px solid #eee;
      text-align: center;
      font-size: 7pt;
      color: #999;
    }
  </style>
</head>
<body>
  ${sealBase64 ? `<div class="watermark"><img src="data:image/jpeg;base64,${sealBase64}" /></div>` : ''}

  <div class="header">
    <div class="header-row top">
      ${logoBase64 ? `<img class="logo" src="data:image/png;base64,${logoBase64}" alt="KCS" />` : ''}
      <div class="header-right-top"><h1>INVOICE</h1></div>
    </div>
    <div class="header-row bottom">
      <div class="school-info">
        10100 54th Avenue North<br>
        St. Petersburg, FL 33708<br>
        (727) 522-2111
      </div>
      <div class="invoice-meta">
        <div class="invoice-id">${metadata.invoiceId}</div>
        <div class="invoice-date">${dateStr}</div>
      </div>
    </div>
  </div>

  <div class="info-section">
    <div class="info-block">
      <h3>Transaction Details</h3>
      <div class="info-row">
        <span class="info-label">Transaction ID</span>
        <span class="info-value highlight">${transaction.transactionId}</span>
      </div>
      ${transaction.orderId ? `
      <div class="info-row">
        <span class="info-label">Order ID</span>
        <span class="info-value highlight">${transaction.orderId}</span>
      </div>` : ''}
      <div class="info-row">
        <span class="info-label">Form Type</span>
        <span class="info-value">${metadata.formType.replace('_', ' ')}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Fiscal Period</span>
        <span class="info-value">${transaction.fiscalQuarter || getCurrentFiscalQuarter()}</span>
      </div>
    </div>

    <div class="info-block">
      <h3>Requestor Information</h3>
      <div class="info-row">
        <span class="info-label">Requested By</span>
        <span class="info-value">${requestorName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Department</span>
        <span class="info-value">${requestorInfo.department || transaction.organization || 'N/A'}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Division</span>
        <span class="info-value">${divisionName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Date Submitted</span>
        <span class="info-value">${transaction.date ? Utilities.formatDate(new Date(transaction.date), 'America/New_York', 'MMM d, yyyy') : dateStr}</span>
      </div>
    </div>
  </div>

  <div class="items-section">
    <table>
      <thead>
        <tr>
          <th style="width:40px;">#</th>
          <th>Description</th>
          <th style="width:60px;">Qty</th>
          <th style="width:90px;" class="amount">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>1</td>
          <td>
            <div class="item-desc">${transaction.description || 'Purchase'}</div>
          </td>
          <td>1</td>
          <td class="amount">$${transaction.amount.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="totals-section">
    <div class="totals-box">
      <div class="totals-row">
        <span>TOTAL</span>
        <span class="value">$${transaction.amount.toFixed(2)}</span>
      </div>
    </div>
  </div>

  <div class="signatures">
    <div class="signature-block">
      <div class="signature-label">Approved By</div>
      <div class="signature-line">
        ${approverSig && approverSig.base64 ? `<img src="data:image/png;base64,${approverSig.base64}" />` : `<span class="signature">${approverSig ? approverSig.name : 'Approver'}</span>`}
      </div>
      <div class="sig-name">${approverSig ? approverSig.name : 'Approver'}</div>
      <div class="sig-title">${approverSig ? approverSig.title : ''}</div>
      <div class="sig-date">${dateStr}</div>
    </div>

    <div class="signature-block">
      <div class="signature-label">Ordered By</div>
      <div class="signature-line">
        ${boSig && boSig.base64 ? `<img src="data:image/png;base64,${boSig.base64}" />` : `<span class="signature">${boSig ? boSig.name : 'Business Office'}</span>`}
      </div>
      <div class="sig-name">${boSig ? boSig.name : 'Business Office'}</div>
      <div class="sig-title">${boSig ? boSig.title : ''}</div>
      <div class="sig-date">${dateStr}</div>
    </div>
  </div>

  <div class="doc-footer">
    Keswick Christian School | Budget Management System | Generated ${new Date().toISOString()}
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
  if (!org) return 'AD';
  const orgLower = org.toString().toLowerCase();

  if (orgLower.includes('upper') || orgLower === 'us') return 'US';
  if (orgLower.includes('lower') || orgLower === 'ls') return 'LS';
  if (orgLower.includes('keswick kids') || orgLower === 'kk' || orgLower.includes('prek')) return 'KK';
  if (orgLower.includes('admin')) return 'AD';

  // Check if it's a department name - map to division
  const deptDivisionMap = {
    'math': 'US', 'science': 'US', 'english': 'US', 'history': 'US',
    'elementary': 'LS', 'kindergarten': 'KK', 'prek': 'KK'
  };

  for (const [dept, div] of Object.entries(deptDivisionMap)) {
    if (orgLower.includes(dept)) return div;
  }

  return 'AD';
}

/**
 * Gets full division name
 */
function getDivisionFullName(divCode) {
  const names = {
    'US': 'Upper School',
    'LS': 'Lower School',
    'KK': 'Keswick Kids',
    'AD': 'Administration'
  };
  return names[divCode] || divCode || 'General';
}

/**
 * Gets display name from email address
 * Looks up in UserDirectory, falls back to formatted email prefix
 */
function getDisplayNameFromEmail(email) {
  if (!email) return '';

  try {
    // Try to look up in UserDirectory
    const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
    const userSheet = budgetHub.getSheetByName('UserDirectory');

    if (userSheet) {
      const data = userSheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] && data[i][0].toString().toLowerCase() === email.toLowerCase()) {
          const firstName = data[i][1] || '';
          const lastName = data[i][2] || '';
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
  const prefix = email.split('@')[0];
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
  if (!org) return 'GEN';

  const codes = {
    'math': 'MATH', 'science': 'SCI', 'english': 'ENG',
    'history': 'HIST', 'foreign language': 'LANG', 'spanish': 'LANG',
    'bible': 'BIBL', 'art': 'ART', 'music': 'MUS',
    'pe': 'PE', 'physical education': 'PE', 'technology': 'TECH',
    'library': 'LIB', 'media': 'LIB'
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
    'US': 'lmortimer@keswickchristian.org',
    'LS': 'ddumais@keswickchristian.org',
    'KK': 'scarmichael@keswickchristian.org',
    'AD': CONFIG.BUSINESS_OFFICE_EMAIL
  };

  const email = approvers[division] || approvers['AD'];
  return getApproverSignatureInfo(email);
}

/**
 * Gets business office signature based on form type
 */
function getBusinessOfficeSignature(formType) {
  const type = formType.toString().toUpperCase();

  // CFO signs Field Trip and Admin
  if (type === 'FIELD_TRIP' || type === 'ADMIN') {
    return {
      name: 'Beth Endrulat',
      title: 'Chief Financial Officer',
      base64: getSignatureBase64ForUser('bendrulat@keswickchristian.org')
    };
  }

  // BO signs Amazon, Warehouse, Curriculum
  return {
    name: 'Sherilyn Neel',
    title: 'Business Office',
    base64: getSignatureBase64ForUser('sneel@keswickchristian.org')
  };
}

/**
 * Gets signature base64 for a user
 */
function getSignatureBase64ForUser(email) {
  // Try to get from SIGNATURE_CONFIG if defined
  if (typeof SIGNATURE_CONFIG !== 'undefined' && SIGNATURE_CONFIG[email]) {
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
    const logoId = '1HDkW_xGIc4jOBH4REnXb3VJcZaEjPHKj'; // KCS text logo
    const file = DriveApp.getFileById(logoId);
    return Utilities.base64Encode(file.getBlob().getBytes());
  } catch (e) {
    console.warn('Could not load logo:', e);
    return null;
  }
}

/**
 * Gets seal as base64
 */
function getSealBase64() {
  try {
    // Look for seal in signatures folder or use uploaded seal
    const folders = DriveApp.getFoldersByName('Budget_System_Signatures');
    if (folders.hasNext()) {
      const folder = folders.next();
      const files = folder.getFilesByName('seal.jpg');
      if (files.hasNext()) {
        return Utilities.base64Encode(files.next().getBlob().getBytes());
      }
    }
    return null;
  } catch (e) {
    console.warn('Could not load seal:', e);
    return null;
  }
}

/**
 * Gets current fiscal quarter string
 */
function getCurrentFiscalQuarter() {
  const month = new Date().getMonth();
  if (month >= 6 && month <= 8) return 'Q1';
  if (month >= 9 && month <= 11) return 'Q2';
  if (month >= 0 && month <= 2) return 'Q3';
  return 'Q4';
}

// ============================================================================
// BATCH TRIGGERS SETUP
// ============================================================================

/**
 * Creates triggers for Amazon (Tue/Fri) and Warehouse (Wed) batches
 */
function setupBatchInvoiceTriggers() {
  // Remove existing batch triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    const fn = trigger.getHandlerFunction();
    if (fn === 'runAmazonBatch' || fn === 'runWarehouseBatch') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // Amazon batch - Tuesday 6 AM
  ScriptApp.newTrigger('runAmazonBatch')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.TUESDAY)
    .atHour(6)
    .create();

  // Amazon batch - Friday 6 AM
  ScriptApp.newTrigger('runAmazonBatch')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.FRIDAY)
    .atHour(6)
    .create();

  // Warehouse batch - Wednesday 6 AM
  ScriptApp.newTrigger('runWarehouseBatch')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.WEDNESDAY)
    .atHour(6)
    .create();

  console.log('✅ Batch invoice triggers created: Amazon (Tue/Fri 6AM), Warehouse (Wed 6AM)');
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
    { transactionId: 'AMZ-0142', requestor: 'Sarah Johnson', organization: 'Upper School', amount: 74.97, description: 'Science Lab Safety Goggles (12-pack)' },
    { transactionId: 'AMZ-0142', requestor: 'Sarah Johnson', organization: 'Upper School', amount: 62.50, description: 'Digital Thermometer Set' },
    { transactionId: 'AMZ-0142', requestor: 'Sarah Johnson', organization: 'Upper School', amount: 37.50, description: 'Beaker Set 250ml (6-pack)' },

    // Group 2: Mike Chen - 2 items
    { transactionId: 'AMZ-0145', requestor: 'Mike Chen', organization: 'Upper School', amount: 589.95, description: 'TI-84 Plus CE Graphing Calculator' },
    { transactionId: 'AMZ-0145', requestor: 'Mike Chen', organization: 'Upper School', amount: 35.00, description: 'Classroom Whiteboard Markers, Bulk' },

    // Single item transactions
    { transactionId: 'AMZ-0151', requestor: 'Lisa Park', organization: 'Upper School', amount: 45.99, description: 'HP Printer Paper, 8.5x11, 10 reams' },

    // Group 3: David Wilson - 3 items
    { transactionId: 'AMZ-0153', requestor: 'David Wilson', organization: 'Upper School', amount: 113.94, description: 'Acrylic Paint Set, 24 colors' },
    { transactionId: 'AMZ-0153', requestor: 'David Wilson', organization: 'Upper School', amount: 53.94, description: 'Artist Brush Set, 15-piece' },
    { transactionId: 'AMZ-0153', requestor: 'David Wilson', organization: 'Upper School', amount: 39.24, description: 'Canvas Panel, 11x14, 6-pack' },

    // More items for multi-page testing
    { transactionId: 'AMZ-0155', requestor: 'Emily Davis', organization: 'Upper School', amount: 225.00, description: 'To Kill a Mockingbird, Paperback' },
    { transactionId: 'AMZ-0156', requestor: 'John Smith', organization: 'Upper School', amount: 89.99, description: 'Document Camera for Classroom' },
    { transactionId: 'AMZ-0157', requestor: 'Amy Brown', organization: 'Upper School', amount: 149.99, description: 'Laminating Machine' },
    { transactionId: 'AMZ-0158', requestor: 'Chris Jones', organization: 'Upper School', amount: 29.99, description: 'Stapler Heavy Duty' },
    { transactionId: 'AMZ-0159', requestor: 'Mary Williams', organization: 'Upper School', amount: 75.00, description: 'Classroom Timer Set' },
    { transactionId: 'AMZ-0160', requestor: 'Kevin Thomas', organization: 'Upper School', amount: 199.99, description: 'Wireless Presentation Clicker' },
    { transactionId: 'AMZ-0161', requestor: 'Linda Miller', organization: 'Upper School', amount: 45.50, description: 'Dry Erase Markers, Assorted Colors' },
    { transactionId: 'AMZ-0162', requestor: 'Robert Garcia', organization: 'Upper School', amount: 189.00, description: 'Scientific Calculator' },
    { transactionId: 'AMZ-0163', requestor: 'Nancy Martinez', organization: 'Upper School', amount: 65.00, description: 'Protractors and Rulers Set' },
    { transactionId: 'AMZ-0164', requestor: 'Steve Anderson', organization: 'Upper School', amount: 125.00, description: 'Colored Pencils, Classroom Pack' },
    { transactionId: 'AMZ-0165', requestor: 'Tina Taylor', organization: 'Upper School', amount: 85.00, description: 'Classroom Headphones' },
    { transactionId: 'AMZ-0166', requestor: 'William Moore', organization: 'Upper School', amount: 299.99, description: 'Portable Projector' },
    { transactionId: 'AMZ-0167', requestor: 'Helen Jackson', organization: 'Upper School', amount: 55.00, description: 'Globe, 12-inch Diameter' },
    { transactionId: 'AMZ-0168', requestor: 'Paul White', organization: 'Upper School', amount: 175.00, description: 'Wall Maps, US and World Set' },
    { transactionId: 'AMZ-0169', requestor: 'Diana Harris', organization: 'Upper School', amount: 95.00, description: 'Reading Light Set' }
  ];

  const result = generateBatchInvoicePDF(sampleTransactions, {
    invoiceId: 'AMZ-US-0212-TEST',
    formType: 'AMAZON',
    division: 'US',
    isExternal: false
  });

  console.log('Test result:', result);
  return result;
}

/**
 * Test single invoice generation
 */
function testSingleInvoice() {
  const sampleTransaction = {
    transactionId: 'FLD-0001',
    orderId: null,
    date: new Date(),
    requestor: 'teacher1@keswickchristian.org',
    approver: 'lmortimer@keswickchristian.org',
    organization: 'Upper School',
    form: 'FIELD_TRIP',
    amount: 450.00,
    description: 'Museum of Science field trip - 45 students',
    fiscalQuarter: 'Q3'
  };

  const result = generateSingleInvoicePDF(sampleTransaction, {
    invoiceId: 'FLD-US-0211-TEST',
    formType: 'FIELD_TRIP'
  });

  console.log('Test result:', result);
  return result;
}
