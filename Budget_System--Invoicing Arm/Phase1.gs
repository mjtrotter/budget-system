// ============================================================================
// INVOICING SYSTEM PHASE 1 - HUB INTEGRATION FOUNDATION
// ============================================================================
// Production-ready Google Apps Script for invoicing system with dynamic hub 
// integration, robust error handling, and Drive folder management.
// ============================================================================

// ============================================================================
// ENHANCED CONFIGURATION (MOVED TO Main.gs - DO NOT DUPLICATE)
// ============================================================================
// The CONFIG object is now defined in Main.gs to avoid "Identifier already declared" errors
// All Phase files share the same CONFIG from Main.gs


// ============================================================================
// GLOBAL CACHE FOR HUB HEADER MAPPINGS
// ============================================================================
let hubHeadersCache = null;
let cacheTimestamp = null;

// ============================================================================
// HUB HEADERS INTEGRATION
// ============================================================================

/**
 * Load and cache hub header mappings from all hubs
 * @return {Object} Hub header mappings by sheet and form type
 */
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
    
    console.log('📊 Loading hub header mappings from spreadsheets...');
    
    const mappings = {
      budget: loadBudgetHubMappings(),
      automated: loadAutomatedHubMappings(), 
      manual: loadManualHubMappings()
    };
    
    // Cache for 1 hour
    cache.put(cacheKey, JSON.stringify(mappings), CONFIG.CACHE_EXPIRATION_SECONDS);
    
    console.log('✅ Hub header mappings loaded and cached');
    return mappings;
    
  } catch (error) {
    logError('Failed to load hub header mappings', error);
    throw new Error(`Hub mapping error: ${error.message}`);
  }
}

/**
 * Load Budget Hub column mappings
 * @return {Object} Budget hub mappings
 */
function loadBudgetHubMappings() {
  const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
  
  return {
    TransactionLedger: {
      TransactionID: 0,    // A
      OrderID: 1,          // B  
      ProcessedOn: 2,      // C
      Requestor: 3,        // D
      Approver: 4,         // E
      Organization: 5,     // F
      Form: 6,             // G
      Amount: 7,           // H
      Description: 8,      // I
      FiscalQuarter: 9,    // J
      InvoiceGenerated: 10, // K
      InvoiceID: 11,       // L (added after headers printout)
      InvoiceURL: 12       // M (added after headers printout)
    },
    SystemLog: {
      Timestamp: 0,        // A
      Action: 1,           // B
      User: 2,             // C
      Amount: 3,           // D
      Details: 4,          // E
      Before: 5,           // F
      After: 6,            // G
      Status: 7            // H
    },
    UserDirectory: {
      Email: 0,            // A
      FirstName: 1,        // B
      LastName: 2,         // C
      Role: 3,             // D
      Department: 4,       // E
      Division: 5,         // F
      Approver: 6,         // G
      BudgetAllocated: 7,  // H
      BudgetSpent: 8,      // I
      BudgetEncumbered: 9, // J
      BudgetRemaining: 10, // K
      UtilizationRate: 11, // L
      Active: 12,          // M
      LastModified: 13     // N
    },
    OrganizationBudgets: {
      Organization: 0,     // A
      BudgetAllocated: 1,  // B
      BudgetSpent: 2,      // C
      BudgetEncumbered: 3, // D
      BudgetAvailable: 4,  // E
      Approver: 5,         // F
      Active: 6,           // G
      LastModified: 7      // H
    }
  };
}

/**
 * Load Automated Hub column mappings
 * @return {Object} Automated hub mappings
 */
