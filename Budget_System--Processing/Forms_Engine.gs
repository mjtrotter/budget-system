/**
 * ============================================================================
 * FORMS ENGINE
 * ============================================================================
 * Handles all Google Form submissions and routing logic.
 */

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
      'TransactionID', 'Email', 'Type', 'Department', 'Division',
      'Amount', 'Description', 'Status', 'SubmittedOn', 'ApprovedOn',
      'Approver', 'ResponseID'
    ];

    queueSheet = hub.insertSheet(sheetName);
    queueSheet.getRange(1, 1, 1, queueHeaders.length).setValues([queueHeaders]);
    queueSheet.setFrozenRows(1);

    // Format header
    const headerRange = queueSheet.getRange(1, 1, 1, queueHeaders.length);
    headerRange.setBackground(sheetName === 'AutomatedQueue' ? '#1565C0' : '#2E7D32');
    headerRange.setFontColor('#FFFFFF');
    headerRange.setFontWeight('bold');

    console.log(`✅ ${sheetName} created`);
  }

  return queueSheet;
}

// ============================================================================
// AMAZON FORM PROCESSING
// ============================================================================

function processAmazonFormSubmission(e) {
  console.log('🚀 === AMAZON FORM PROCESSING START ===');
  let step = 0;

  const lock = LockService.getScriptLock();
  try { lock.waitLock(30000); } catch(lockErr) {
    console.error('❌ Lock timeout:', lockErr);
    throw new Error('System busy (Lock timeout)');
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
    const amazonSheet = autoHub.getSheetByName('Amazon');
    if (!amazonSheet) {
      throw new Error('Amazon sheet not found in Automated Hub');
    }
    console.log(`   Amazon sheet found`);

    step = 5;
    console.log(`📍 Step ${step}: Reading Amazon data`);
    const data = amazonSheet.getDataRange().getValues();
    const lastRowIndex = data.length - 1;
    const row = data[lastRowIndex];
    console.log(`   Total rows: ${data.length}, Reading row: ${lastRowIndex + 1}`);

    step = 6;
    console.log(`📍 Step ${step}: Extracting email and total`);
    const email = row[1];
    const rawTotal = row[27];
    const totalAmount = parseFloat(String(rawTotal).replace(/[$,]/g, '')) || 0;
    console.log(`   Email: "${email}", Raw Total: "${rawTotal}", Parsed: $${totalAmount}`);

    step = 7;
    console.log(`📍 Step ${step}: Validating email`);
    if (!email || !email.includes('@')) {
      throw new Error(`Invalid email address: "${email}"`);
    }
    console.log(`   Email valid`);

    step = 8;
    console.log(`📍 Step ${step}: Validating total amount`);
    if (totalAmount === 0) {
      throw new Error(`Total amount parsed as 0 from raw value: ${rawTotal}`);
    }
    console.log(`   Total valid: $${totalAmount}`);

    step = 9;
    console.log(`📍 Step ${step}: Extracting Amazon items`);
    const amazonItems = [];
    const itemMappings = [
      { descCol: 2, urlCol: 3, qtyCol: 4, priceCol: 5 },
      { descCol: 7, urlCol: 8, qtyCol: 9, priceCol: 10 },
      { descCol: 12, urlCol: 13, qtyCol: 14, priceCol: 15 },
      { descCol: 17, urlCol: 18, qtyCol: 19, priceCol: 20 },
      { descCol: 22, urlCol: 23, qtyCol: 24, priceCol: 25 }
    ];

    itemMappings.forEach((mapping, index) => {
      const description = row[mapping.descCol];
      const url = row[mapping.urlCol];
      const quantity = parseInt(row[mapping.qtyCol]) || 0;
      const unitPrice = parseFloat(String(row[mapping.priceCol]).replace(/[$,]/g, '')) || 0;

      if (description && url && quantity > 0 && unitPrice > 0) {
        amazonItems.push({
          description: description,
          url: url,
          quantity: quantity,
          unitPrice: unitPrice,
          totalPrice: quantity * unitPrice
        });
        console.log(`   Item ${index + 1}: "${description}" x${quantity} @ $${unitPrice}`);
      }
    });
    console.log(`   Total items found: ${amazonItems.length}`);

    step = 10;
    console.log(`📍 Step ${step}: Validating items`);
    if (amazonItems.length === 0) {
      throw new Error('No valid Amazon items found');
    }

    step = 11;
    console.log(`📍 Step ${step}: Looking up user budget for "${email}"`);
    const userBudget = getUserBudgetInfo(email);
    console.log(`   User budget result: ${userBudget ? 'FOUND' : 'NULL'}`);
    if (userBudget) {
      console.log(`   Department: ${userBudget.department}, Allocated: $${userBudget.allocated}, Available: $${userBudget.available}`);
    }

    if (!userBudget) {
      console.error(`❌ User not found: ${email}`);
      sendErrorNotification(email, 'UNKNOWN', 'AMAZON', 'User not found in directory');
      throw new Error(`User ${email} not found in directory`);
    }

    step = 12;
    console.log(`📍 Step ${step}: Generating transaction ID`);
    const transactionId = generateSequentialTransactionId('AMAZON');
    console.log(`   Transaction ID: ${transactionId}`);

    step = 13;
    console.log(`📍 Step ${step}: Writing transaction ID to Amazon sheet`);
    try {
      amazonSheet.getRange(lastRowIndex + 1, 29).setValue(transactionId);
      console.log(`   Transaction ID written to row ${lastRowIndex + 1}`);
    } catch (formError) {
      console.error('⚠️ Error adding transaction ID to Amazon sheet:', formError);
    }

    step = 14;
    console.log(`📍 Step ${step}: Getting AutomatedQueue sheet`);
    const queueSheet = getOrCreateQueueSheet(autoHub, 'AutomatedQueue');
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
      'AMAZON',
      userBudget.department,
      getDivisionFromDepartment(userBudget.department),
      totalAmount,
      description,
      'PENDING',
      timestamp,
      '',
      '',
      responseId
    ];
    console.log(`   Queue data: ${JSON.stringify(queueData.slice(0, 4))}...`);
    queueSheet.appendRow(queueData);
    console.log(`   ✅ Queue entry appended!`);

    step = 17;
    console.log(`📍 Step ${step}: Updating encumbrance`);
    updateUserEncumbranceRealTime(email, totalAmount, 'add');

    step = 18;
    console.log(`📍 Step ${step}: Calculating approval logic`);
    const budgetAvailable = userBudget.allocated - userBudget.spent - userBudget.encumbered;
    const withinBudget = totalAmount <= budgetAvailable;
    const belowAutoApproval = totalAmount < CONFIG.AUTO_APPROVAL_LIMIT;
    console.log(`   Available: $${budgetAvailable}, Within: ${withinBudget}, Below limit: ${belowAutoApproval}`);

    step = 19;
    console.log(`📍 Step ${step}: Checking velocity`);
    const velocityCheck = checkDailySpendingVelocity(email, totalAmount);
    console.log(`   Velocity: allowed=${velocityCheck.allowed}, daily=$${velocityCheck.dailyTotal}`);

    step = 20;
    if (belowAutoApproval && withinBudget && velocityCheck.allowed) {
      console.log(`📍 Step ${step}: AUTO-APPROVING`);
      const actualApprover = getApproverForRequest({ amount: totalAmount }, userBudget);
      updateQueueStatus(transactionId, 'APPROVED', actualApprover, true);
      sendApprovalNotification(email, {
        transactionId: transactionId,
        amount: totalAmount,
        type: 'Amazon Order',
        description: description,
        approver: actualApprover
      });
      logSystemEvent('AMAZON_AUTO_APPROVED', email, totalAmount, { transactionId, actualApprover });
      console.log(`   ✅ Auto-approved by ${actualApprover}`);
    } else {
      console.log(`📍 Step ${step}: REQUESTING APPROVAL`);
      const approver = getApproverForRequest({ amount: totalAmount }, userBudget);
      console.log(`   Approver: ${approver}`);

      if (belowAutoApproval && !velocityCheck.allowed) {
        logSystemEvent('AUTO_APPROVAL_DENIED_VELOCITY', email, totalAmount, {
          transactionId,
          dailyTotal: velocityCheck.dailyTotal,
          limit: velocityCheck.limit
        });
      }

      sendEnhancedApprovalEmail(approver, {
        transactionId,
        type: 'Amazon Order',
        amount: totalAmount,
        requestor: email,
        description,
        items: amazonItems,
        budgetContext: {
          available: budgetAvailable,
          withinBudget,
          utilization: (userBudget.spent / userBudget.allocated * 100).toFixed(1)
        }
      });
      logSystemEvent('AMAZON_APPROVAL_REQUESTED', email, totalAmount, { transactionId, approver });
      console.log(`   ✅ Approval email sent to ${approver}`);
    }

    console.log('🎉 === AMAZON FORM PROCESSING COMPLETE ===');

  } catch (error) {
    console.error(`❌ AMAZON ERROR at Step ${step}:`, error.message);
    console.error('   Stack:', error.stack);
    try {
      handleCriticalError(e.response?.getId() || 'UNKNOWN', 'AMAZON', error, { step: step });
    } catch (logError) {
      console.error('❌ handleCriticalError also failed:', logError.message);
    }
  } finally {
    lock.releaseLock();
    console.log('🔓 Lock released');
  }
}

