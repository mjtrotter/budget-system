// ============================================================================
// KESWICK CHRISTIAN SCHOOL - COMPLETE INVOICE GENERATION SYSTEM
// ============================================================================
// Production-ready invoice generation with proper data flow and enrichment
// Handles multi-column line item parsing and complete transaction tracing
// ============================================================================

// ============================================================================
// GLOBAL CONFIGURATION WITH ACTUAL IDS
// ============================================================================
const CONFIG = {
  // Spreadsheet IDs - invoicing@keswickchristian.org account
  BUDGET_HUB_ID: '1wbv44RU18vJXlImWwxf4VRX932LgWCTBEn6JNws9HhQ',
  AUTOMATED_HUB_ID: '1mGcKhEehd4OwqUy1_zN40SWJ7O_aL5ax-6B_oZDddfM', 
  MANUAL_HUB_ID: '1-t7YnyVvk0vxqbKGNteNHOQ92XOJNme4eJPjxVRVI5M',
  
  // Invoice Configuration - CONFIGURED
  INVOICE_ROOT_FOLDER_ID: '1a6fw86-zYsTL75f4zkkgYPgh2sSxkNR5',
  SCHOOL_LOGO_FILE_ID: '1HDkW_xGIc4jOBH4REnXb3VJcZaEjPHKj',      // Wide logo (header)
  SCHOOL_SEAL_FILE_ID: '15vM2fQwJ2su1Zv9RUKzEC6w1mU7v7r01',      // Seal logo (watermark)
  
  // Email Settings
  SENDER_EMAIL: 'invoicing@keswickchristian.org',
  ERROR_NOTIFICATION_EMAIL: 'mtrotter@keswickchristian.org',
  HEALTH_CHECK_EMAIL: 'mtrotter@keswickchristian.org',
  
  // Test Mode - Set to false for production
  TEST_MODE: true,
  TEST_EMAIL_RECIPIENT: 'mtrotter@keswickchristian.org',
  
  // Processing Settings
  MAX_LINE_ITEMS_PER_BATCH: 10,
  MAX_TRANSACTIONS_PER_BATCH: 20,
  OVERNIGHT_PROCESSING_HOUR: 3, // 3 AM
  MAX_PROCESSING_TIME_MINUTES: 55,
  BATCH_DELAY_MS: 1000,
  
  // Division Signatures (optional - can be added later)
  DIVISION_SIGNATURES: {
    'Upper School': { name: 'Upper School Principal', title: 'Principal', signatureFileId: null },
    'Lower School': { name: 'Lower School Principal', title: 'Principal', signatureFileId: null },
    'Keswick Kids': { name: 'Keswick Kids Director', title: 'Director', signatureFileId: null },
    'Administration': { name: 'Business Administrator', title: 'Administrator', signatureFileId: null }
  },
  
  // Template Configuration
  TEMPLATES: {
    SINGLE_INTERNAL: 'single_internal_template',
    BATCH_INTERNAL: 'batch_internal_template',
    WAREHOUSE_EXTERNAL: 'warehouse_external_template'
  },
  
  // Cache Settings
  CACHE_EXPIRATION_SECONDS: 3600,
  
  // Error Handling
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 2000
};


// ============================================================================
// HUB HEADER MAPPINGS - COMPLETE WITH ALL FORMS
// ============================================================================
function loadHubHeaderMappings() {
  const cacheKey = 'hubHeaderMappings';
  const cache = CacheService.getScriptCache();
  
  try {
    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log('🏆 Using cached hub header mappings');
      return JSON.parse(cached);
    }
    
    console.log('📊 Loading hub header mappings...');
    
    const mappings = {
      budget: {
        TransactionLedger: {
          TransactionID: 0,      // A
          OrderID: 1,            // B  
          ProcessedOn: 2,        // C
          Requestor: 3,          // D
          Approver: 4,           // E
          Organization: 5,       // F
          Form: 6,               // G
          Amount: 7,             // H
          Description: 8,        // I
          FiscalQuarter: 9,      // J
          InvoiceGenerated: 10,  // K
          InvoiceID: 11,         // L
          InvoiceURL: 12         // M
        },
        UserDirectory: {
          Email: 0,              // A
          FirstName: 1,          // B
          LastName: 2,           // C
          Role: 3,               // D
          Department: 4,         // E
          Division: 5,           // F
          Approver: 6,           // G
          BudgetAllocated: 7,    // H
          BudgetSpent: 8,        // I
          BudgetEncumbered: 9,   // J
          BudgetRemaining: 10,   // K
          UtilizationRate: 11,   // L
          Active: 12,            // M
          LastModified: 13       // N
        }
      },
      automated: {
        Amazon: {
          Timestamp: 0,          // A
          EmailAddress: 1,       // B
          // Multi-item structure (5 items max)
          Item1Description: 2,   // C
          Item1AmazonURL: 3,     // D
          Item1Quantity: 4,      // E
          Item1UnitPrice: 5,     // F
          Item1TotalPrice: 6,    // G
          Item2Description: 7,   // H
          Item2AmazonURL: 8,     // I
          Item2Quantity: 9,      // J
          Item2UnitPrice: 10,    // K
          Item2TotalPrice: 11,   // L
          Item3Description: 12,  // M
          Item3AmazonURL: 13,    // N
          Item3Quantity: 14,     // O
          Item3UnitPrice: 15,    // P
          Item3TotalPrice: 16,   // Q
          Item4Description: 17,  // R
          Item4AmazonURL: 18,    // S
          Item4Quantity: 19,     // T
          Item4UnitPrice: 20,    // U
          Item4TotalPrice: 21,   // V
          Item5Description: 22,  // W
          Item5AmazonURL: 23,    // X
          Item5Quantity: 24,     // Y
          Item5UnitPrice: 25,    // Z
          Item5TotalPrice: 26,   // AA
          TotalCost: 27,         // AB
          TransactionID: 28      // AC (added after submission)
        },
        Warehouse: {
          Timestamp: 0,          // A
          EmailAddress: 1,       // B
          // Multi-item structure with split columns
          Item1ItemID: 2,        // C
          Item1Quantity: 3,      // D
          Item2ItemID: 5,        // F
          Item2Quantity: 6,      // G
          Item3ItemID: 8,        // I
          Item3Quantity: 9,      // J
          Item4ItemID: 11,       // L
          Item4Quantity: 12,     // M
          Item5ItemID: 14,       // O
          Item5Quantity: 15,     // P
          // Descriptions and prices are in later columns
          Item1Description: 17,  // R
          Item1Price: 18,        // S
          Item2Description: 19,  // T
          Item2Price: 20,        // U
          Item3Description: 21,  // V
          Item3Price: 22,        // W
          Item4Description: 23,  // X
          Item4Price: 24,        // Y
          Item5Description: 25,  // Z
          Item5Price: 26,        // AA
          TotalCost: 27,         // AB
          TransactionID: 28      // AC (added after submission)
        },
        AutomatedQueue: {
          TransactionID: 0,      // A
          Requestor: 1,          // B
          RequestType: 2,        // C
          Department: 3,         // D
          Division: 4,           // E
          Amount: 5,             // F
          Description: 6,        // G
          Status: 7,             // H
          Requested: 8,          // I
          Approved: 9,           // J
          Processed: 10,         // K
          ResponseID: 11         // L
        }
      },
      manual: {
        Admin: {
          Timestamp: 0,          // A
          EmailAddress: 1,       // B
          PurchaseDescription: 2,// C
          TotalCost: 3,          // D
          Rationale: 4,          // E
          UploadInvoice: 5,      // F
          TransactionID: 6       // G (added after submission)
        },
        FieldTrip: {
          Timestamp: 0,          // A
          EmailAddress: 1,       // B
          TripDestination: 2,    // C
          TripDate: 3,           // D
          NumberOfStudents: 4,   // E
          TransportationType: 5, // F
          TotalCost: 6,          // G
          UploadInvoice: 7,      // H
          TransactionID: 8       // I (added after submission)
        },
        Curriculum: {
          Timestamp: 0,          // A
          EmailAddress: 1,       // B
          CurriculumType: 2,     // C
          ItemDetailsMethod: 3,  // D
          ResourceName: 4,       // E
          ResourceURL: 5,        // F
          ISBN: 6,               // G
          QuantityNeeded: 7,     // H
          TotalCost: 8,          // I
          UploadPDF: 9,          // J
          TransactionID: 10      // K (added after submission)
        },
        ManualQueue: {
          TransactionID: 0,      // A
          Requestor: 1,          // B
          RequestType: 2,        // C
          Department: 3,         // D
          Division: 4,           // E
          Amount: 5,             // F
          Description: 6,        // G
          Status: 7,             // H
          Requested: 8,          // I
          Approved: 9,           // J
          Processed: 10,         // K
          ResponseID: 11         // L
        }
      }
    };
    
    // Cache for 1 hour
    cache.put(cacheKey, JSON.stringify(mappings), CONFIG.CACHE_EXPIRATION_SECONDS);
    console.log('✅ Hub header mappings loaded and cached');
    
    return mappings;
    
  } catch (error) {
    console.error('Failed to load hub header mappings:', error);
    throw error;
  }
}

// ============================================================================
// PHASE 1: CORE UTILITIES AND TRANSACTION RETRIEVAL
// ============================================================================

/**
 * Get unprocessed transactions from TransactionLedger
 * @return {Array} Array of unprocessed transactions
 */
function getUnprocessedTransactions() {
  try {
    const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
    const ledgerSheet = budgetHub.getSheetByName('TransactionLedger');
    
    const mappings = loadHubHeaderMappings();
    const cols = mappings.budget.TransactionLedger;
    
    const dataRange = ledgerSheet.getDataRange();
    const values = dataRange.getValues();
    
    const unprocessed = [];
    
    // Skip header row
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      
      // Check if invoice already generated
      if (!row[cols.InvoiceGenerated] || row[cols.InvoiceGenerated] === '') {
        unprocessed.push({
          rowIndex: i + 1, // 1-based for sheet operations
          transactionId: row[cols.TransactionID],
          orderId: row[cols.OrderID],
          processedOn: row[cols.ProcessedOn],
          requestor: row[cols.Requestor],
          approver: row[cols.Approver],
          organization: row[cols.Organization],
          formType: row[cols.Form], // Critical: Extract formType from Form column
          amount: parseFloat(row[cols.Amount]) || 0,
          description: row[cols.Description],
          fiscalQuarter: row[cols.FiscalQuarter]
        });
      }
    }
    
    console.log(`📊 Found ${unprocessed.length} unprocessed transactions`);
    return unprocessed;
    
  } catch (error) {
    console.error('Failed to get unprocessed transactions:', error);
    return [];
  }
}

/**
 * Update transaction ledger with invoice information
 * @param {string} transactionId - Transaction ID
 * @param {string} invoiceId - Generated invoice ID
 * @param {string} invoiceUrl - Drive URL of invoice
 * @return {boolean} Success status
 */