function loadAutomatedHubMappings() {
  return {
    Amazon: {
      Timestamp: 0,               // A
      EmailAddress: 1,            // B
      Item1Description: 2,        // C
      Item1AmazonURL: 3,          // D
      Item1Quantity: 4,           // E
      Item1UnitPrice: 5,          // F
      AddAnother1: 6,             // G
      Item2Description: 7,        // H
      Item2AmazonURL: 8,          // I
      Item2Quantity: 9,           // J
      Item2UnitPrice: 10,         // K
      AddAnother2: 11,            // L
      Item3Description: 12,       // M
      Item3AmazonURL: 13,         // N
      Item3Quantity: 14,          // O
      Item3UnitPrice: 15,         // P
      AddAnother3: 16,            // Q
      Item4Description: 17,       // R
      Item4AmazonURL: 18,         // S
      Item4Quantity: 19,          // T
      Item4UnitPrice: 20,         // U
      AddAnother4: 21,            // V
      Item5Description: 22,       // W
      Item5AmazonURL: 23,         // X
      Item5Quantity: 24,          // Y
      Item5UnitPrice: 25,         // Z
      Empty: 26,                  // AA
      TotalCost: 27,              // AB
      TransactionID: 28           // AC
    },
    Warehouse: {
      Timestamp: 0,               // A
      EmailAddress: 1,            // B
      Item1ItemID: 2,             // C
      Item1Quantity: 3,           // D
      AddAnother1: 4,             // E
      Item2ItemID: 5,             // F
      Item2Quantity: 6,           // G
      AddAnother2: 7,             // H
      Item3ItemID: 8,             // I
      Item3Quantity: 9,           // J
      AddAnother3: 10,            // K
      Item4ItemID: 11,            // L
      Item4Quantity: 12,          // M
      AddAnother4: 13,            // N
      Item5ItemID: 14,            // O
      Item5Quantity: 15,          // P
      Empty: 16,                  // Q
      Item1Description: 17,       // R
      Item1Price: 18,             // S
      Item2Description: 19,       // T
      Item2Price: 20,             // U
      Item3Description: 21,       // V
      Item3Price: 22,             // W
      Item4Description: 23,       // X
      Item4Price: 24,             // Y
      Item5Description: 25,       // Z
      Item5Price: 26,             // AA
      TotalCost: 27,              // AB
      TransactionID: 28           // AC
    },
    AutomatedQueue: {
      TransactionID: 0,           // A
      Requestor: 1,               // B
      RequestType: 2,             // C
      Department: 3,              // D
      Division: 4,                // E
      Amount: 5,                  // F
      Description: 6,             // G
      Status: 7,                  // H
      Requested: 8,               // I
      Approved: 9,                // J
      Processed: 10,              // K
      ResponseID: 11              // L
    },
    WarehouseCatalog: {
      StockNumber: 0,             // A
      ItemDescription: 1,         // B
      Price: 2,                   // C
      UOM: 3,                     // D
      Category: 4                 // E
    }
  };
}

/**
 * Load Manual Hub column mappings
 * @return {Object} Manual hub mappings
 */
function loadManualHubMappings() {
  return {
    Admin: {
      Timestamp: 0,               // A
      EmailAddress: 1,            // B
      PurchaseDescription: 2,     // C
      TotalCost: 3,               // D
      Rationale: 4,               // E
      UploadInvoice: 5            // F
    },
    Curriculum: {
      Timestamp: 0,               // A
      EmailAddress: 1,            // B
      CurriculumType: 2,          // C
      ItemDetailsMethod: 3,       // D
      ResourceName: 4,            // E
      ResourceURL: 5,             // F
      ISBN: 6,                    // G
      QuantityNeeded: 7,          // H
      TotalCost: 8,               // I
      UploadPDF: 9                // J
    },
    FieldTrip: {
      Timestamp: 0,               // A
      EmailAddress: 1,            // B
      TripDestination: 2,         // C
      TripDate: 3,                // D
      NumberOfStudents: 4,        // E
      TransportationType: 5,      // F
      TotalCost: 6,               // G
      UploadInvoice: 7            // H
    },
    ManualQueue: {
      TransactionID: 0,           // A
      Requestor: 1,               // B
      RequestType: 2,             // C
      Department: 3,              // D
      Division: 4,                // E
      Amount: 5,                  // F
      Description: 6,             // G
      Status: 7,                  // H
      Requested: 8,               // I
      Approved: 9                 // J
    }
  };
}

/**
 * Get column indices for specific form type
 * @param {string} formType - Form type (Amazon, Warehouse, Admin, etc.)
 * @return {Object} Column indices for the form
 */