// ============================================================================
// WAREHOUSE FORM PROCESSING
// ============================================================================

function processWarehouseFormSubmission(e) {
  const lock = LockService.getScriptLock();
  try { lock.waitLock(30000); } catch(e) { throw new Error('System busy (Lock timeout)'); }

  console.log('🏪 === WAREHOUSE FORM PROCESSING START ===');
  
  try {
    const response = e.response;
    const responseId = response.getId();
    const timestamp = new Date();
    
    Utilities.sleep(5000); // Wait for sheet update
    
    // Get the form responses sheet from destination
    const form = FormApp.openById(CONFIG.FORMS.WAREHOUSE);
    const formResponsesSpreadsheet = SpreadsheetApp.openById(form.getDestinationId());
    const formResponsesSheet = formResponsesSpreadsheet.getSheets()[0];
    const data = formResponsesSheet.getDataRange().getValues();
    
    // Find the actual submission row
    let submissionRow = null;
    let submissionRowIndex = -1;
    
    for (let i = data.length - 1; i >= 1; i--) {
      const row = data[i];
      if (row[0] && row[1] && row[1].toString().includes('@')) {
        const rowTimestamp = new Date(row[0]);
        if (Math.abs(rowTimestamp - timestamp) < 120000) { // 2 minutes
          submissionRow = row;
          submissionRowIndex = i;
          break;
        }
      }
    }
    
    if (!submissionRow) {
      throw new Error('Could not find warehouse form submission data');
    }
    
    // Process the found submission row
    const email = submissionRow[1].toString().trim();

    // FIX: Calculate total from individual item prices instead of relying on column 27
    // Column 27 may be empty if form doesn't have an "Estimated Total" field
    const priceColumns = [18, 20, 22, 24, 26]; // Item 1-5 price columns
    let totalCost = 0;
    priceColumns.forEach(col => {
      totalCost += parseFloat(String(submissionRow[col] || '0').replace(/[$,]/g, '')) || 0;
    });

    // Fallback to column 27 if calculated total is 0 but column 27 has a value
    if (totalCost === 0) {
      totalCost = parseFloat(String(submissionRow[27]).replace(/[$,]/g, '')) || 0;
    }

    console.log(`📊 Warehouse total: $${totalCost} (calculated from item prices)`);
    
    if (!email || !email.includes('@')) {
      throw new Error(`Invalid email: ${email}`);
    }
    
    // Extract warehouse items
    const warehouseItems = [];
    const itemMappings = [
      { idCol: 2, qtyCol: 3, descCol: 17, priceCol: 18 },   // Item 1
      { idCol: 5, qtyCol: 6, descCol: 19, priceCol: 20 },   // Item 2
      { idCol: 8, qtyCol: 9, descCol: 21, priceCol: 22 },   // Item 3
      { idCol: 11, qtyCol: 12, descCol: 23, priceCol: 24 }, // Item 4
      { idCol: 14, qtyCol: 15, descCol: 25, priceCol: 26 }  // Item 5
    ];
    
    itemMappings.forEach((mapping, index) => {
      const itemId = submissionRow[mapping.idCol];
      const quantity = parseInt(submissionRow[mapping.qtyCol]) || 0;
      const description = submissionRow[mapping.descCol];
      const price = parseFloat(String(submissionRow[mapping.priceCol]).replace(/[$,]/g, '')) || 0;
      
      if (itemId && quantity > 0 && description && price > 0) {
        warehouseItems.push({
          itemId: itemId,
          description: description,
          quantity: quantity,
          unitPrice: price / quantity,
          totalPrice: price
        });
      }
    });
    
    if (warehouseItems.length === 0) {
      warehouseItems.push({
        itemId: 'UNKNOWN',
        description: 'Warehouse items (see form submission)',
        quantity: 1,
        unitPrice: totalCost,
        totalPrice: totalCost
      });
    }
    
    const userBudget = getUserBudgetInfo(email);
    if (!userBudget) {
      throw new Error(`User ${email} not found in directory`);
    }
    
    const transactionId = generateSequentialTransactionId('WAREHOUSE');
    
    try {
      formResponsesSheet.getRange(submissionRowIndex + 1, 29).setValue(transactionId);
    } catch (formError) {
      console.error('⚠️ Error adding transaction ID:', formError);
    }
    
    const autoHub = SpreadsheetApp.openById(CONFIG.AUTOMATED_HUB_ID);
    const queueSheet = getOrCreateQueueSheet(autoHub, 'AutomatedQueue');
    const description = warehouseItems.map(item =>
      item.quantity > 1 ? `${item.quantity}x ${item.description}` : item.description
    ).join(', ');
    
    queueSheet.appendRow([
      transactionId,
      email,
      'WAREHOUSE',
      userBudget.department,
      getDivisionFromDepartment(userBudget.department),
      totalCost,
      description,
      'PENDING',
      timestamp,
      '',
      '',
      responseId
    ]);
    
    updateUserEncumbranceRealTime(email, totalCost, 'add');
    
    // Approval Logic
    const budgetAvailable = userBudget.allocated - userBudget.spent - userBudget.encumbered;
    const withinBudget = totalCost <= budgetAvailable;
    const belowAutoApproval = totalCost < CONFIG.AUTO_APPROVAL_LIMIT;
    
    if (belowAutoApproval && withinBudget) {
      const actualApprover = getApproverForRequest({ amount: totalCost }, userBudget);
      updateQueueStatus(transactionId, 'APPROVED', actualApprover, true);
      sendApprovalNotification(email, {
        transactionId: transactionId,
        amount: totalCost,
        type: 'Warehouse Request',
        description: description,
        approver: actualApprover
      });
    } else {
      const approver = getApproverForRequest({ amount: totalCost }, userBudget);
      sendEnhancedApprovalEmail(approver, {
        transactionId,
        type: 'Warehouse Request',
        amount: totalCost,
        requestor: email,
        description,
        items: warehouseItems,
        budgetContext: {
          available: budgetAvailable,
          withinBudget,
          utilization: (userBudget.spent / userBudget.allocated * 100).toFixed(1)
        }
      });
    }
    
    updateAllUserEncumbrances();
    console.log('🏪 === WAREHOUSE PROCESSING COMPLETE ===');
    
  } catch (error) {
    console.error('❌ WAREHOUSE ERROR:', error);
    handleProcessingError(e, error);
  } finally {
    lock.releaseLock();
  }
}