function updateTransactionLedgerWithInvoice(transactionId, invoiceId, invoiceUrl) {
  try {
    const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
    const ledgerSheet = budgetHub.getSheetByName('TransactionLedger');
    
    const mappings = loadHubHeaderMappings();
    const cols = mappings.budget.TransactionLedger;
    
    const dataRange = ledgerSheet.getDataRange();
    const values = dataRange.getValues();
    
    // Find the transaction row
    for (let i = 1; i < values.length; i++) {
      if (values[i][cols.TransactionID] === transactionId) {
        const rowIndex = i + 1;
        
        // Update invoice columns
        ledgerSheet.getRange(rowIndex, cols.InvoiceGenerated + 1).setValue(new Date());
        ledgerSheet.getRange(rowIndex, cols.InvoiceID + 1).setValue(invoiceId);
        if (invoiceUrl) {
          ledgerSheet.getRange(rowIndex, cols.InvoiceURL + 1).setValue(invoiceUrl);
        }
        
        console.log(`✅ Updated ledger for transaction ${transactionId}`);
        return true;
      }
    }
    
    console.warn(`⚠️ Transaction ${transactionId} not found in ledger`);
    return false;
    
  } catch (error) {
    console.error(`Failed to update ledger for ${transactionId}:`, error);
    return false;
  }
}

// ============================================================================
// PHASE 2: INVOICE ID GENERATION WITH PROPER FORMAT
// ============================================================================

/**
 * Generate unique invoice ID with format: DIV-FORM-MMDD-NN
 * @param {Object} transaction - Transaction object
 * @param {boolean} isReprocess - Whether this is a reprocess
 * @return {string} Generated invoice ID
 */
function generateInvoiceId(transaction, isReprocess = false) {
  try {
    // Get division code
    const divisionName = getDivisionFromTransaction(transaction);
    const divisionCode = {
      'Upper School': 'US',
      'Lower School': 'LS',
      'Keswick Kids': 'KK',
      'Administration': 'AD',
      'Admin': 'AD'
    }[divisionName] || 'AD';
    
    // Get form type code
    const formCode = {
      'Amazon': 'AMZ',
      'AMAZON': 'AMZ',
      'Warehouse': 'PCW',
      'WAREHOUSE': 'PCW',
      'Field Trip': 'FT',
      'FIELD_TRIP': 'FT',
      'Curriculum': 'CI',
      'CURRICULUM': 'CI',
      'Admin': 'AD',
      'ADMIN': 'AD',
      'Other': 'OTH'
    }[transaction.formType] || 'OTH';
    
    // Get date string (MMDD format)
    const processedDate = transaction.processedOn ? new Date(transaction.processedOn) : new Date();
    const month = String(processedDate.getMonth() + 1).padStart(2, '0');
    const day = String(processedDate.getDate()).padStart(2, '0');
    const dateStr = month + day;
    
    // Get existing invoices for today to determine sequence
    const existingIds = getExistingInvoiceIds(divisionCode, formCode, dateStr);
    const nextSequence = existingIds.length + 1;
    const sequence = String(nextSequence).padStart(2, '0');
    
    // Build invoice ID
    let invoiceId = `${divisionCode}-${formCode}-${dateStr}-${sequence}`;
    
    if (isReprocess) {
      invoiceId = `REP-${invoiceId}`;
    }
    
    console.log(`🆔 Generated invoice ID: ${invoiceId}`);
    return invoiceId;
    
  } catch (error) {
    console.error('Failed to generate invoice ID:', error);
    return `INV-${Date.now()}`; // Fallback
  }
}

/**
 * Get existing invoice IDs for a specific date/division/form combination
 * @param {string} divisionCode - Division code
 * @param {string} formCode - Form code
 * @param {string} dateStr - Date string (MMDD)
 * @return {Array} Array of existing invoice IDs
 */
function getExistingInvoiceIds(divisionCode, formCode, dateStr) {
  try {
    const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
    const ledgerSheet = budgetHub.getSheetByName('TransactionLedger');
    
    const mappings = loadHubHeaderMappings();
    const cols = mappings.budget.TransactionLedger;
    
    const dataRange = ledgerSheet.getDataRange();
    const values = dataRange.getValues();
    
    const pattern = `${divisionCode}-${formCode}-${dateStr}`;
    const existingIds = [];
    
    for (let i = 1; i < values.length; i++) {
      const invoiceId = values[i][cols.InvoiceID];
      if (invoiceId && invoiceId.toString().includes(pattern)) {
        existingIds.push(invoiceId);
      }
    }
    
    return existingIds;
    
  } catch (error) {
    console.error('Failed to get existing invoice IDs:', error);
    return [];
  }
}

// ============================================================================
// PHASE 3: COMPREHENSIVE DATA ENRICHMENT WITH LINE ITEM RETRIEVAL
// ============================================================================

/**
 * Enrich transaction data with line items from original form submission
 * @param {Object} transaction - Base transaction
 * @return {Object} Enriched transaction with line items
 */
function enrichTransactionData(transaction) {
  try {
    console.log(`🔍 Enriching transaction ${transaction.transactionId} (${transaction.formType})`);
    
    // Ensure formType is present
    if (!transaction.formType) {
      console.warn(`⚠️ Transaction ${transaction.transactionId} missing formType`);
      transaction.formType = 'Other';
    }
    
    const enriched = {
      ...transaction,
      isEnriched: true,
      enrichmentTimestamp: new Date(),
      lineItems: []
    };
    
    // Get line items from original form data
    const lineItemsResult = retrieveLineItemsFromForm(transaction);
    
    if (lineItemsResult.success) {
      enriched.lineItems = lineItemsResult.lineItems;
      enriched.formDetails = lineItemsResult.formDetails;
      enriched.additionalInfo = lineItemsResult.additionalInfo;
    } else {
      console.warn(`⚠️ Could not retrieve line items: ${lineItemsResult.error}`);
      // Create default line item
      enriched.lineItems = [{
        itemId: `${transaction.transactionId}-01`,
        description: transaction.description || 'Purchase item',
        quantity: 1,
        unitPrice: transaction.amount || 0,
        totalPrice: transaction.amount || 0
      }];
    }
    
    // Enrich user names
    enriched.requestorName = getUserFullName(transaction.requestor);
    enriched.approverName = getUserFullName(transaction.approver);
    
    // Get division and department info
    enriched.division = getDivisionFromTransaction(transaction);
    enriched.department = getDepartmentFromEmail(transaction.requestor);
    
    // Calculate totals
    enriched.lineItemTotal = enriched.lineItems.reduce((sum, item) => 
      sum + (item.totalPrice || 0), 0
    );
    
    return enriched;
    
  } catch (error) {
    console.error(`Failed to enrich transaction ${transaction.transactionId}:`, error);
    return {
      ...transaction,
      isEnriched: false,
      enrichmentError: error.message,
      lineItems: [{
        description: transaction.description || 'Purchase item',
        quantity: 1,
        unitPrice: transaction.amount || 0,
        totalPrice: transaction.amount || 0
      }]
    };
  }
}

/**
 * Retrieve line items from original form submission
 * @param {Object} transaction - Transaction with queue/form reference
 * @return {Object} Result with line items and form details
 */
function retrieveLineItemsFromForm(transaction) {
  try {
    console.log(`📋 Retrieving line items for ${transaction.transactionId} from ${transaction.formType} form`);
    
    // First, get queue entry to find ResponseID
    const queueInfo = getQueueInfoForTransaction(transaction);
    
    if (!queueInfo.found) {
      return {
        success: false,
        error: 'Queue entry not found',
        lineItems: []
      };
    }
    
    // Determine which hub contains the form data
    const formHub = getHubForFormType(transaction.formType);
    const formData = getFormSubmissionData(formHub, transaction, queueInfo.responseId);
    
    if (!formData.found) {
      return {
        success: false,
        error: 'Form submission not found',
        lineItems: []
      };
    }
    
    // Parse line items based on form type
    let parseResult;
    const formType = transaction.formType.toUpperCase();
    
    if (formType === 'AMAZON') {
      parseResult = parseAmazonFormItems(formData.row, formHub.mappings);
    } else if (formType === 'WAREHOUSE') {
      parseResult = parseWarehouseFormItems(formData.row, formHub.mappings);
    } else {
      parseResult = parseSingleItemForm(formData.row, formHub.mappings, transaction.formType);
    }
    
    return {
      success: true,
      lineItems: parseResult.lineItems,
      formDetails: parseResult.formDetails,
      additionalInfo: parseResult.additionalInfo
    };
    
  } catch (error) {
    console.error('Failed to retrieve line items:', error);
    return {
      success: false,
      error: error.message,
      lineItems: []
    };
  }
}

/**
 * Get queue information for transaction
 * @param {Object} transaction - Transaction object
 * @return {Object} Queue info with ResponseID
 */
function getQueueInfoForTransaction(transaction) {
  try {
    // Determine which queue to check
    const isAutomated = ['AMAZON', 'WAREHOUSE'].includes(transaction.formType.toUpperCase());
    const hubId = isAutomated ? CONFIG.AUTOMATED_HUB_ID : CONFIG.MANUAL_HUB_ID;
    const queueName = isAutomated ? 'AutomatedQueue' : 'ManualQueue';
    
    const hub = SpreadsheetApp.openById(hubId);
    const queueSheet = hub.getSheetByName(queueName);
    
    const mappings = loadHubHeaderMappings();
    const cols = isAutomated ? 
      mappings.automated.AutomatedQueue : 
      mappings.manual.ManualQueue;
    
    const dataRange = queueSheet.getDataRange();
    const values = dataRange.getValues();
    
    // Find transaction in queue
    for (let i = 1; i < values.length; i++) {
      if (values[i][cols.TransactionID] === transaction.transactionId) {
        return {
          found: true,
          responseId: values[i][cols.ResponseID],
          rowIndex: i,
          queueData: values[i]
        };
      }
    }
    
    return { found: false };
    
  } catch (error) {
    console.error('Failed to get queue info:', error);
    return { found: false, error: error.message };
  }
}

/**
 * Get hub information for form type
 * @param {string} formType - Form type
 * @return {Object} Hub info with mappings
 */
function getHubForFormType(formType) {
  const mappings = loadHubHeaderMappings();
  const upperFormType = formType.toUpperCase();
  
  if (upperFormType === 'AMAZON' || upperFormType === 'WAREHOUSE') {
    return {
      hubId: CONFIG.AUTOMATED_HUB_ID,
      sheetName: formType.charAt(0).toUpperCase() + formType.slice(1).toLowerCase(),
      mappings: upperFormType === 'AMAZON' ? mappings.automated.Amazon : mappings.automated.Warehouse,
      isAutomated: true
    };
  } else {
    // Map form types to sheet names
    const sheetMap = {
      'ADMIN': 'Admin',
      'FIELD TRIP': 'FieldTrip',
      'FIELD_TRIP': 'FieldTrip',
      'CURRICULUM': 'Curriculum'
    };
    
    return {
      hubId: CONFIG.MANUAL_HUB_ID,
      sheetName: sheetMap[upperFormType] || formType,
      mappings: mappings.manual[sheetMap[upperFormType] || formType],
      isAutomated: false
    };
  }
}