function getFormColumnIndices(formType) {
  try {
    const mappings = loadHubHeaderMappings();
    
    // Normalize form type
    const normalizedFormType = normalizeFormType(formType);
    
    // Determine which hub contains this form type
    let hubMapping = null;
    let sheetName = null;
    
    if (mappings.automated[normalizedFormType]) {
      hubMapping = mappings.automated[normalizedFormType];
      sheetName = normalizedFormType;
    } else if (mappings.manual[normalizedFormType]) {
      hubMapping = mappings.manual[normalizedFormType];
      sheetName = normalizedFormType;
    } else if (mappings.budget[normalizedFormType]) {
      hubMapping = mappings.budget[normalizedFormType];
      sheetName = normalizedFormType;
    }
    
    if (!hubMapping) {
      throw new Error(`Form type '${formType}' not found in hub mappings`);
    }
    
    console.log(`📋 Retrieved column indices for ${formType}: ${Object.keys(hubMapping).length} columns`);
    return {
      columns: hubMapping,
      sheetName: sheetName,
      hub: mappings.automated[formType] ? 'automated' : 
           mappings.manual[formType] ? 'manual' : 'budget'
    };
    
  } catch (error) {
    logError(`Failed to get column indices for ${formType}`, error);
    throw error;
  }
}

// ============================================================================
// IMAGE HANDLING WITH ERROR THROWING
// ============================================================================

/**
 * Get school logo as base64 encoded string
 * @return {string} Base64 encoded logo
 * @throws {Error} If logo file is missing or cannot be read
 */
function getSchoolLogoBase64() {
  try {
    console.log('🖼️ Loading school logo...');
    
    if (!CONFIG.SCHOOL_LOGO_FILE_ID || CONFIG.SCHOOL_LOGO_FILE_ID.includes('REPLACE')) {
      throw new Error('School logo file ID not configured in CONFIG.SCHOOL_LOGO_FILE_ID');
    }
    
    const logoFile = DriveApp.getFileById(CONFIG.SCHOOL_LOGO_FILE_ID);
    const logoBlob = logoFile.getBlob();
    const logoBase64 = Utilities.base64Encode(logoBlob.getBytes());
    
    console.log('✅ School logo loaded successfully');
    return logoBase64;
    
  } catch (error) {
    const errorMsg = `Failed to load school logo: ${error.message}`;
    logError(errorMsg, error);
    throw new Error(errorMsg);
  }
}

/**
 * Get division signature as base64 encoded string
 * @param {string} divisionCode - Division code (US, LS, KK, AD)
 * @return {string} Base64 encoded signature
 * @throws {Error} If signature file is missing or cannot be read
 */
function getDivisionSignatureBase64(divisionCode) {
  try {
    console.log(`✍️ Loading signature for division: ${divisionCode}`);
    
    const signatureFileId = CONFIG.DIVISION_SIGNATURES[divisionCode];
    
    if (!signatureFileId || signatureFileId.includes('REPLACE')) {
      throw new Error(`Division signature file ID not configured for ${divisionCode}`);
    }
    
    const signatureFile = DriveApp.getFileById(signatureFileId);
    const signatureBlob = signatureFile.getBlob();
    const signatureBase64 = Utilities.base64Encode(signatureBlob.getBytes());
    
    console.log(`✅ Division signature loaded for ${divisionCode}`);
    return signatureBase64;
    
  } catch (error) {
    const errorMsg = `Failed to load division signature for ${divisionCode}: ${error.message}`;
    logError(errorMsg, error);
    throw new Error(errorMsg);
  }
}

/**
 * Get admin signature as base64 encoded string
 * @param {string} adminEmail - Admin email address
 * @return {string} Base64 encoded signature
 * @throws {Error} If signature file is missing or cannot be read
 */
function getAdminSignatureBase64(adminEmail) {
  try {
    console.log(`✍️ Loading admin signature for: ${adminEmail}`);
    
    const adminConfig = CONFIG.ADMIN_SIGNATURES[adminEmail];
    
    if (!adminConfig || !adminConfig.signatureFileId || adminConfig.signatureFileId.includes('REPLACE')) {
      throw new Error(`Admin signature file ID not configured for ${adminEmail}`);
    }
    
    const signatureFile = DriveApp.getFileById(adminConfig.signatureFileId);
    const signatureBlob = signatureFile.getBlob();
    const signatureBase64 = Utilities.base64Encode(signatureBlob.getBytes());
    
    console.log(`✅ Admin signature loaded for ${adminEmail}`);
    return signatureBase64;
    
  } catch (error) {
    const errorMsg = `Failed to load admin signature for ${adminEmail}: ${error.message}`;
    logError(errorMsg, error);
    throw new Error(errorMsg);
  }
}