// ============================================================================
// FIELD TRIP FORM PROCESSING
// ============================================================================

function processFieldTripFormSubmission(e) {
  const lock = LockService.getScriptLock();
  try { lock.waitLock(30000); } catch(e) { throw new Error('System busy (Lock timeout)'); }

  try {
    const response = e.response;
    const responseId = response.getId();
    const timestamp = new Date();
    
    Utilities.sleep(3000);
    
    const manualHub = SpreadsheetApp.openById(CONFIG.MANUAL_HUB_ID);
    const formSheet = manualHub.getSheetByName('Field Trip');
    const data = formSheet.getDataRange().getValues();
    const lastRowIndex = data.length - 1;
    const row = data[lastRowIndex];
    
    const email = row[1];
    const destination = row[2];
    const tripDate = row[3];
    const numStudents = parseInt(row[4]) || 0;
    const transportation = row[5];
    const totalCost = parseFloat(String(row[6]).replace(/[$,]/g, '')) || 0;
    const pdfUpload = row[7];
    
    if (!email || !email.includes('@')) throw new Error(`Invalid email: "${email}"`);
    
    const userBudget = getUserBudgetInfo(email);
    if (!userBudget) throw new Error(`User ${email} not found in directory`);
    
    const transactionId = generateSequentialTransactionId('FIELD_TRIP');
    
    try {
      const lastCol = formSheet.getLastColumn() + 1;
      if (formSheet.getRange(1, lastCol).getValue() !== 'TransactionID') {
        formSheet.getRange(1, lastCol).setValue('TransactionID');
      }
      formSheet.getRange(lastRowIndex + 1, lastCol).setValue(transactionId);
    } catch (formError) { console.error('Error adding transaction ID:', formError); }
    
    const queueSheet = getOrCreateQueueSheet(manualHub, 'ManualQueue');
    const description = `Field trip to ${destination} on ${tripDate} - ${numStudents} students via ${transportation}`;
    
    queueSheet.appendRow([
      transactionId, email, 'FIELD_TRIP', userBudget.department,
      getDivisionFromDepartment(userBudget.department), totalCost,
      description, 'PENDING', timestamp, '', '', responseId
    ]);
    
    updateUserEncumbranceRealTime(email, totalCost, 'add');
    const budgetAvailable = userBudget.allocated - userBudget.spent - userBudget.encumbered;
    const approver = getApproverForRequest({ amount: totalCost }, userBudget);
    
    const pdfLink = pdfUpload ? extractPdfLink(pdfUpload) : null;
    
    sendEnhancedApprovalEmail(approver, {
      transactionId, type: 'Field Trip Request', amount: totalCost, requestor: email,
      description: description,
      items: [{
        description: `Field trip to ${destination}`,
        quantity: parseInt(numStudents) || 1,
        unitPrice: (parseInt(numStudents) > 0) ? totalCost / parseInt(numStudents) : totalCost,
        totalPrice: totalCost
      }],
      budgetContext: {
        available: budgetAvailable,
        withinBudget: totalCost <= budgetAvailable,
        utilization: (userBudget.spent / userBudget.allocated * 100).toFixed(1)
      },
      pdfLink: pdfLink
    });
    
    logSystemEvent('FIELD_TRIP_SUBMITTED', email, totalCost, { transactionId });
    
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
  const lock = LockService.getScriptLock();
  try { lock.waitLock(30000); } catch(e) { throw new Error('System busy (Lock timeout)'); }

  try {
    const response = e.response;
    const responseId = response.getId();
    const timestamp = new Date();
    
    Utilities.sleep(3000);
    
    const manualHub = SpreadsheetApp.openById(CONFIG.MANUAL_HUB_ID);
    const formSheet = manualHub.getSheetByName('Curriculum');
    const data = formSheet.getDataRange().getValues();
    const lastRowIndex = data.length - 1;
    const row = data[lastRowIndex];
    
    const email = row[1];
    const curriculumType = row[2];
    const resourceName = row[4];
    const quantity = parseInt(row[7]) || 0;
    const cost = parseFloat(String(row[8]).replace(/[$,]/g, '')) || 0;
    const pdfUpload = row[9];
    
    if (!email || !email.includes('@')) throw new Error(`Invalid email: "${email}"`);
    
    const userBudget = getUserBudgetInfo(email);
    if (!userBudget) throw new Error(`User ${email} not found in directory`);
    
    const transactionId = generateSequentialTransactionId('CURRICULUM');
    
    try {
      const lastCol = formSheet.getLastColumn() + 1;
      if (formSheet.getRange(1, lastCol).getValue() !== 'TransactionID') {
        formSheet.getRange(1, lastCol).setValue('TransactionID');
      }
      formSheet.getRange(lastRowIndex + 1, lastCol).setValue(transactionId);
    } catch (formError) { console.error('Error adding transaction ID:', formError); }
    
    const queueSheet = getOrCreateQueueSheet(manualHub, 'ManualQueue');
    const description = `${curriculumType} - ${resourceName} (Qty: ${quantity})`;
    
    queueSheet.appendRow([
      transactionId, email, 'CURRICULUM', userBudget.department,
      getDivisionFromDepartment(userBudget.department), cost,
      description, 'PENDING', timestamp, '', '', responseId
    ]);
    
    updateUserEncumbranceRealTime(email, cost, 'add');
    const budgetAvailable = userBudget.allocated - userBudget.spent - userBudget.encumbered;
    const approver = getApproverForRequest({ amount: cost }, userBudget);
    
    const pdfLink = pdfUpload ? extractPdfLink(pdfUpload) : null;
    
    sendEnhancedApprovalEmail(approver, {
      transactionId, type: 'Curriculum Request', amount: cost, requestor: email,
      description: description,
      items: [{
        description: resourceName,
        quantity: quantity || 1,
        unitPrice: (quantity > 0) ? cost / quantity : cost,
        totalPrice: cost
      }],
      budgetContext: {
        available: budgetAvailable, withinBudget: cost <= budgetAvailable,
        utilization: (userBudget.spent / userBudget.allocated * 100).toFixed(1)
      },
      pdfLink: pdfLink
    });
    
    logSystemEvent('CURRICULUM_APPROVAL_REQUESTED', email, cost, { transactionId, approver });
    
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
  const lock = LockService.getScriptLock();
  try { lock.waitLock(30000); } catch(e) { throw new Error('System busy (Lock timeout)'); }

  try {
    const response = e.response;
    const responseId = response.getId();
    const timestamp = new Date();
    
    Utilities.sleep(3000);
    
    const manualHub = SpreadsheetApp.openById(CONFIG.MANUAL_HUB_ID);
    const formSheet = manualHub.getSheetByName('Admin');
    const data = formSheet.getDataRange().getValues();
    const lastRowIndex = data.length - 1;
    const row = data[lastRowIndex];
    
    const email = row[1];
    const description = row[2];
    const amount = parseFloat(String(row[3]).replace(/[$,]/g, '')) || 0;
    const pdfUpload = row[5];
    
    if (!email || !email.includes('@')) throw new Error(`Invalid email: "${email}"`);
    
    const userBudget = getUserBudgetInfo(email);
    if (!userBudget) throw new Error(`User ${email} not found in directory`);
    
    const transactionId = generateSequentialTransactionId('ADMIN');
    
    try {
      const lastCol = formSheet.getLastColumn() + 1;
      if (formSheet.getRange(1, lastCol).getValue() !== 'TransactionID') {
        formSheet.getRange(1, lastCol).setValue('TransactionID');
      }
      formSheet.getRange(lastRowIndex + 1, lastCol).setValue(transactionId);
    } catch (formError) { console.error('Error adding transaction ID:', formError); }
    
    const queueSheet = getOrCreateQueueSheet(manualHub, 'ManualQueue');

    queueSheet.appendRow([
      transactionId, email, 'ADMIN', userBudget.department,
      getDivisionFromDepartment(userBudget.department), amount,
      description, 'PENDING', timestamp, '', '', responseId
    ]);
    
    updateUserEncumbranceRealTime(email, amount, 'add');
    const budgetAvailable = userBudget.allocated - userBudget.spent - userBudget.encumbered;
    const approver = getApproverForRequest({ amount: amount }, userBudget);
    
    const pdfLink = pdfUpload ? extractPdfLink(pdfUpload) : null;
    
    sendEnhancedApprovalEmail(approver, {
      transactionId, type: 'Admin Purchase', amount: amount, requestor: email,
      description: description,
      items: [{
        description: description,
        quantity: 1,
        unitPrice: amount,
        totalPrice: amount
      }],
      budgetContext: {
        available: budgetAvailable, withinBudget: amount <= budgetAvailable,
        utilization: (userBudget.spent / userBudget.allocated * 100).toFixed(1)
      },
      pdfLink: pdfLink
    });
    
    logSystemEvent('ADMIN_APPROVAL_REQUESTED', email, amount, { transactionId, approver });
    
  } catch (error) {
    handleProcessingError(e, error);
  } finally {
    lock.releaseLock();
  }
}

// ============================================================================
// APPROVAL & ROUTING HELPERS
// ============================================================================

function processApprovalDecision(transactionId, approverEmail, decision) {
  try {
    const request = findRequestInQueues(transactionId);
    if (!request) {
      return { success: false, error: 'Request not found or already processed' };
    }
    
    if (request.status !== 'PENDING') {
      return { success: false, error: `Request already ${request.status.toLowerCase()}` };
    }

    if (decision === 'approve') {
      const budgetCheck = validateBudgetBeforeApproval(request);
      if (!budgetCheck.valid) {
        logSystemEvent('APPROVAL_BLOCKED_OVERBUDGET', approverEmail, request.amount, {
          transactionId,
          available: budgetCheck.available,
          encumbrance: budgetCheck.encumbrance
        });
        
        return { 
          success: false, 
          error: `Cannot approve: ${budgetCheck.message}. Current available budget: $${budgetCheck.available.toFixed(2)}` 
        };
      }
    }

    const validApprover = validateApprover(approverEmail, request);
    if (!validApprover) {
      return { success: false, error: 'You are not authorized to approve this request' };
    }
    
    const newStatus = decision === 'approve' ? 'APPROVED' : 'REJECTED';
    const updateSuccess = updateQueueStatus(transactionId, newStatus, approverEmail, request.isAutomated);
    
    if (!updateSuccess) {
      return { success: false, error: 'Failed to update queue status' };
    }
    
    if (newStatus === 'APPROVED') {
      sendApprovalConfirmation(request.email, transactionId, request.amount, request.description);
      updateUserBudgetEncumbrance(request.email, request.amount, 'add');
      
      if (!request.isAutomated) {
        const orderId = generateOrderID(request.division || request.department, request.type);
        moveToTransactionLedger({
          transactionId: transactionId,
          orderId: orderId,
          requestor: request.email,
          approver: approverEmail,
          organization: request.department,
          form: request.type,
          amount: request.amount,
          description: request.description
        });
      } else {
        console.log(`Automated item ${transactionId} approved - awaiting batch processing`);
      }
      
    } else {
      sendRejectionNotification(request.email, {
        transactionId: transactionId,
        type: request.type,
        amount: request.amount,
        description: request.description,
        approver: approverEmail
      });
      
      if (request.wasOverBudget) {
        releaseBudgetHold(request.email, request.amount);
      }
      
      if (request.isAutomated && decision === 'reject') {
        // Offer to resubmit with different pricing or alternatives
        sendResubmissionNotification(
          request.email,
          request.type,
          { transactionId: transactionId, description: request.description, amount: request.amount },
          'Your request was rejected. You may resubmit with updated information.'
        );
      }
    }
    
    logSystemEvent(`REQUEST_${newStatus}`, approverEmail, request.amount, { 
        transactionId, requestor: request.email, timestamp: new Date() 
    });
    
    return { success: true, status: newStatus };
    
  } catch (error) {
    console.error('Error processing approval:', error);
    logSystemEvent('APPROVAL_ERROR', approverEmail, 0, { transactionId, error: error.toString() });
    return { success: false, error: error.toString() };
  }
}

function updateQueueStatus(transactionId, status, approver, isAutomated) {
  const hubId = isAutomated ? CONFIG.AUTOMATED_HUB_ID : CONFIG.MANUAL_HUB_ID;
  const hub = SpreadsheetApp.openById(hubId);
  const queue = hub.getSheetByName(isAutomated ? 'AutomatedQueue' : 'ManualQueue');
  const data = queue.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === transactionId) {
      const oldStatus = data[i][7];
      const requestor = data[i][1];
      const amount = parseFloat(data[i][5]) || 0;
      
      queue.getRange(i + 1, 8).setValue(status);           // Status
      queue.getRange(i + 1, 10).setValue(new Date());      // ApprovedOn
      queue.getRange(i + 1, 11).setValue(approver);        // Approver
      
      if (oldStatus !== status) {
        // If status changed to REJECTED or VOID, remove encumbrance
        if (status === 'REJECTED' || status === 'VOID') {
          updateUserEncumbranceRealTime(requestor, amount, 'remove');
        }
        // If status changed to ORDERED from PENDING/APPROVED, encumbrance is handled (removed + spent added)
        // But spent is only added when Invoice is generated or PEX txn clears.
        // For now, removing encumbrance is correct if the money is effectively "spent".
        // Actually, if ORDERED, it should stay encumbered until invoiced?
        // No, current logic removes encumbrance when ORDERED.
      }
      
      return true;
    }
  }
  return false;
}