/**
 * Get form submission data
 * @param {Object} formHub - Hub info
 * @param {Object} transaction - Transaction
 * @param {string} responseId - Response ID
 * @return {Object} Form data result
 */
function getFormSubmissionData(formHub, transaction, responseId) {
  try {
    const hub = SpreadsheetApp.openById(formHub.hubId);
    const sheet = hub.getSheetByName(formHub.sheetName);
    
    if (!sheet) {
      return { found: false, error: `Sheet ${formHub.sheetName} not found` };
    }
    
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    // First try to find by transaction ID (if it was written back to form)
    const transactionIdCol = formHub.mappings.TransactionID;
    if (transactionIdCol !== undefined) {
      for (let i = 1; i < values.length; i++) {
        if (values[i][transactionIdCol] === transaction.transactionId) {
          return {
            found: true,
            row: values[i],
            rowIndex: i
          };
        }
      }
    }
    
    // Fallback: find by email and timestamp
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (row[formHub.mappings.EmailAddress] === transaction.requestor) {
        const formTimestamp = new Date(row[formHub.mappings.Timestamp]);
        const transactionTime = new Date(transaction.processedOn);
        const timeDiff = Math.abs(formTimestamp - transactionTime);
        
        // Within 24 hours
        if (timeDiff < 24 * 60 * 60 * 1000) {
          return {
            found: true,
            row: row,
            rowIndex: i
          };
        }
      }
    }
    
    return { found: false, error: 'No matching form submission found' };
    
  } catch (error) {
    console.error('Failed to get form submission data:', error);
    return { found: false, error: error.message };
  }
}

/**
 * Parse Amazon form items from row data
 * @param {Array} row - Form submission row
 * @param {Object} columnMap - Column mapping
 * @return {Object} Parsed items result
 */
function parseAmazonFormItems(row, columnMap) {
  const lineItems = [];
  const formDetails = {
    timestamp: row[columnMap.Timestamp],
    emailAddress: row[columnMap.EmailAddress],
    totalCost: parseFloat(String(row[columnMap.TotalCost] || '0').replace(/[$,]/g, '')) || 0
  };
  
  // Parse up to 5 items
  for (let i = 1; i <= 5; i++) {
    const descCol = columnMap[`Item${i}Description`];
    const urlCol = columnMap[`Item${i}AmazonURL`];
    const qtyCol = columnMap[`Item${i}Quantity`];
    const priceCol = columnMap[`Item${i}UnitPrice`];
    const totalCol = columnMap[`Item${i}TotalPrice`];
    
    const description = row[descCol];
    const url = row[urlCol];
    const quantity = parseInt(row[qtyCol]) || 0;
    const unitPrice = parseFloat(String(row[priceCol] || '0').replace(/[$,]/g, '')) || 0;
    const totalPrice = parseFloat(String(row[totalCol] || '0').replace(/[$,]/g, '')) || 0;
    
    if (description && quantity > 0) {
      lineItems.push({
        itemNumber: i,
        itemId: extractASINFromURL(url) || `AMZ-${i}`,
        description: description,
        url: url,
        quantity: quantity,
        unitPrice: unitPrice || (totalPrice / quantity),
        totalPrice: totalPrice || (unitPrice * quantity),
        itemType: 'Amazon'
      });
    }
  }
  
  return {
    lineItems: lineItems,
    formDetails: formDetails,
    additionalInfo: {
      itemCount: lineItems.length,
      formType: 'Amazon'
    }
  };
}

/**
 * Parse Warehouse form items from row data
 * @param {Array} row - Form submission row
 * @param {Object} columnMap - Column mapping
 * @return {Object} Parsed items result
 */
function parseWarehouseFormItems(row, columnMap) {
  const lineItems = [];
  const formDetails = {
    timestamp: row[columnMap.Timestamp],
    emailAddress: row[columnMap.EmailAddress],
    totalCost: parseFloat(String(row[columnMap.TotalCost] || '0').replace(/[$,]/g, '')) || 0
  };
  
  // Parse up to 5 items (warehouse has split columns)
  for (let i = 1; i <= 5; i++) {
    const idCol = columnMap[`Item${i}ItemID`];
    const qtyCol = columnMap[`Item${i}Quantity`];
    const descCol = columnMap[`Item${i}Description`];
    const priceCol = columnMap[`Item${i}Price`];
    
    const itemId = row[idCol];
    const quantity = parseInt(row[qtyCol]) || 0;
    const description = row[descCol];
    const totalPrice = parseFloat(String(row[priceCol] || '0').replace(/[$,]/g, '')) || 0;
    
    if (itemId && quantity > 0 && description) {
      lineItems.push({
        itemNumber: i,
        itemId: itemId,
        description: description,
        quantity: quantity,
        unitPrice: totalPrice / quantity,
        totalPrice: totalPrice,
        itemType: 'Warehouse',
        warehouseInfo: {
          stockNumber: itemId
        }
      });
    }
  }
  
  return {
    lineItems: lineItems,
    formDetails: formDetails,
    additionalInfo: {
      itemCount: lineItems.length,
      formType: 'Warehouse'
    }
  };
}

/**
 * Parse single-item forms (Admin, Field Trip, Curriculum)
 * @param {Array} row - Form submission row
 * @param {Object} columnMap - Column mapping
 * @param {string} formType - Form type
 * @return {Object} Parsed items result
 */
function parseSingleItemForm(row, columnMap, formType) {
  const formDetails = {
    timestamp: row[columnMap.Timestamp],
    emailAddress: row[columnMap.EmailAddress]
  };
  
  let lineItems = [];
  let additionalInfo = { formType: formType };
  
  const upperFormType = formType.toUpperCase();
  
  if (upperFormType === 'ADMIN') {
    const totalCost = parseFloat(String(row[columnMap.TotalCost] || '0').replace(/[$,]/g, '')) || 0;
    
    lineItems.push({
      itemNumber: 1,
      itemId: 'ADMIN-PURCHASE',
      description: row[columnMap.PurchaseDescription] || 'Administrative Purchase',
      quantity: 1,
      unitPrice: totalCost,
      totalPrice: totalCost,
      itemType: 'Admin'
    });
    
    formDetails.totalCost = totalCost;
    formDetails.rationale = row[columnMap.Rationale];
    formDetails.uploadedInvoice = row[columnMap.UploadInvoice];
    
  } else if (upperFormType === 'FIELD TRIP' || upperFormType === 'FIELD_TRIP') {
    const totalCost = parseFloat(String(row[columnMap.TotalCost] || '0').replace(/[$,]/g, '')) || 0;
    
    lineItems.push({
      itemNumber: 1,
      itemId: 'FIELDTRIP',
      description: `Field Trip: ${row[columnMap.TripDestination] || 'Unknown Destination'}`,
      quantity: parseInt(row[columnMap.NumberOfStudents]) || 1,
      unitPrice: totalCost / (parseInt(row[columnMap.NumberOfStudents]) || 1),
      totalPrice: totalCost,
      itemType: 'Field Trip'
    });
    
    formDetails.totalCost = totalCost;
    additionalInfo.destination = row[columnMap.TripDestination];
    additionalInfo.tripDate = row[columnMap.TripDate];
    additionalInfo.studentCount = row[columnMap.NumberOfStudents];
    additionalInfo.transportationType = row[columnMap.TransportationType];
    
  } else if (upperFormType === 'CURRICULUM') {
    const totalCost = parseFloat(String(row[columnMap.TotalCost] || '0').replace(/[$,]/g, '')) || 0;
    const quantity = parseInt(row[columnMap.QuantityNeeded]) || 1;
    
    lineItems.push({
      itemNumber: 1,
      itemId: row[columnMap.ISBN] || 'CURRICULUM',
      description: `Curriculum: ${row[columnMap.ResourceName] || 'Educational Resource'}`,
      quantity: quantity,
      unitPrice: totalCost / quantity,
      totalPrice: totalCost,
      itemType: 'Curriculum'
    });
    
    formDetails.totalCost = totalCost;
    additionalInfo.curriculumType = row[columnMap.CurriculumType];
    additionalInfo.resourceName = row[columnMap.ResourceName];
    additionalInfo.resourceURL = row[columnMap.ResourceURL];
    additionalInfo.isbn = row[columnMap.ISBN];
  }
  
  return {
    lineItems: lineItems,
    formDetails: formDetails,
    additionalInfo: additionalInfo
  };
}

// ============================================================================
// PHASE 4: TRANSACTION ROUTING AND INTELLIGENT BATCHING
// ============================================================================

/**
 * Route transactions by type for appropriate processing
 * @param {Array} transactions - Enriched transactions
 * @return {Object} Routing results
 */
function routeTransactionsByType(transactions) {
  const results = {
    batchable: [],
    single: [],
    external: [],
    errors: [],
    typeStats: {}
  };
  
  try {
    transactions.forEach(transaction => {
      // Ensure formType exists
      if (!transaction.formType) {
        results.errors.push({
          transactionId: transaction.transactionId,
          error: 'Missing formType'
        });
        return;
      }
      
      // Track stats
      results.typeStats[transaction.formType] = (results.typeStats[transaction.formType] || 0) + 1;
      
      // Route based on form type and rules
      const formType = transaction.formType.toUpperCase();
      
      if (formType === 'AMAZON' || formType === 'WAREHOUSE') {
        // These can be batched by order ID
        results.batchable.push(transaction);
      } else if (formType === 'ADMIN' || formType === 'FIELD TRIP' || formType === 'FIELD_TRIP' || formType === 'CURRICULUM') {
        // These are always processed individually
        results.single.push(transaction);
      } else {
        // Unknown types go to single processing
        results.single.push(transaction);
      }
    });
    
    console.log(`🚦 Routing complete - Batch: ${results.batchable.length}, Single: ${results.single.length}`);
    return results;
    
  } catch (error) {
    console.error('Transaction routing failed:', error);
    // Fallback: route everything to single processing
    return {
      batchable: [],
      single: transactions,
      external: [],
      errors: [{ error: error.message }],
      typeStats: {}
    };
  }
}

/**
 * Group transactions by batching rules
 * @param {Array} transactions - Transactions to group
 * @return {Object} Grouped transactions
 */
function groupTransactionsByBatchingRules(transactions) {
  const groups = {};
  
  transactions.forEach(transaction => {
    const division = getDivisionFromTransaction(transaction);
    const formType = transaction.formType || 'Unknown';
    const orderId = transaction.orderId || 'NO_ORDER';
    
    // Group key: OrderID_Division_FormType
    const groupKey = `${orderId}_${division}_${formType}`;
    
    if (!groups[groupKey]) {
      groups[groupKey] = {
        orderId: orderId,
        division: division,
        formType: formType,
        transactions: [],
        canBatch: ['Amazon', 'AMAZON', 'Warehouse', 'WAREHOUSE'].includes(formType),
        totalAmount: 0,
        lineItems: []
      };
    }
    
    groups[groupKey].transactions.push(transaction);
    groups[groupKey].totalAmount += transaction.amount || 0;
    
    if (transaction.lineItems) {
      groups[groupKey].lineItems.push(...transaction.lineItems);
    }
  });
  
  return groups;
}