// ============================================================================
// DRIVE OPERATIONS WITH FOLDER STRUCTURE
// ============================================================================

/**
 * Save invoice PDF to Drive with organized folder structure
 * @param {Blob} pdfBlob - PDF blob to save
 * @param {Object} metadata - Invoice metadata (invoiceId, division, etc.)
 * @return {string} File URL
 */
function saveInvoiceToDrive(pdfBlob, metadata) {
  try {
    console.log(`💾 Saving invoice ${metadata.invoiceId} to Drive...`);
    
    const now = new Date();
    const year = now.getFullYear();
    const quarter = getQuarter(now);
    const division = metadata.divisionCode || 'AD';
    
    // Create folder structure: Root > Year > Quarter > Division
    const rootFolder = DriveApp.getFolderById(CONFIG.INVOICE_ROOT_FOLDER_ID);
    const yearFolder = getOrCreateFolder(rootFolder, year.toString());
    const quarterFolder = getOrCreateFolder(yearFolder, `Q${quarter}`);
    const divisionFolder = getOrCreateFolder(quarterFolder, division);
    
    // Save file with proper naming
    const fileName = `${metadata.invoiceId}_${formatDateForFilename(now)}.pdf`;
    const savedFile = divisionFolder.createFile(pdfBlob.setName(fileName));
    
    const fileUrl = savedFile.getUrl();
    console.log(`✅ Invoice saved: ${fileName}`);
    
    return fileUrl;
    
  } catch (error) {
    const errorMsg = `Failed to save invoice to Drive: ${error.message}`;
    logError(errorMsg, error);
    throw new Error(errorMsg);
  }
}

/**
 * Get or create folder with error handling
 * @param {DriveApp.Folder} parentFolder - Parent folder
 * @param {string} folderName - Folder name to create or find
 * @return {DriveApp.Folder} Found or created folder
 */
function getOrCreateFolder(parentFolder, folderName) {
  try {
    const existingFolders = parentFolder.getFoldersByName(folderName);
    
    if (existingFolders.hasNext()) {
      return existingFolders.next();
    } else {
      console.log(`📁 Creating folder: ${folderName}`);
      return parentFolder.createFolder(folderName);
    }
    
  } catch (error) {
    logError(`Failed to get/create folder ${folderName}`, error);
    throw error;
  }
}

/**
 * Get fiscal quarter from date
 * @param {Date} date - Date to analyze
 * @return {number} Quarter number (1-4)
 */
function getQuarter(date) {
  const month = date.getMonth() + 1; // getMonth() is 0-based
  return Math.ceil(month / 3);
}

/**
 * Format date for filename (YYYY-MM-DD)
 * @param {Date} date - Date to format
 * @return {string} Formatted date string
 */