function moveToTransactionLedger(transaction) {
  const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
  let ledger = budgetHub.getSheetByName('TransactionLedger');
  
  if (!ledger) {
    ledger = budgetHub.insertSheet('TransactionLedger');
    ledger.appendRow(['TransactionID', 'OrderID', 'ProcessedOn', 'Requestor', 'Approver', 'Organization', 'Form', 'Amount', 'Description', 'FiscalQuarter', 'InvoiceGenerated']);
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
    ''
  ]);
}

function createFormattedMultiItemDescription(items) {
  if (!items || items.length === 0) return 'No items';
  const descriptions = items.map(item => {
    const qty = item.quantity || 1;
    const desc = item.description || item.itemDescription || 'Unknown Item';
    const cleanDesc = desc.trim().substring(0, 50);
    return qty > 1 ? `${qty}x ${cleanDesc}` : cleanDesc;
  });
  const fullDesc = descriptions.join(', ');
  return fullDesc.length > 200 ? fullDesc.substring(0, 197) + '...' : fullDesc;
}

// ============================================================================
// WAREHOUSE ORDER PROCESSING
// ============================================================================

function processWarehouseOrders() {
  try {
    console.log('🏪 Processing warehouse orders');
    
    const autoHub = SpreadsheetApp.openById(CONFIG.AUTOMATED_HUB_ID);
    const queueSheet = autoHub.getSheetByName('AutomatedQueue');
    const queueData = queueSheet.getDataRange().getValues();
    
    let processedCount = 0;
    const processedItems = [];

    for (let i = 1; i < queueData.length; i++) {
      if (queueData[i][2] === 'WAREHOUSE' && queueData[i][7] === 'APPROVED') {
        const transactionId = queueData[i][0];
        const division = queueData[i][4] || 'General';
        const orderId = generateOrderID(division, 'WAREHOUSE');

        // Move to transaction ledger
        moveToTransactionLedger({
          transactionId,
          orderId,
          requestor: queueData[i][1],
          approver: queueData[i][10],
          organization: queueData[i][3],
          form: 'WAREHOUSE',
          amount: queueData[i][5],
          description: queueData[i][6]
        });
        
        // Update status to ORDERED
        queueSheet.getRange(i + 1, 8).setValue('ORDERED');
        queueSheet.getRange(i + 1, 10).setValue(new Date());
        
        processedItems.push({
          transactionId,
          requestor: queueData[i][1],
          department: queueData[i][3],
          amount: queueData[i][5],
          description: queueData[i][6]
        });
        
        processedCount++;
      }
    }
    
    if (processedCount > 0) {
      const lastOrderId = processedItems.length > 0 ? 'batch' : '';
      console.log(`✅ Processed ${processedCount} warehouse orders`);
      // Invoice generation will handle sending to business office
    }

    return { success: true, processedCount, processedItems };
    
  } catch (error) {
    console.error('❌ Warehouse processing error:', error);
    return { success: false, error: error.toString() };
  }
}