/**
 * Process batch transactions with intelligent batching
 * @param {Array} transactions - Batchable transactions
 * @return {Object} Processing results
 */
function processBatchTransactions(transactions) {
  const results = {
    successful: 0,
    failed: 0,
    batches: [],
    errors: []
  };
  
  try {
    // Group transactions
    const grouped = groupTransactionsByBatchingRules(transactions);
    
    // Process each group
    Object.entries(grouped).forEach(([groupKey, group]) => {
      if (group.canBatch && group.transactions.length > 1) {
        // Process as batch
        const batchResult = processBatchGroup({
          type: 'batch',
          transactions: group.transactions,
          lineItems: group.lineItems,
          totalAmount: group.totalAmount,
          formType: group.formType,
          division: group.division,
          transactionCount: group.transactions.length,
          itemCount: group.lineItems.length
        });
        
        if (batchResult.success) {
          results.successful += group.transactions.length;
          results.batches.push(batchResult);
        } else {
          results.failed += group.transactions.length;
          results.errors.push(batchResult.error);
        }
      } else {
        // Process individually
        group.transactions.forEach(transaction => {
          const singleResult = processSingleGroup({
            type: 'single',
            transactions: [transaction],
            lineItems: transaction.lineItems || [],
            totalAmount: transaction.amount || 0,
            formType: group.formType,
            division: group.division
          });
          
          if (singleResult.success) {
            results.successful++;
          } else {
            results.failed++;
            results.errors.push(singleResult.error);
          }
        });
      }
    });
    
    return results;
    
  } catch (error) {
    console.error('Batch processing failed:', error);
    results.errors.push(error.message);
    return results;
  }
}

// ============================================================================
// PHASE 5: PDF GENERATION AND INVOICE PROCESSING
// ============================================================================

/**
 * Process a single transaction group
 * @param {Object} singleGroup - Single transaction group
 * @return {Object} Processing result
 */
function processSingleGroup(singleGroup) {
  console.log(`📄 Processing single transaction: ${singleGroup.transactions[0]?.transactionId}`);
  
  try {
    // Validate input
    if (!singleGroup.transactions || singleGroup.transactions.length === 0) {
      throw new Error('No transactions in single group');
    }
    
    if (!singleGroup.formType) {
      throw new Error('Missing formType in single group');
    }
    
    const transaction = singleGroup.transactions[0];
    
    // Generate invoice ID
    const invoiceId = generateInvoiceId(transaction, false);
    
    // Prepare template data
    const templateData = prepareTemplateData(singleGroup, 'single_internal_template', invoiceId);
    
    // Generate PDF
    const pdfResult = generatePDFFromTemplate(templateData, 'single_internal_template');
    
    if (pdfResult.success) {
      // Update ledger
      updateTransactionLedgerWithInvoice(
        transaction.transactionId, 
        invoiceId, 
        pdfResult.driveUrl || ''
      );
      
      return {
        success: true,
        type: 'single',
        invoiceId: invoiceId,
        transactionId: transaction.transactionId,
        totalAmount: singleGroup.totalAmount || 0,
        driveUrl: pdfResult.driveUrl || '',
        pdfSize: pdfResult.pdfSize || 0
      };
    } else {
      throw new Error(`PDF generation failed: ${pdfResult.error}`);
    }
    
  } catch (error) {
    console.error(`❌ Single processing failed: ${error.message}`);
    return {
      success: false,
      type: 'single',
      error: error.message,
      transactionId: singleGroup.transactions[0]?.transactionId || 'unknown'
    };
  }
}

/**
 * Process a batch transaction group
 * @param {Object} batchGroup - Batch transaction group
 * @return {Object} Processing result
 */
function processBatchGroup(batchGroup) {
  console.log(`📦 Processing batch: ${batchGroup.transactions?.length || 0} transactions`);
  
  try {
    // Validate input
    if (!batchGroup.transactions || batchGroup.transactions.length === 0) {
      throw new Error('No transactions in batch group');
    }
    
    if (!batchGroup.formType) {
      throw new Error('Missing formType in batch group');
    }
    
    const primaryTransaction = batchGroup.transactions[0];
    
    // Generate invoice ID
    const invoiceId = generateInvoiceId(primaryTransaction, false);
    
    // Prepare template data
    const templateData = prepareTemplateData(batchGroup, 'batch_internal_template', invoiceId);
    
    // Generate PDF
    const pdfResult = generatePDFFromTemplate(templateData, 'batch_internal_template');
    
    if (pdfResult.success) {
      // Update all transactions in batch
      batchGroup.transactions.forEach(transaction => {
        updateTransactionLedgerWithInvoice(
          transaction.transactionId,
          invoiceId,
          pdfResult.driveUrl || ''
        );
      });
      
      return {
        success: true,
        type: 'batch',
        invoiceId: invoiceId,
        transactionCount: batchGroup.transactions.length,
        totalAmount: batchGroup.totalAmount || 0,
        driveUrl: pdfResult.driveUrl || '',
        pdfSize: pdfResult.pdfSize || 0
      };
    } else {
      throw new Error(`PDF generation failed: ${pdfResult.error}`);
    }
    
  } catch (error) {
    console.error(`❌ Batch processing failed: ${error.message}`);
    return {
      success: false,
      type: 'batch',
      error: error.message,
      transactionCount: batchGroup.transactions?.length || 0
    };
  }
}

/**
 * Prepare template data with all required fields
 * @param {Object} group - Transaction group
 * @param {string} template - Template name
 * @param {string} invoiceId - Invoice ID
 * @return {Object} Template data
 */
function prepareTemplateData(group, template, invoiceId) {
  // Extract data safely
  const formType = group.formType || 'Unknown';
  const division = group.division || getDivisionFromTransaction(group.transactions[0]) || 'Unknown';
  const primaryTransaction = group.transactions[0] || {};
  
  // Get division budget info
  const divisionBudget = getDivisionBudgetInfo(division);
  
  // Get signature info
  const signatureInfo = CONFIG.DIVISION_SIGNATURES[division] || CONFIG.DIVISION_SIGNATURES['Administration'];
  
  // Build template data
  const templateData = {
    // Invoice metadata
    invoiceId: invoiceId,
    invoiceNumber: invoiceId,
    invoiceDate: new Date().toLocaleDateString(),
    
    // Type information
    formType: formType,
    typeLabel: formType,
    division: division,
    divisionName: division,
    divisionCode: getDivisionCode(division),
    isAdmin: formType === 'Admin' || formType === 'ADMIN',
    isBatch: group.type === 'batch',
    
    // Financial data
    totalAmount: group.totalAmount || 0,
    amount: group.totalAmount || 0,
    
    // Order information
    orderId: primaryTransaction.orderId || group.orderId || '',
    orderTotal: group.totalAmount || 0,
    
    // Transaction details
    transactions: group.transactions || [],
    lineItems: group.lineItems || [],
    transactionCount: group.transactions?.length || 1,
    itemCount: group.lineItems?.length || 0,
    
    // User information
    requestor: primaryTransaction.requestor || '',
    requestorName: primaryTransaction.requestorName || getUserFullName(primaryTransaction.requestor || ''),
    approver: primaryTransaction.approver || '',
    approverName: primaryTransaction.approverName || getUserFullName(primaryTransaction.approver || ''),
    
    // Department information
    department: primaryTransaction.department || '',
    
    // Additional fields
    description: primaryTransaction.description || 'Purchase',
    transactionId: primaryTransaction.transactionId || '',
    
    // Budget info
    divisionBudget: divisionBudget.allocated || 0,
    divisionUtilization: divisionBudget.utilization || 0,
    divisionSpent: divisionBudget.spent || 0,
    divisionRemaining: divisionBudget.remaining || 0,
    
    // Signature information
    signatureName: signatureInfo.name,
    signatureTitle: signatureInfo.title,
    approverName: signatureInfo.name,
    approverTitle: signatureInfo.title,
    
    // School branding
    logoBase64: getSchoolLogoBase64(),
    sealBase64: getSchoolSealBase64(),
    signatureBase64: getDivisionSignatureBase64(division),
    
    // Batch information (if applicable)
    batchNumber: 1,
    totalBatches: 1
  };
  
  // Add line item details with proper formatting
  if (templateData.lineItems && templateData.lineItems.length > 0) {
    templateData.lineItems = templateData.lineItems.map((item, index) => ({
      ...item,
      itemNumber: item.itemNumber || index + 1,
      description: item.description || 'Item',
      quantity: item.quantity || 1,
      unitPrice: item.unitPrice || 0,
      totalPrice: item.totalPrice || (item.quantity * item.unitPrice) || 0,
      // Format for display
      unitPriceFormatted: (item.unitPrice || 0).toFixed(2),
      totalPriceFormatted: (item.totalPrice || 0).toFixed(2)
    }));
  }
  
  // Add transaction details with proper formatting
  if (templateData.transactions && templateData.transactions.length > 0) {
    templateData.transactions = templateData.transactions.map(transaction => ({
      ...transaction,
      amountFormatted: (transaction.amount || 0).toFixed(2),
      combinedDescription: transaction.description || 
        (transaction.lineItems && transaction.lineItems.length > 0 ? 
          transaction.lineItems.map(item => `${item.quantity}x ${item.description}`).join(', ') : 
          'Purchase')
    }));
  }
  
  return templateData;
}

/**
 * Generate PDF from template
 * @param {Object} templateData - Data for template
 * @param {string} templateName - Template name
 * @return {Object} PDF generation result
 */
function generatePDFFromTemplate(templateData, templateName) {
  try {
    console.log(`📄 Generating PDF with template: ${templateName}`);
    
    // Load template
    const htmlTemplate = loadHTMLTemplate(templateName);
    
    // Process template with data
    const processedHTML = processHTMLTemplate(htmlTemplate, templateData);
    
    // Convert to PDF
    const blob = Utilities.newBlob(processedHTML, 'text/html', `${templateData.invoiceId}.html`)
      .getAs('application/pdf');
    
    // Save to Drive
    const driveUrl = savePDFToDrive(blob, templateData.invoiceId, templateData.division);
    
    return {
      success: true,
      blob: blob,
      pdfSize: blob.getBytes().length,
      driveUrl: driveUrl
    };
    
  } catch (error) {
    console.error(`PDF generation failed: ${error.message}`);
    
    // Try fallback template
    try {
      const fallbackHTML = getFallbackTemplate(templateName, templateData);
      const fallbackBlob = Utilities.newBlob(fallbackHTML, 'text/html', `${templateData.invoiceId}_fallback.html`)
        .getAs('application/pdf');
      
      const driveUrl = savePDFToDrive(fallbackBlob, templateData.invoiceId, templateData.division);
      
      return {
        success: true,
        blob: fallbackBlob,
        pdfSize: fallbackBlob.getBytes().length,
        driveUrl: driveUrl,
        warning: 'Used fallback template'
      };
      
    } catch (fallbackError) {
      return {
        success: false,
        error: error.message,
        fallbackError: fallbackError.message
      };
    }
  }
}