function formatDateForFilename(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ============================================================================
// TRANSACTION LEDGER OPERATIONS
// ============================================================================

/**
 * Update transaction ledger with invoice information
 * @param {string} transactionId - Transaction ID to update
 * @param {Object} invoiceData - Invoice data object
 * @return {boolean} Success status
 */
function updateTransactionLedger(transactionId, invoiceData) {
  let retryCount = 0;
  
  while (retryCount < CONFIG.MAX_RETRY_ATTEMPTS) {
    try {
      console.log(`📝 Updating transaction ledger for ${transactionId} (attempt ${retryCount + 1})`);
      
      const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
      const ledgerSheet = budgetHub.getSheetByName('TransactionLedger');
      
      if (!ledgerSheet) {
        throw new Error('TransactionLedger sheet not found in Budget Hub');
      }
      
      // Get column mappings
      const mappings = loadHubHeaderMappings();
      const ledgerCols = mappings.budget.TransactionLedger;
      
      // Find the transaction row
      const dataRange = ledgerSheet.getDataRange();
      const values = dataRange.getValues();
      
      let rowIndex = -1;
      for (let i = 1; i < values.length; i++) { // Skip header row
        if (values[i][ledgerCols.TransactionID] === transactionId) {
          rowIndex = i + 1; // Convert to 1-based index
          break;
        }
      }
      
      if (rowIndex === -1) {
        throw new Error(`Transaction ${transactionId} not found in ledger`);
      }
      
      // Update the row with invoice information
      const updateRange = ledgerSheet.getRange(rowIndex, ledgerCols.InvoiceGenerated + 1, 1, 3);
      updateRange.setValues([[
        new Date(), // InvoiceGenerated
        invoiceData.invoiceId, // InvoiceID  
        invoiceData.fileUrl // InvoiceURL
      ]]);
      
      console.log(`✅ Transaction ledger updated for ${transactionId}`);
      return true;
      
    } catch (error) {
      retryCount++;
      const errorMsg = `Failed to update transaction ledger (attempt ${retryCount}): ${error.message}`;
      console.error(errorMsg);
      
      if (retryCount >= CONFIG.MAX_RETRY_ATTEMPTS) {
        logError(`Max retries exceeded for transaction ledger update: ${transactionId}`, error);
        return false;
      }
      
      // Wait before retry
      Utilities.sleep(CONFIG.RETRY_DELAY_MS);
    }
  }
  
  return false;
}

/**
 * Get pending invoice transactions from ledger
 * @return {Array} Array of pending transactions
 */
function getPendingInvoiceTransactions() {
  try {
    console.log('📋 Retrieving pending transactions from ledger...');
    
    const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
    const ledgerSheet = budgetHub.getSheetByName('TransactionLedger');
    
    if (!ledgerSheet) {
      throw new Error('TransactionLedger sheet not found');
    }
    
    const mappings = loadHubHeaderMappings();
    const cols = mappings.budget.TransactionLedger;
    
    const dataRange = ledgerSheet.getDataRange();
    const values = dataRange.getValues();
    
    const pendingTransactions = [];
    
    for (let i = 1; i < values.length; i++) { // Skip header
      const row = values[i];
      
      // Check if invoice not yet generated (InvoiceGenerated column is empty)
      if (!row[cols.InvoiceGenerated]) {
        pendingTransactions.push({
          rowIndex: i,
          transactionId: row[cols.TransactionID],
          orderId: row[cols.OrderID],
          processedOn: row[cols.ProcessedOn],
          requestor: row[cols.Requestor],
          approver: row[cols.Approver], 
          organization: row[cols.Organization],
          formType: row[cols.Form],
          amount: row[cols.Amount],
          description: row[cols.Description],
          fiscalQuarter: row[cols.FiscalQuarter]
        });
      }
    }
    
    console.log(`📊 Found ${pendingTransactions.length} pending transactions`);
    return pendingTransactions;
    
  } catch (error) {
    logError('Failed to get pending transactions', error);
    throw error;
  }
}

// ============================================================================
// ERROR HANDLING AND LOGGING
// ============================================================================

/**
 * Log error to system log with context
 * @param {string} message - Error message
 * @param {Error} error - Error object
 * @param {Object} context - Additional context
 */
function logError(message, error, context = {}) {
  try {
    const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
    const systemLog = budgetHub.getSheetByName('SystemLog');
    
    if (systemLog) {
      const logRow = [
        new Date(),
        'INVOICING_ERROR',
        Session.getActiveUser().getEmail(),
        '', // Amount (not applicable for errors)
        message,
        JSON.stringify(context),
        error.stack || error.toString(),
        'ERROR'
      ];
      
      systemLog.appendRow(logRow);
    }
    
    // Also log to console
    console.error(`🚨 ${message}:`, error);
    
    // Send notification for critical errors
    if (message.includes('CRITICAL') || message.includes('FATAL')) {
      sendErrorNotification(message, error, context);
    }
    
  } catch (logError) {
    console.error('Failed to log error to system log:', logError);
    console.error('Original error:', message, error);
  }
}

/**
 * Send error notification email
 * @param {string} message - Error message
 * @param {Error} error - Error object  
 * @param {Object} context - Additional context
 */
function sendErrorNotification(message, error, context) {
  try {
    if (!CONFIG.ERROR_NOTIFICATION_EMAIL || CONFIG.ERROR_NOTIFICATION_EMAIL.includes('REPLACE')) {
      console.log('Error notification email not configured, skipping notification');
      return;
    }
    
    const subject = `[INVOICING] System Error: ${message}`;
    const body = `
Invoicing System Error Alert

Time: ${new Date()}
Error: ${message}
Details: ${error.toString()}
Stack: ${error.stack || 'No stack trace available'}
Context: ${JSON.stringify(context, null, 2)}

Please investigate immediately.

- Invoicing System
    `;
    
    MailApp.sendEmail(CONFIG.ERROR_NOTIFICATION_EMAIL, subject, body);
    console.log('📧 Error notification sent');
    
  } catch (emailError) {
    console.error('Failed to send error notification:', emailError);
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Fix the getFormColumnIndices function in Phase 1
// Add normalization before lookup:



// Add this function to Phase 1:
function normalizeFormType(formType) {
  const typeMap = {
    'AMAZON': 'Amazon',
    'WAREHOUSE': 'Warehouse',
    'ADMIN': 'Admin',
    'CURRICULUM': 'Curriculum',
    'FIELDTRIP': 'FieldTrip'
  };
  return typeMap[formType] || formType;
}

/**
 * Clear all caches (for testing/debugging)
 */
function clearHubMappingsCache() {
  try {
    const cache = CacheService.getScriptCache();
    cache.remove('hubHeaderMappings');
    hubHeadersCache = null;
    cacheTimestamp = null;
    console.log('🧹 Hub mappings cache cleared');
  } catch (error) {
    console.error('Failed to clear cache:', error);
  }
}

/**
 * Test all Phase 1 functions
 */
function testPhase1Functions() {
  console.log('🧪 Testing Phase 1 functions...');
  
  try {
    // Test hub mappings
    const mappings = loadHubHeaderMappings();
    console.log('✅ Hub mappings loaded');
    
    // Test column indices
    const amazonCols = getFormColumnIndices('Amazon');
    console.log('✅ Amazon column indices retrieved');
    
    // Test image loading (will throw errors if not configured)
    try {
      getSchoolLogoBase64();
      console.log('✅ School logo loaded');
    } catch (e) {
      console.log('⚠️ School logo not configured (expected)');
    }
    
    try {
      getDivisionSignatureBase64('US');
      console.log('✅ Division signature loaded');
    } catch (e) {
      console.log('⚠️ Division signatures not configured (expected)');
    }
    
    // Test pending transactions
    const pending = getPendingInvoiceTransactions();
    console.log(`✅ Found ${pending.length} pending transactions`);
    
    console.log('🎉 Phase 1 test completed');
    
  } catch (error) {
    console.error('❌ Phase 1 test failed:', error);
    throw error;
  }
}

// ============================================================================
// CONFIGURATION VALIDATOR
// ============================================================================

/**
 * Validate that all required configuration is set
 * @return {Object} Validation results
 */
function validateConfiguration() {
  const results = {
    valid: true,
    errors: [],
    warnings: []
  };
  
  // Check required spreadsheet IDs
  const requiredIds = [
    'BUDGET_HUB_ID',
    'AUTOMATED_HUB_ID', 
    'MANUAL_HUB_ID',
    'INVOICE_ROOT_FOLDER_ID'
  ];
  
  requiredIds.forEach(id => {
    if (!CONFIG[id] || CONFIG[id].includes('REPLACE')) {
      results.valid = false;
      results.errors.push(`${id} not configured`);
    }
  });
  
  // Check email configuration
  if (!CONFIG.ERROR_NOTIFICATION_EMAIL || CONFIG.ERROR_NOTIFICATION_EMAIL.includes('REPLACE')) {
    results.warnings.push('Error notification email not configured');
  }
  
  // Check image file IDs
  if (!CONFIG.SCHOOL_LOGO_FILE_ID || CONFIG.SCHOOL_LOGO_FILE_ID.includes('REPLACE')) {
    results.warnings.push('School logo file ID not configured');
  }
  
  // Check division signatures
  Object.keys(CONFIG.DIVISIONS).forEach(div => {
    if (!CONFIG.DIVISION_SIGNATURES[div] || CONFIG.DIVISION_SIGNATURES[div].includes('REPLACE')) {
      results.warnings.push(`Division signature for ${div} not configured`);
    }
  });
  
  return results;
}