function validateApprover(approverEmail, request) {
  // TEST MODE SUPER-ADMIN OVERRIDE
  if (isTestMode()) {
    const currentUser = Session.getActiveUser().getEmail();
    if (currentUser === CONFIG.ADMIN_EMAIL || 
        approverEmail === CONFIG.ADMIN_EMAIL ||
        currentUser === 'invoicing@keswickchristian.org') {
        // Log this explicit override
        console.warn(`🔓 TEST MODE: Allowing approval for ${approverEmail} by ${currentUser}`);
        return true;
    }
  }

  // Always allow business office
  if (approverEmail === CONFIG.BUSINESS_OFFICE_EMAIL) {
    return true;
  }
  
  // Get user info
  const userBudget = getUserBudgetInfo(request.email);
  if (!userBudget) return false;
  
  // Check if approver matches expected approver
  if (userBudget.approver === approverEmail) {
    return true;
  }
  
  // Check division heads
  const divisionHeads = {
    'Upper School': ['ushead@keswickchristian.org'],
    'Lower School': ['lshead@keswickchristian.org'],
    'Administration': ['mtrotter@keswickchristian.org']
  };
  
  if (divisionHeads[request.division] && divisionHeads[request.division].includes(approverEmail)) {
    return true;
  }
  
  return false;
}