/**
 * Load HTML template from Apps Script project
 * @param {string} templateName - Template name
 * @return {string} HTML content
 */
function loadHTMLTemplate(templateName) {
  try {
    // In Apps Script, templates are stored as HTML files
    const template = HtmlService.createTemplateFromFile(templateName);
    return template.getRawContent();
  } catch (error) {
    console.warn(`Template ${templateName} not found, using fallback`);
    return getTemplateContent(templateName);
  }
}

/**
 * Process HTML template with data
 * @param {string} template - HTML template string or template name
 * @param {Object} data - Template data
 * @return {string} Processed HTML
 */
function processHTMLTemplate(template, data) {
  try {
    // If template is a template name (not raw HTML), use Apps Script template processing
    if (!template.includes('<html>') && !template.includes('<!DOCTYPE')) {
      return processTemplate(template, data);
    }
    
    // Create temporary template from string for Apps Script processing
    const tempTemplate = HtmlService.createTemplate(template);
    
    // Add data and helper functions to template
    tempTemplate.data = data;
    tempTemplate.formatCurrency = formatCurrency;
    tempTemplate.formatDate = formatDate;
    tempTemplate.include = include;
    
    // Evaluate and return HTML
    return tempTemplate.evaluate().getContent();
    
  } catch (error) {
    console.error('Template processing failed:', error);
    
    // Fallback: Use our custom template processing
    return processFallbackTemplate(template, data);
  }
}

/**
 * Get fallback template HTML
 * @param {string} templateName - Template name
 * @param {Object} data - Optional template data
 * @return {string} Fallback HTML
 */