function findRequestInQueues(transactionId) {
  // Check automated queue
  try {
    const autoHub = SpreadsheetApp.openById(CONFIG.AUTOMATED_HUB_ID);
    const autoQueue = autoHub.getSheetByName('AutomatedQueue');
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
          formPrefix: autoData[i][2] === 'AMAZON' ? 'AMZ' : 'PCW',
          row: i + 1
        };
      }
    }
  } catch (error) {
    console.error('Error checking automated queue:', error);
  }
  
  // Check manual queue
  try {
    const manualHub = SpreadsheetApp.openById(CONFIG.MANUAL_HUB_ID);
    const manualQueue = manualHub.getSheetByName('ManualQueue');
    const manualData = manualQueue.getDataRange().getValues();
    
    for (let i = 1; i < manualData.length; i++) {
      if (manualData[i][0] === transactionId) {
        const typeMap = {
          'FIELD_TRIP': 'FT',
          'CURRICULUM': 'CI',
          'ADMIN': 'ADMIN'
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
          formPrefix: typeMap[manualData[i][2]] || 'TXN',
          row: i + 1
        };
      }
    }
  } catch (error) {
    console.error('Error checking manual queue:', error);
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
        issue: 'Invalid or non-Amazon URL'
      });
    }
    
    // Check if ASIN can be extracted
    const asin = extractASIN(item.url);
    if (!asin && item.url.includes('amazon.com')) {
      invalidItems.push({
        itemNumber: index + 1,
        description: item.description,
        url: item.url,
        issue: 'Cannot extract ASIN from Amazon URL'
      });
    }
  });
  
  if (invalidItems.length > 0) {
    voidOrderAndNotifyRequestor(transactionId, requestorEmail, 'AMAZON', invalidItems);
    return false;
  }
  
  return true;
}

function validateWarehouseOrder(transactionId, warehouseRow, requestorEmail) {
  const invalidItems = [];
  
  // Check each item's ID against catalog
  const itemMappings = [
    { idCol: 2, qtyCol: 3, descCol: 17, priceCol: 18, itemNum: 1 },
    { idCol: 5, qtyCol: 6, descCol: 19, priceCol: 20, itemNum: 2 },
    { idCol: 8, qtyCol: 9, descCol: 21, priceCol: 22, itemNum: 3 },
    { idCol: 11, qtyCol: 12, descCol: 23, priceCol: 24, itemNum: 4 },
    { idCol: 14, qtyCol: 15, descCol: 25, priceCol: 26, itemNum: 5 }
  ];
  
  itemMappings.forEach(mapping => {
    const itemId = warehouseRow[mapping.idCol];
    const desc = warehouseRow[mapping.descCol];
    const price = warehouseRow[mapping.priceCol];
    
    if (itemId && itemId.toString().trim() !== '') {
      // Check if lookup failed (indicated by #N/A or empty values)
      if (!desc || desc === '#N/A' || !price || price === '#N/A' || price === 0) {
        invalidItems.push({
          itemNumber: mapping.itemNum,
          itemId: itemId,
          issue: 'Item ID not found in warehouse catalog'
        });
      }
    }
  });
  
  if (invalidItems.length > 0) {
    voidOrderAndNotifyRequestor(transactionId, requestorEmail, 'WAREHOUSE', invalidItems);
    return false;
  }
  
  return true;
}