function getFallbackTemplate(templateName, data = {}) {
  const isAdmin = data.isAdmin || false;
  const formType = data.formType || 'Unknown';
  const isBatch = templateName.includes('batch');
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        @page { size: 8.5in 11in; margin: 0.5in; }
        body { 
          font-family: 'Segoe UI', Arial, sans-serif; 
          margin: 0; 
          padding: 0; 
          font-size: 10pt; 
          line-height: 1.4;
          color: #333;
        }
        .header { 
          text-align: center; 
          margin-bottom: 30px; 
          border-bottom: 3px solid #1b5e3f; 
          padding-bottom: 20px; 
        }
        .logo { 
          max-height: 60px; 
          margin-bottom: 10px; 
        }
        h1 { 
          color: #1b5e3f; 
          margin: 10px 0; 
          font-size: 24pt; 
        }
        .invoice-info {
          display: flex;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        .info-section {
          flex: 1;
          padding: 0 10px;
        }
        .info-section h3 {
          color: #1b5e3f;
          border-bottom: 1px solid #1b5e3f;
          padding-bottom: 5px;
          margin-bottom: 10px;
        }
        .detail-row { 
          display: flex; 
          justify-content: space-between; 
          margin-bottom: 5px; 
          padding: 3px 0;
        }
        .label { 
          font-weight: bold; 
          color: #555; 
        }
        .items-section {
          margin: 20px 0;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 15px 0;
        }
        th, td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
        }
        th {
          background-color: #1b5e3f;
          color: white;
          font-weight: bold;
        }
        tr:nth-child(even) {
          background-color: #f9f9f9;
        }
        .total-section { 
          margin-top: 30px;
          text-align: right;
        }
        .total-box {
          display: inline-block;
          background: #e8f5e9;
          padding: 15px 30px;
          border-radius: 5px;
          border: 2px solid #1b5e3f;
        }
        .total-amount {
          font-size: 18pt; 
          font-weight: bold; 
          color: #1b5e3f; 
        }
        .signature-section { 
          margin-top: 50px; 
          text-align: right; 
        }
        .signature-line {
          display: inline-block;
          width: 250px;
          border-bottom: 1px solid #333;
          margin-bottom: 5px;
        }
        .admin-invoice {
          border: 3px solid #ff5722;
        }
        .batch-info {
          background: #f0f4ff;
          padding: 10px;
          border-radius: 5px;
          margin-bottom: 20px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        ${data.logoBase64 ? `<img src="data:image/png;base64,${data.logoBase64}" class="logo" alt="Keswick Christian School">` : ''}
        <h1>KESWICK CHRISTIAN SCHOOL</h1>
        <h2>${isAdmin ? 'ADMINISTRATIVE' : 'INTERNAL'} INVOICE</h2>
        <p>Invoice ID: ${data.invoiceId || 'INV-0000'} | Date: ${data.invoiceDate || new Date().toLocaleDateString()}</p>
      </div>
      
      ${isBatch ? `
        <div class="batch-info">
          <strong>Batch Invoice</strong> - 
          Order ID: ${data.orderId || 'N/A'} | 
          Transactions: ${data.transactionCount || 0} | 
          Total Items: ${data.itemCount || 0}
        </div>
      ` : ''}
      
      <div class="invoice-info">
        <div class="info-section">
          <h3>Invoice Details</h3>
          <div class="detail-row">
            <span class="label">Form Type:</span>
            <span>${formType}</span>
          </div>
          <div class="detail-row">
            <span class="label">Division:</span>
            <span>${data.division || 'Unknown'}</span>
          </div>
          <div class="detail-row">
            <span class="label">Department:</span>
            <span>${data.department || 'N/A'}</span>
          </div>
        </div>
        
        <div class="info-section">
          <h3>Personnel</h3>
          <div class="detail-row">
            <span class="label">Requestor:</span>
            <span>${data.requestorName || data.requestor || 'Unknown'}</span>
          </div>
          <div class="detail-row">
            <span class="label">Approver:</span>
            <span>${data.approverName || data.approver || 'Unknown'}</span>
          </div>
        </div>
        
        <div class="info-section">
          <h3>Budget Information</h3>
          <div class="detail-row">
            <span class="label">Allocated:</span>
            <span>$${(data.divisionBudget || 0).toFixed(2)}</span>
          </div>
          <div class="detail-row">
            <span class="label">Utilization:</span>
            <span>${(data.divisionUtilization || 0).toFixed(1)}%</span>
          </div>
        </div>
      </div>
      
      <div class="items-section">
        <h3>Line Items</h3>
        ${data.lineItems && data.lineItems.length > 0 ? `
          <table>
            <thead>
              <tr>
                <th style="width: 10%">#</th>
                <th style="width: 50%">Description</th>
                <th style="width: 10%">Qty</th>
                <th style="width: 15%">Unit Price</th>
                <th style="width: 15%">Total</th>
              </tr>
            </thead>
            <tbody>
              ${data.lineItems.map((item, index) => `
                <tr>
                  <td>${item.itemNumber || index + 1}</td>
                  <td>${item.description || 'Item'}</td>
                  <td style="text-align: center">${item.quantity || 1}</td>
                  <td style="text-align: right">$${(item.unitPrice || 0).toFixed(2)}</td>
                  <td style="text-align: right">$${(item.totalPrice || 0).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : '<p>No line items available</p>'}
      </div>
      
      ${isBatch && data.transactions && data.transactions.length > 0 ? `
        <div class="items-section">
          <h3>Transactions in Batch</h3>
          <table>
            <thead>
              <tr>
                <th>Transaction ID</th>
                <th>Description</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              ${data.transactions.map(txn => `
                <tr>
                  <td>${txn.transactionId || 'N/A'}</td>
                  <td>${txn.description || 'Purchase'}</td>
                  <td style="text-align: right">$${(txn.amount || 0).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}
      
      <div class="total-section">
        <div class="total-box">
          <div>Invoice Total</div>
          <div class="total-amount">$${(data.totalAmount || 0).toFixed(2)}</div>
        </div>
      </div>
      
      <div class="signature-section">
        <p>Processed Date: ${new Date().toLocaleDateString()}</p>
        <div class="signature-line"></div>
        <p>${data.signatureName || 'Authorized Signature'}</p>
        <p>${data.signatureTitle || 'Finance Director'}</p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Save PDF to Drive with proper folder structure
 * @param {Blob} pdfBlob - PDF blob
 * @param {string} invoiceId - Invoice ID
 * @param {string} division - Division name
 * @return {string} Drive URL
 */
function savePDFToDrive(pdfBlob, invoiceId, division) {
  try {
    // For testing, return a placeholder URL if no root folder configured
    if (!CONFIG.INVOICE_ROOT_FOLDER_ID || CONFIG.INVOICE_ROOT_FOLDER_ID === 'REPLACE_WITH_INVOICE_FOLDER_ID') {
      console.log('📁 Drive save skipped - no folder configured');
      return 'Not saved to Drive in test mode';
    }
    
    const rootFolder = DriveApp.getFolderById(CONFIG.INVOICE_ROOT_FOLDER_ID);
    
    // Create year/month/division folder structure
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const monthName = now.toLocaleDateString('en-US', { month: 'long' });
    
    // Year folder
    let yearFolder;
    const yearFolders = rootFolder.getFoldersByName(year.toString());
    if (yearFolders.hasNext()) {
      yearFolder = yearFolders.next();
    } else {
      yearFolder = rootFolder.createFolder(year.toString());
    }
    
    // Month folder
    const monthFolderName = `${month} - ${monthName}`;
    let monthFolder;
    const monthFolders = yearFolder.getFoldersByName(monthFolderName);
    if (monthFolders.hasNext()) {
      monthFolder = monthFolders.next();
    } else {
      monthFolder = yearFolder.createFolder(monthFolderName);
    }
    
    // Division folder
    let divisionFolder;
    const divisionFolders = monthFolder.getFoldersByName(division);
    if (divisionFolders.hasNext()) {
      divisionFolder = divisionFolders.next();
    } else {
      divisionFolder = monthFolder.createFolder(division);
    }
    
    // Save file
    const file = divisionFolder.createFile(pdfBlob);
    file.setName(`${invoiceId}.pdf`);
    
    // Try to set permissions (view only for organization) - handle permission errors gracefully
    try {
      file.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (permissionError) {
      console.warn('Could not set file permissions, using default:', permissionError.message);
      // Continue without setting permissions - file will use default permissions
    }
    
    console.log(`✅ Saved invoice ${invoiceId} to Drive`);
    return file.getUrl();
    
  } catch (error) {
    console.error('Failed to save PDF to Drive:', error);
    return '';
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get division from transaction
 * @param {Object} transaction - Transaction object
 * @return {string} Division name
 */
function getDivisionFromTransaction(transaction) {
  if (!transaction) return 'Administration';
  
  // Check explicit division field first
  if (transaction.division) return transaction.division;
  
  // Check organization field
  const org = (transaction.organization || '').toLowerCase();
  
  if (org.includes('upper') || org.includes('us')) return 'Upper School';
  if (org.includes('lower') || org.includes('ls')) return 'Lower School';
  if (org.includes('keswick kids') || org.includes('kk')) return 'Keswick Kids';
  
  // Check department as fallback
  const dept = (transaction.department || '').toLowerCase();
  
  if (dept.includes('upper')) return 'Upper School';
  if (dept.includes('lower')) return 'Lower School';
  if (dept.includes('kids')) return 'Keswick Kids';
  
  return 'Administration';
}

/**
 * Get division code
 * @param {string} divisionName - Division name
 * @return {string} Division code
 */
function getDivisionCode(divisionName) {
  const codes = {
    'Upper School': 'US',
    'Lower School': 'LS',
    'Keswick Kids': 'KK',
    'Administration': 'AD',
    'Admin': 'AD'
  };
  return codes[divisionName] || 'AD';
}

/**
 * Get user full name from email
 * @param {string} email - User email
 * @return {string} Full name
 */
function getUserFullName(email) {
  if (!email) return 'Unknown User';
  
  try {
    // Try to get from UserDirectory
    const userInfo = getUserInfoFromDirectory(email);
    if (userInfo && userInfo.firstName && userInfo.lastName) {
      return `${userInfo.firstName} ${userInfo.lastName}`;
    }
  } catch (error) {
    console.warn(`Could not get user info for ${email}:`, error);
  }
  
  // Fallback: Extract from email
  const username = email.split('@')[0];
  
  // Handle common patterns
  if (username.includes('.')) {
    const parts = username.split('.');
    return parts.map(part => 
      part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
    ).join(' ');
  }
  
  return username.charAt(0).toUpperCase() + username.slice(1).toLowerCase();
}

/**
 * Get user info from directory
 * @param {string} email - User email
 * @return {Object|null} User info
 */
function getUserInfoFromDirectory(email) {
  try {
    const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
    const directorySheet = budgetHub.getSheetByName('UserDirectory');
    
    const mappings = loadHubHeaderMappings();
    const cols = mappings.budget.UserDirectory;
    
    const dataRange = directorySheet.getDataRange();
    const values = dataRange.getValues();
    
    for (let i = 1; i < values.length; i++) {
      if (values[i][cols.Email] === email) {
        return {
          email: email,
          firstName: values[i][cols.FirstName],
          lastName: values[i][cols.LastName],
          role: values[i][cols.Role],
          department: values[i][cols.Department],
          division: values[i][cols.Division],
          approver: values[i][cols.Approver],
          budgetAllocated: values[i][cols.BudgetAllocated],
          budgetSpent: values[i][cols.BudgetSpent],
          budgetEncumbered: values[i][cols.BudgetEncumbered],
          budgetRemaining: values[i][cols.BudgetRemaining]
        };
      }
    }
    
    return null;
    
  } catch (error) {
    console.error('Error getting user info:', error);
    return null;
  }
}

/**
 * Get department from email
 * @param {string} email - User email
 * @return {string} Department name
 */
function getDepartmentFromEmail(email) {
  const userInfo = getUserInfoFromDirectory(email);
  return userInfo?.department || 'Unknown';
}

/**
 * Get division budget info
 * @param {string} division - Division name
 * @return {Object} Budget info
 */
function getDivisionBudgetInfo(division) {
  try {
    const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
    const orgBudgetSheet = budgetHub.getSheetByName('OrganizationBudgets');
    
    if (!orgBudgetSheet) {
      return {
        allocated: 0,
        spent: 0,
        encumbered: 0,
        remaining: 0,
        utilization: 0
      };
    }
    
    const dataRange = orgBudgetSheet.getDataRange();
    const values = dataRange.getValues();
    
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === division) {
        const allocated = parseFloat(values[i][1]) || 0;
        const spent = parseFloat(values[i][2]) || 0;
        const encumbered = parseFloat(values[i][3]) || 0;
        const available = parseFloat(values[i][4]) || 0;
        
        return {
          allocated: allocated,
          spent: spent,
          encumbered: encumbered,
          remaining: available,
          utilization: allocated > 0 ? (spent / allocated * 100) : 0
        };
      }
    }
    
    // Default values if not found
    return {
      allocated: 100000,
      spent: 0,
      encumbered: 0,
      remaining: 100000,
      utilization: 0
    };
    
  } catch (error) {
    console.error('Error getting division budget:', error);
    return {
      allocated: 100000,
      spent: 0,
      encumbered: 0,
      remaining: 100000,
      utilization: 0
    };
  }
}

/**
 * Get school wide logo (header) as base64
 * @return {string} Base64 encoded logo
 */
function getSchoolLogoBase64() {
  try {
    if (!CONFIG.SCHOOL_LOGO_FILE_ID || CONFIG.SCHOOL_LOGO_FILE_ID.includes('REPLACE')) {
      return '';
    }

    const logoFile = DriveApp.getFileById(CONFIG.SCHOOL_LOGO_FILE_ID);
    const logoBlob = logoFile.getBlob();
    return Utilities.base64Encode(logoBlob.getBytes());

  } catch (error) {
    console.warn('Could not load school logo:', error);
    return '';
  }
}

/**
 * Get school seal (watermark) as base64
 * @return {string} Base64 encoded seal
 */
function getSchoolSealBase64() {
  try {
    if (!CONFIG.SCHOOL_SEAL_FILE_ID || CONFIG.SCHOOL_SEAL_FILE_ID.includes('REPLACE')) {
      return '';
    }

    const sealFile = DriveApp.getFileById(CONFIG.SCHOOL_SEAL_FILE_ID);
    const sealBlob = sealFile.getBlob();
    return Utilities.base64Encode(sealBlob.getBytes());

  } catch (error) {
    console.warn('Could not load school seal:', error);
    return '';
  }
}

/**
 * Get division signature as base64
 * @param {string} division - Division name
 * @return {string} Base64 encoded signature
 */
function getDivisionSignatureBase64(division) {
  try {
    const signatureInfo = CONFIG.DIVISION_SIGNATURES[division];
    if (!signatureInfo || !signatureInfo.signatureFileId || signatureInfo.signatureFileId.includes('REPLACE')) {
      return '';
    }
    
    const signatureFile = DriveApp.getFileById(signatureInfo.signatureFileId);
    const signatureBlob = signatureFile.getBlob();
    return Utilities.base64Encode(signatureBlob.getBytes());
    
  } catch (error) {
    console.warn('Could not load division signature:', error);
    return '';
  }
}

/**
 * Extract ASIN from Amazon URL
 * @param {string} url - Amazon URL
 * @return {string|null} ASIN or null
 */
function extractASINFromURL(url) {
  if (!url || typeof url !== 'string') return null;
  
  const patterns = [
    /\/dp\/([A-Z0-9]{10})/i,
    /\/gp\/product\/([A-Z0-9]{10})/i,
    /\/product\/([A-Z0-9]{10})/i,
    /[?&]asin=([A-Z0-9]{10})/i
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Log error with context
 * @param {string} message - Error message
 * @param {Error} error - Error object
 * @param {Object} context - Additional context
 */
function logError(message, error, context = {}) {
  console.error(`❌ ${message}:`, error.message);
  if (error.stack) {
    console.error('Stack:', error.stack);
  }
  if (Object.keys(context).length > 0) {
    console.error('Context:', JSON.stringify(context, null, 2));
  }
  
  // Log to SystemLog if possible
  try {
    const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
    const systemLog = budgetHub.getSheetByName('SystemLog');
    
    if (systemLog) {
      systemLog.appendRow([
        new Date(),
        'ERROR',
        Session.getActiveUser().getEmail(),
        0,
        `${message}: ${error.message}`,
        JSON.stringify(context),
        error.stack || '',
        'ERROR'
      ]);
    }
  } catch (logError) {
    // Ignore logging errors
  }
}

/**
 * Format currency for display
 * @param {number} amount - Amount to format
 * @return {string} Formatted currency
 */
function formatCurrency(amount) {
  if (typeof amount !== 'number') {
    amount = parseFloat(amount) || 0;
  }
  return '$' + amount.toFixed(2);
}

/**
 * Format date for display
 * @param {Date|string} date - Date to format
 * @return {string} Formatted date
 */
function formatDate(date) {
  if (!date) return '';
  
  if (typeof date === 'string') {
    date = new Date(date);
  }
  
  if (isNaN(date.getTime())) {
    return '';
  }
  
  return date.toLocaleDateString();
}

/**
 * Include helper for templates
 * @param {string} filename - File to include
 * @return {string} File content
 */
function include(filename) {
  try {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
  } catch (error) {
    console.warn(`Could not include file ${filename}:`, error);
    return '';
  }
}

/**
 * Process template with fallback method
 * @param {string} template - Template string
 * @param {Object} data - Template data
 * @return {string} Processed HTML
 */
function processFallbackTemplate(template, data) {
  try {
    // Simple token replacement for fallback
    let processed = template;
    
    // Replace common data tokens
    if (data) {
      Object.keys(data).forEach(key => {
        const value = data[key];
        const token = new RegExp(`\\$\\{data\\.${key}\\}`, 'g');
        const scriptToken = new RegExp(`<\\?= data\\.${key} \\?>`, 'g');
        
        if (typeof value === 'string' || typeof value === 'number') {
          processed = processed.replace(token, value);
          processed = processed.replace(scriptToken, value);
        }
      });
    }
    
    return processed;
    
  } catch (error) {
    console.error('Fallback template processing failed:', error);
    return template; // Return original if all else fails
  }
}

/**
 * Process template using Apps Script method
 * @param {string} templateName - Template name
 * @param {Object} data - Template data
 * @return {string} Processed HTML
 */
function processTemplate(templateName, data) {
  try {
    const template = HtmlService.createTemplateFromFile(templateName);
    
    // Add data and helper functions
    template.data = data;
    template.formatCurrency = formatCurrency;
    template.formatDate = formatDate;
    template.include = include;
    
    return template.evaluate().getContent();
    
  } catch (error) {
    console.error(`Template processing failed for ${templateName}:`, error);
    // Fall back to the fallback template
    return getFallbackTemplate(templateName, data);
  }
}

/**
 * Get template content
 * @param {string} templateName - Template name
 * @return {string} Template content
 */
function getTemplateContent(templateName) {
  try {
    return HtmlService.createHtmlOutputFromFile(templateName).getContent();
  } catch (error) {
    console.warn(`Could not load template ${templateName}, using fallback`);
    return getFallbackTemplate(templateName);
  }
}

// ============================================================================
// MAIN ORCHESTRATION
// ============================================================================

/**
 * Main function to generate invoices for unprocessed transactions
 * @return {Object} Processing results
 */
function generateInvoices() {
  const startTime = Date.now();
  const results = {
    startTime: new Date(),
    endTime: null,
    processed: 0,
    successful: 0,
    failed: 0,
    errors: [],
    warnings: [],
    invoices: []
  };
  
  try {
    console.log('🚀 Starting invoice generation...');
    console.log(`⏰ Start time: ${results.startTime.toLocaleString()}`);
    
    // Step 1: Get unprocessed transactions
    console.log('\n📊 Step 1: Retrieving unprocessed transactions...');
    const transactions = getUnprocessedTransactions();
    console.log(`✅ Found ${transactions.length} unprocessed transactions`);
    
    if (transactions.length === 0) {
      console.log('✅ No transactions to process');
      results.endTime = new Date();
      return results;
    }
    
    // Step 2: Enrich transactions with line items
    console.log('\n🔍 Step 2: Enriching transactions with line items...');
    const enrichedTransactions = [];
    
    for (const transaction of transactions) {
      try {
        const enriched = enrichTransactionData(transaction);
        enrichedTransactions.push(enriched);
        console.log(`✅ Enriched ${transaction.transactionId}: ${enriched.lineItems.length} items`);
      } catch (error) {
        console.error(`❌ Failed to enrich ${transaction.transactionId}:`, error);
        results.errors.push({
          transactionId: transaction.transactionId,
          error: error.message,
          phase: 'enrichment'
        });
      }
    }
    
    // Step 3: Route transactions for processing
    console.log('\n🚦 Step 3: Routing transactions...');
    const routingResults = routeTransactionsByType(enrichedTransactions);
    console.log(`✅ Routing complete:`);
    console.log(`   - Batchable: ${routingResults.batchable.length}`);
    console.log(`   - Single: ${routingResults.single.length}`);
    console.log(`   - Errors: ${routingResults.errors.length}`);
    
    // Step 4: Process batched transactions
    if (routingResults.batchable.length > 0) {
      console.log('\n📦 Step 4: Processing batched transactions...');
      const batchResults = processBatchTransactions(routingResults.batchable);
      results.successful += batchResults.successful;
      results.failed += batchResults.failed;
      results.errors.push(...batchResults.errors.map(e => ({ error: e, phase: 'batch' })));
      results.invoices.push(...batchResults.batches.filter(b => b.success));
      console.log(`✅ Batch processing complete: ${batchResults.successful} successful, ${batchResults.failed} failed`);
    }
    
    // Step 5: Process single transactions
    if (routingResults.single.length > 0) {
      console.log('\n📄 Step 5: Processing single transactions...');
      for (const transaction of routingResults.single) {
        try {
          const singleResult = processSingleGroup({
            type: 'single',
            transactions: [transaction],
            lineItems: transaction.lineItems || [],
            totalAmount: transaction.amount || 0,
            formType: transaction.formType,
            division: getDivisionFromTransaction(transaction)
          });
          
          if (singleResult.success) {
            results.successful++;
            results.invoices.push(singleResult);
            console.log(`✅ Processed ${transaction.transactionId}: ${singleResult.invoiceId}`);
          } else {
            results.failed++;
            results.errors.push({
              transactionId: transaction.transactionId,
              error: singleResult.error,
              phase: 'single'
            });
            console.error(`❌ Failed ${transaction.transactionId}: ${singleResult.error}`);
          }
          
          results.processed++;
          
        } catch (error) {
          results.failed++;
          results.errors.push({
            transactionId: transaction.transactionId,
            error: error.message,
            phase: 'single'
          });
          console.error(`❌ Exception processing ${transaction.transactionId}:`, error);
        }
      }
    }
    
    // Final summary
    results.endTime = new Date();
    const elapsedTime = Date.now() - startTime;
    
    console.log('\n✅ Invoice generation complete!');
    console.log(`⏱️ Total time: ${(elapsedTime / 1000).toFixed(1)} seconds`);
    console.log(`📊 Summary:`);
    console.log(`   - Processed: ${results.processed}`);
    console.log(`   - Successful: ${results.successful}`);
    console.log(`   - Failed: ${results.failed}`);
    console.log(`   - Invoices generated: ${results.invoices.length}`);
    
    // Send health check email if configured
    if (results.errors.length > 0 || results.warnings.length > 0) {
      sendHealthCheckEmail(results);
    }
    
    return results;
    
  } catch (error) {
    console.error('💥 Fatal error in invoice generation:', error);
    results.errors.push({
      error: `Fatal: ${error.message}`,
      phase: 'orchestration'
    });
    results.endTime = new Date();
    
    // Send critical error notification
    sendCriticalErrorNotification(error, results);
    
    return results;
  }
}

/**
 * Send health check email
 * @param {Object} results - Processing results
 */
function sendHealthCheckEmail(results) {
  try {
    if (!CONFIG.HEALTH_CHECK_EMAIL || CONFIG.HEALTH_CHECK_EMAIL.includes('REPLACE')) {
      return;
    }
    
    const subject = `Invoice Generation Report - ${results.startTime.toLocaleDateString()}`;
    
    const htmlBody = `
      <h2>Invoice Generation Report</h2>
      <p><strong>Processing Time:</strong> ${results.startTime.toLocaleString()} - ${results.endTime.toLocaleString()}</p>
      
      <h3>Summary</h3>
      <ul>
        <li>Total Processed: ${results.processed}</li>
        <li>Successful: ${results.successful}</li>
        <li>Failed: ${results.failed}</li>
        <li>Invoices Generated: ${results.invoices.length}</li>
      </ul>
      
      ${results.errors.length > 0 ? `
        <h3>Errors</h3>
        <ul>
          ${results.errors.map(e => `<li>${e.transactionId || 'N/A'}: ${e.error} (${e.phase})</li>`).join('')}
        </ul>
      ` : ''}
      
      ${results.warnings.length > 0 ? `
        <h3>Warnings</h3>
        <ul>
          ${results.warnings.map(w => `<li>${w}</li>`).join('')}
        </ul>
      ` : ''}
    `;
    
    MailApp.sendEmail({
      to: CONFIG.HEALTH_CHECK_EMAIL,
      subject: subject,
      htmlBody: htmlBody
    });
    
  } catch (error) {
    console.error('Failed to send health check email:', error);
  }
}

/**
 * Send critical error notification
 * @param {Error} error - Critical error
 * @param {Object} results - Processing results
 */
function sendCriticalErrorNotification(error, results) {
  try {
    if (!CONFIG.ERROR_NOTIFICATION_EMAIL || CONFIG.ERROR_NOTIFICATION_EMAIL.includes('REPLACE')) {
      return;
    }
    
    const subject = `🚨 CRITICAL: Invoice Generation Failed - ${new Date().toLocaleDateString()}`;
    
    const htmlBody = `
      <h2 style="color: red;">CRITICAL ERROR IN INVOICE GENERATION</h2>
      
      <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
      <p><strong>Error:</strong> ${error.message}</p>
      
      <h3>Processing Status at Failure</h3>
      <ul>
        <li>Processed: ${results.processed}</li>
        <li>Successful: ${results.successful}</li>
        <li>Failed: ${results.failed}</li>
      </ul>
      
      <h3>Stack Trace</h3>
      <pre>${error.stack || 'No stack trace available'}</pre>
      
      <p><strong>Action Required:</strong> Please check the system logs and manually process any pending invoices.</p>
    `;
    
    MailApp.sendEmail({
      to: CONFIG.ERROR_NOTIFICATION_EMAIL,
      subject: subject,
      htmlBody: htmlBody
    });
    
  } catch (emailError) {
    console.error('Failed to send critical error notification:', emailError);
  }
}

// ============================================================================
// TESTING AND DIAGNOSTICS
// ============================================================================

/**
 * Test the invoice generation system with sample data
 * @return {Object} Test results
 */
function testInvoiceGeneration() {
  console.log('🧪 Testing invoice generation system...\n');
  
  try {
    // Create test transaction
    const testTransaction = {
      transactionId: 'TEST-001',
      orderId: 'US-AMZ-0719-01',
      processedOn: new Date(),
      requestor: 'john.smith@keswick.edu',
      approver: 'jane.doe@keswick.edu',
      organization: 'Upper School Science Department',
      formType: 'Amazon',
      amount: 299.98,
      description: 'Lab supplies - microscope slides and covers',
      fiscalQuarter: 'Q3-2025'
    };
    
    console.log('📋 Test transaction:', JSON.stringify(testTransaction, null, 2));
    
    // Test enrichment
    console.log('\n🔍 Testing enrichment...');
    const enriched = enrichTransactionData(testTransaction);
    console.log(`✅ Enrichment successful: ${enriched.isEnriched}`);
    console.log(`   - Line items: ${enriched.lineItems.length}`);
    console.log(`   - Requestor name: ${enriched.requestorName}`);
    console.log(`   - Division: ${enriched.division}`);
    
    // Test routing
    console.log('\n🚦 Testing routing...');
    const routingResults = routeTransactionsByType([enriched]);
    console.log('✅ Routing results:', {
      batchable: routingResults.batchable.length,
      single: routingResults.single.length,
      typeStats: routingResults.typeStats
    });
    
    // Test single processing
    console.log('\n📄 Testing single processing...');
    const singleGroup = {
      type: 'single',
      transactions: [enriched],
      lineItems: enriched.lineItems || [],
      formType: enriched.formType,
      division: enriched.division,
      totalAmount: enriched.amount || 0
    };
    
    const result = processSingleGroup(singleGroup);
    
    if (result.success) {
      console.log('\n✅ SUCCESS! Invoice generation test completed:');
      console.log(`   - Invoice ID: ${result.invoiceId}`);
      console.log(`   - PDF Size: ${result.pdfSize} bytes`);
      console.log(`   - Amount: $${result.totalAmount}`);
      console.log(`   - Drive URL: ${result.driveUrl || 'Not saved to Drive in test mode'}`);
      
      return {
        success: true,
        message: 'All tests passed',
        invoiceId: result.invoiceId
      };
    } else {
      console.log('\n❌ Test failed:', result.error);
      return {
        success: false,
        error: result.error
      };
    }
    
  } catch (error) {
    console.error('\n💥 Test crashed:', error.message);
    console.error('Stack:', error.stack);
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}

/**
 * Test line item retrieval for a specific transaction
 * @param {string} transactionId - Transaction ID to test
 */
function testLineItemRetrieval(transactionId) {
  console.log(`🔍 Testing line item retrieval for ${transactionId}...\n`);
  
  try {
    // Get transaction from ledger
    const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
    const ledgerSheet = budgetHub.getSheetByName('TransactionLedger');
    
    const mappings = loadHubHeaderMappings();
    const cols = mappings.budget.TransactionLedger;
    
    const dataRange = ledgerSheet.getDataRange();
    const values = dataRange.getValues();
    
    let transaction = null;
    
    for (let i = 1; i < values.length; i++) {
      if (values[i][cols.TransactionID] === transactionId) {
        transaction = {
          transactionId: values[i][cols.TransactionID],
          orderId: values[i][cols.OrderID],
          processedOn: values[i][cols.ProcessedOn],
          requestor: values[i][cols.Requestor],
          approver: values[i][cols.Approver],
          organization: values[i][cols.Organization],
          formType: values[i][cols.Form],
          amount: parseFloat(values[i][cols.Amount]) || 0,
          description: values[i][cols.Description]
        };
        break;
      }
    }
    
    if (!transaction) {
      console.log(`❌ Transaction ${transactionId} not found in ledger`);
      return;
    }
    
    console.log('✅ Found transaction:', transaction);
    
    // Test line item retrieval
    const lineItemsResult = retrieveLineItemsFromForm(transaction);
    
    if (lineItemsResult.success) {
      console.log('\n✅ Line items retrieved successfully:');
      console.log(`   - Line items: ${lineItemsResult.lineItems.length}`);
      lineItemsResult.lineItems.forEach((item, index) => {
        console.log(`   - Item ${index + 1}: ${item.quantity}x ${item.description} @ $${item.unitPrice} = $${item.totalPrice}`);
      });
      
      if (lineItemsResult.formDetails) {
        console.log('\n📋 Form details:');
        console.log(JSON.stringify(lineItemsResult.formDetails, null, 2));
      }
    } else {
      console.log(`\n❌ Failed to retrieve line items: ${lineItemsResult.error}`);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// ============================================================================
// TRIGGER SETUP
// ============================================================================

/**
 * Setup overnight processing trigger
 */
function setupOvernightTrigger() {
  try {
    // Delete existing triggers for this function
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'generateInvoices') {
        ScriptApp.deleteTrigger(trigger);
      }
    });
    
    // Create new overnight trigger (3:00 AM)
    ScriptApp.newTrigger('generateInvoices')
      .timeBased()
      .everyDays(1)
      .atHour(3)
      .create();
      
    console.log('✅ Overnight processing trigger set for 3:00 AM daily');
    
  } catch (error) {
    console.error('Failed to setup overnight trigger:', error);
  }
}

/**
 * Setup manual trigger for testing
 */
function setupManualTrigger() {
  try {
    // Delete existing manual triggers
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'manualInvoiceGeneration') {
        ScriptApp.deleteTrigger(trigger);
      }
    });
    
    console.log('✅ Manual triggers cleared - use manualInvoiceGeneration() for testing');
    
  } catch (error) {
    console.error('Failed to setup manual trigger:', error);
  }
}

/**
 * Manual invoice generation for testing
 */
function manualInvoiceGeneration() {
  console.log('🔧 Manual invoice generation started...');
  return generateInvoices();
}

/**
 * Remove all triggers for this script
 */
function removeAllTriggers() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      ScriptApp.deleteTrigger(trigger);
    });
    console.log(`✅ Removed ${triggers.length} triggers`);
  } catch (error) {
    console.error('Failed to remove triggers:', error);
  }
}

// ============================================================================
// SYSTEM INITIALIZATION AND SETUP
// ============================================================================

/**
 * Initialize the invoice system
 * Call this once when setting up the system
 */
function initializeInvoiceSystem() {
  console.log('🔧 Initializing Invoice System...\n');
  
  try {
    // Check configuration
    console.log('1. Checking configuration...');
    validateConfiguration();
    
    // Test hub connections
    console.log('2. Testing hub connections...');
    testHubConnections();
    
    // Verify templates exist
    console.log('3. Verifying templates...');
    verifyTemplates();
    
    // Setup triggers
    console.log('4. Setting up triggers...');
    setupOvernightTrigger();
    
    console.log('\n✅ Invoice system initialization complete!');
    console.log('The system is ready to process invoices.');
    
  } catch (error) {
    console.error('❌ Initialization failed:', error);
    throw error;
  }
}

/**
 * Validate system configuration
 */
function validateConfiguration() {
  const requiredFields = [
    'BUDGET_HUB_ID',
    'AUTOMATED_HUB_ID', 
    'MANUAL_HUB_ID',
    'INVOICE_ROOT_FOLDER_ID'
  ];
  
  const missing = requiredFields.filter(field => 
    !CONFIG[field] || CONFIG[field].includes('REPLACE')
  );
  
  if (missing.length > 0) {
    throw new Error(`Missing configuration: ${missing.join(', ')}`);
  }
  
  console.log('✅ Configuration valid');
}

/**
 * Test hub connections
 */
function testHubConnections() {
  try {
    SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
    console.log('✅ Budget Hub accessible');
    
    SpreadsheetApp.openById(CONFIG.AUTOMATED_HUB_ID);
    console.log('✅ Automated Hub accessible');
    
    SpreadsheetApp.openById(CONFIG.MANUAL_HUB_ID);
    console.log('✅ Manual Hub accessible');
    
  } catch (error) {
    throw new Error(`Hub connection failed: ${error.message}`);
  }
}

/**
 * Verify templates exist or create fallbacks
 */
function verifyTemplates() {
  const templates = Object.values(CONFIG.TEMPLATES);
  
  templates.forEach(templateName => {
    try {
      HtmlService.createTemplateFromFile(templateName);
      console.log(`✅ Template ${templateName} found`);
    } catch (error) {
      console.log(`⚠️ Template ${templateName} not found - will use fallback`);
    }
  });
}

// ============================================================================
// FINAL EXPORTS AND MAIN ENTRY POINTS
// ============================================================================

/**
 * Main entry point for manual execution
 * Use this function to manually trigger invoice generation
 */
function main() {
  console.log('🚀 Manual Invoice Generation Started\n');
  
  try {
    const results = generateInvoices();
    
    console.log('\n📊 Final Results:');
    console.log(`✅ Successful: ${results.successful}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`📄 Invoices: ${results.invoices.length}`);
    
    if (results.errors.length > 0) {
      console.log('\n⚠️ Errors encountered:');
      results.errors.forEach(error => {
        console.log(`   - ${error.transactionId || 'System'}: ${error.error}`);
      });
    }
    
    return results;
    
  } catch (error) {
    console.error('💥 Manual generation failed:', error);
    throw error;
  }
}

/**
 * Quick test function for development
 */
function quickTest() {
  console.log('🧪 Running Quick Test...\n');
  return testInvoiceGeneration();
}

/**
 * Simple PDF generation test - minimal dependencies
 * Generates all 3 template types and saves them to Drive
 * Returns URLs to view the PDFs
 */
function testSimplePDFGeneration() {
  console.log('🧪 Testing Simple PDF Generation...\n');

  const results = [];

  // Sample data for testing
  const testData = {
    // Invoice metadata
    invoiceId: 'TEST-INV-0209-01',
    invoiceNumber: 'TEST-INV-0209-01',
    invoiceDate: new Date().toLocaleDateString(),

    // Type information
    formType: 'Amazon',
    typeLabel: 'Amazon Order',
    division: 'Upper School',
    divisionName: 'Upper School',
    divisionCode: 'US',
    isAdmin: false,
    isBatch: false,

    // Financial data
    totalAmount: 299.98,
    amount: 299.98,

    // Order information
    orderId: 'US-AMZ-0209-01',
    orderTotal: 299.98,

    // Transaction details
    transactionId: 'TEST-TXN-001',
    description: 'Lab supplies - microscope slides and covers',

    // Line items
    lineItems: [
      { itemNumber: 1, description: 'Microscope Slides (100 pack)', quantity: 2, unitPrice: 24.99, totalPrice: 49.98 },
      { itemNumber: 2, description: 'Glass Cover Slips', quantity: 5, unitPrice: 12.00, totalPrice: 60.00 },
      { itemNumber: 3, description: 'Lab Safety Goggles', quantity: 10, unitPrice: 19.00, totalPrice: 190.00 }
    ],

    // Transactions (for batch)
    transactions: [
      { transactionId: 'TEST-TXN-001', description: 'Lab supplies', amount: 299.98, requestor: 'john.smith@keswick.edu' }
    ],

    // User information
    requestor: 'john.smith@keswick.edu',
    requestorName: 'John Smith',
    approver: 'jane.doe@keswick.edu',
    approverName: 'Jane Doe',
    approverTitle: 'Principal',

    // Signature info
    signatureName: 'Dr. Jane Doe',
    signatureTitle: 'Upper School Principal',

    // School branding - load dynamically
    logoBase64: '',
    sealBase64: '',
    signatureBase64: ''
  };

  // Try to load branding assets
  try {
    testData.logoBase64 = getSchoolLogoBase64();
    console.log('✅ Logo loaded successfully');
  } catch (e) {
    console.warn('⚠️ Could not load logo:', e.message);
  }

  try {
    testData.sealBase64 = getSchoolSealBase64();
    console.log('✅ Seal loaded successfully');
  } catch (e) {
    console.warn('⚠️ Could not load seal:', e.message);
  }

  // Templates to test
  const templates = [
    { name: 'single_internal_template', label: 'Single Internal' },
    { name: 'batch_internal_template', label: 'Batch Internal' },
    { name: 'warehouse_external_template', label: 'Warehouse External' }
  ];

  // Modify data for warehouse template
  const warehouseData = { ...testData };
  warehouseData.aggregatedItems = testData.lineItems.map(item => ({
    itemId: 'WH-' + item.itemNumber,
    description: item.description,
    quantity: item.quantity,
    totalAmount: item.totalPrice
  }));
  warehouseData.businessOfficeSignatureBase64 = testData.signatureBase64;

  templates.forEach(templateInfo => {
    console.log(`\n📄 Testing: ${templateInfo.label}`);

    try {
      // Use warehouse data for warehouse template
      const dataToUse = templateInfo.name.includes('warehouse') ? warehouseData : testData;

      // Load and process template
      const template = HtmlService.createTemplateFromFile(templateInfo.name);
      template.data = dataToUse;

      // Evaluate template
      const processedHTML = template.evaluate().getContent();
      console.log(`   ✅ Template processed (${processedHTML.length} chars)`);

      // Convert to PDF
      const blob = Utilities.newBlob(processedHTML, 'text/html', `test_${templateInfo.name}.html`)
        .getAs('application/pdf')
        .setName(`TEST_${templateInfo.label.replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);

      console.log(`   ✅ PDF generated (${blob.getBytes().length} bytes)`);

      // Save to Drive
      const folder = DriveApp.getFolderById(CONFIG.INVOICE_ROOT_FOLDER_ID);
      const file = folder.createFile(blob);
      const url = file.getUrl();

      console.log(`   ✅ Saved to Drive: ${url}`);

      results.push({
        template: templateInfo.label,
        success: true,
        url: url,
        fileId: file.getId()
      });

    } catch (error) {
      console.error(`   ❌ Failed: ${error.message}`);
      console.error(`   Stack: ${error.stack}`);
      results.push({
        template: templateInfo.label,
        success: false,
        error: error.message
      });
    }
  });

  console.log('\n\n========== RESULTS ==========');
  results.forEach(r => {
    if (r.success) {
      console.log(`✅ ${r.template}: ${r.url}`);
    } else {
      console.log(`❌ ${r.template}: ${r.error}`);
    }
  });

  return results;
}