function isValidAmazonUrl(url) {
  if (!url) return false;
  
  const urlStr = url.toString().toLowerCase();
  
  // Must contain amazon.com
  if (!urlStr.includes('amazon.com')) return false;
  
  // Must be a valid URL format
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.includes('amazon.com');
  } catch {
    return false;
  }
}

function voidOrderAndNotifyRequestor(transactionId, requestorEmail, orderType, invalidItems) {
  try {
    // Update queue status to VOID
    const isAutomated = ['AMAZON', 'WAREHOUSE'].includes(orderType);
    updateQueueStatus(transactionId, 'VOID', 'SYSTEM_VALIDATION', isAutomated);
    
    // Send detailed notification to requestor
    sendValidationErrorEmail(requestorEmail, transactionId, orderType, invalidItems);
    
    // Log the validation failure
    logSystemEvent('ORDER_VALIDATION_FAILED', requestorEmail, 0, {
      transactionId,
      orderType,
      invalidItems
    });
    
  } catch (error) {
    console.error('Error voiding order:', error);
    // Fall back to business office notification
    handleCriticalError(transactionId, orderType, error, { requestorEmail, invalidItems });
  }
}

function generateApprovalUrl(transactionId, approverEmail, decision) {
  const params = {
    action: 'approve',
    transactionId: transactionId,
    approver: approverEmail,
    decision: decision,
    timestamp: Date.now()
  };
  
  const queryString = Object.keys(params)
    .map(key => `${key}=${encodeURIComponent(params[key])}`)
    .join('&');
  
  return `${CONFIG.WEBAPP_URL}?${queryString}`;
}
