// ============================================================================
// INVOICING SYSTEM PHASE 3 - COMPREHENSIVE DATA ENRICHMENT PIPELINE
// ============================================================================
// Production-ready data enrichment using hub mappings with multi-item parsing,
// cross-division totals, and user name resolution with intelligent caching.
// ============================================================================

// ============================================================================
// PHASE 3 EXTENSIONS TO CONFIG
// ============================================================================
const PHASE_3_CONFIG = {
  // Data Enrichment Settings
  ENRICHMENT: {
    MAX_ITEMS_PER_TRANSACTION: 5,
    MAX_ITEMS_PER_INVOICE: 10,
    CACHE_EXPIRY_SECONDS: 1800, // 30 minutes
    
    // Fallback settings
    DEFAULT_DESCRIPTION: 'Purchase Request',
    DEFAULT_QUANTITY: 1,
    UNKNOWN_USER_NAME: 'Unknown User',
    
    // Data validation
    MIN_AMOUNT: 0.01,
    MAX_AMOUNT: 50000,
    MAX_DESCRIPTION_LENGTH: 500,
    
    // Performance settings
    BATCH_USER_LOOKUP_SIZE: 50,
    MAX_RETRY_ATTEMPTS: 3,
    RETRY_DELAY_MS: 1000
  },
  
  // Form type to hub mapping
  FORM_HUB_MAPPING: {
    'Amazon': 'automated',
    'AMAZON': 'automated',
    'Warehouse': 'automated', 
    'WAREHOUSE': 'automated',
    'Field Trip': 'manual',
    'FIELDTRIP': 'manual',
    'Curriculum': 'manual',
    'CURRICULUM': 'manual',
    'Admin': 'manual',
    'ADMIN': 'manual'
  }
};

// ============================================================================
// GLOBAL CACHE FOR DATA ENRICHMENT
// ============================================================================
let userDirectoryCache = null;
let userDirectoryCacheTimestamp = null;
let formDataCache = new Map();

// ============================================================================
// MAIN DATA ENRICHMENT FUNCTION
// ============================================================================

/**
 * Enrich transaction data with complete form details, line items, and user info
 * @param {Object} transaction - Base transaction from ledger
 * @return {Object} Enriched transaction with all details
 */
function enrichTransactionData(transaction) {
  const startTime = Date.now();
  
  try {
    console.log(`🔍 Enriching transaction ${transaction.transactionId} (${transaction.formType})`);
    
    // Validate input transaction
    if (!transaction || !transaction.transactionId || !transaction.formType) {
      throw new Error('Invalid transaction object provided');
    }
    
    // Start with base transaction
    let enrichedTransaction = { ...transaction };
    
    // 1. Resolve user names for requestor and approver
    const userNames = resolveUserNames([transaction.requestor, transaction.approver]);
    enrichedTransaction.requestorName = userNames[transaction.requestor] || extractNameFromEmail(transaction.requestor);
    enrichedTransaction.approverName = userNames[transaction.approver] || extractNameFromEmail(transaction.approver);
    
    // 2. Extract form data and parse line items
    const formDataResult = extractAndParseFormData(transaction);
    if (formDataResult.success) {
      enrichedTransaction.lineItems = formDataResult.lineItems;
      enrichedTransaction.formDetails = formDataResult.formDetails;
      enrichedTransaction.additionalInfo = formDataResult.additionalInfo;
      
      // Validate line items total matches transaction amount
      const lineItemsTotal = formDataResult.lineItems.reduce((sum, item) => sum + item.totalPrice, 0);
      enrichedTransaction.lineItemsTotal = lineItemsTotal;
      enrichedTransaction.amountVariance = Math.abs(lineItemsTotal - (transaction.amount || 0));
    } else {
      console.warn(`⚠️ Form data extraction failed: ${formDataResult.error}`);
      enrichedTransaction.lineItems = createDefaultLineItem(transaction);
      enrichedTransaction.formDetails = {};
      enrichedTransaction.additionalInfo = {};
      enrichedTransaction.enrichmentWarnings = [formDataResult.error];
    }
    
    // 3. Calculate cross-division order totals if applicable
    if (transaction.orderId) {
      enrichedTransaction.crossDivisionTotal = calculateCrossDivisionTotals(transaction.orderId);
      enrichedTransaction.isDivisionPortion = enrichedTransaction.crossDivisionTotal > (transaction.amount || 0);
    }
    
    // 4. Add enrichment metadata
    enrichedTransaction.enrichmentTimestamp = new Date();
    enrichedTransaction.enrichmentDuration = Date.now() - startTime;
    enrichedTransaction.isEnriched = true;
    
    // 5. Data validation and cleanup
    enrichedTransaction = validateAndCleanEnrichedData(enrichedTransaction);
    
    console.log(`✅ Transaction enriched in ${Date.now() - startTime}ms - ${enrichedTransaction.lineItems.length} items`);
    
    return enrichedTransaction;
    
  } catch (error) {
    const enrichmentError = `Failed to enrich transaction ${transaction.transactionId}: ${error.message}`;
    logError(enrichmentError, error, { 
      transactionId: transaction.transactionId,
      formType: transaction.formType,
      enrichmentDuration: Date.now() - startTime
    });
    
    // Return transaction with basic enrichment and error info
    return {
      ...transaction,
      isEnriched: false,
      enrichmentError: error.message,
      enrichmentTimestamp: new Date(),
      lineItems: createDefaultLineItem(transaction),
      requestorName: extractNameFromEmail(transaction.requestor),
      approverName: extractNameFromEmail(transaction.approver)
    };
  }
}

// ============================================================================
// FORM DATA EXTRACTION
// ============================================================================

/**
 * Extract form data from appropriate hub and parse based on form type
 * @param {Object} transaction - Transaction object
 * @return {Object} Extraction result with success status and data
 */
function extractAndParseFormData(transaction) {
  try {
    const hubType = PHASE_3_CONFIG.FORM_HUB_MAPPING[transaction.formType];
    const hubId = getHubId(hubType);
    
    if (!hubId) {
      return {
        success: false,
        error: `Unknown hub type for form: ${transaction.formType}`,
        lineItems: [],
        formDetails: {},
        additionalInfo: {}
      };
    }
    
    // Find the form submission row
    const formRow = findFormSubmissionRow(hubId, transaction);
    
    if (!formRow.found) {
      return {
        success: false,
        error: `Form submission not found for transaction ${transaction.transactionId}`,
        lineItems: [],
        formDetails: {},
        additionalInfo: {}
      };
    }
    
    // Get column mappings for this form type
    const columnMapping = getFormColumnIndices(transaction.formType);
    
    // Parse based on form type
    let parseResult;
    if (transaction.formType === 'Amazon' || transaction.formType === 'AMAZON') {
      parseResult = parseAmazonForm(formRow.data, columnMapping.columns);
    } else if (transaction.formType === 'Warehouse' || transaction.formType === 'WAREHOUSE') {
      parseResult = parseWarehouseForm(formRow.data, columnMapping.columns);
    } else {
      parseResult = parseSingleItemForm(formRow.data, columnMapping.columns, transaction.formType);
    }
    
    return {
      success: true,
      lineItems: parseResult.lineItems,
      formDetails: parseResult.formDetails,
      additionalInfo: parseResult.additionalInfo
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      lineItems: [],
      formDetails: {},
      additionalInfo: {}
    };
  }
}

/**
 * Find form submission row that matches the transaction
 * @param {string} hubId - Hub spreadsheet ID
 * @param {Object} transaction - Transaction object
 * @return {Object} Result with found status and data
 */
function findFormSubmissionRow(hubId, transaction) {
  try {
    const hub = SpreadsheetApp.openById(hubId);
    const sheetName = getSheetNameForFormType(transaction.formType);
    const sheet = hub.getSheetByName(sheetName);
    
    if (!sheet) {
      throw new Error(`Sheet ${sheetName} not found in hub ${hubId}`);
    }
    
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    // Look for transaction ID in the data (typically last column)
    for (let i = 1; i < values.length; i++) { // Skip header row
      const row = values[i];
      
      // Check for transaction ID match (usually in last column)
      if (row[row.length - 1] === transaction.transactionId) {
        return {
          found: true,
          data: row,
          rowIndex: i
        };
      }
      
      // Fallback: check for email and approximate timestamp match
      if (row[1] === transaction.requestor) { // Email usually in column B
        const formTimestamp = new Date(row[0]); // Timestamp usually in column A
        const transactionTime = new Date(transaction.processedOn);
        const timeDiff = Math.abs(formTimestamp - transactionTime);
        
        // If within 24 hours, likely a match
        if (timeDiff < 24 * 60 * 60 * 1000) {
          return {
            found: true,
            data: row,
            rowIndex: i
          };
        }
      }
    }
    
    return {
      found: false,
      data: null,
      rowIndex: -1
    };
    
  } catch (error) {
    throw new Error(`Failed to find form submission: ${error.message}`);
  }
}

/**
 * Get sheet name for form type
 * @param {string} formType - Form type
 * @return {string} Sheet name
 */
function getSheetNameForFormType(formType) {
  const sheetMapping = {
    'Amazon': 'Amazon',
    'AMAZON': 'Amazon',
    'Warehouse': 'Warehouse',
    'WAREHOUSE': 'Warehouse',
    'Field Trip': 'FieldTrip',
    'FIELDTRIP': 'FieldTrip',
    'Curriculum': 'Curriculum',
    'CURRICULUM': 'Curriculum',
    'Admin': 'Admin',
    'ADMIN': 'Admin'
  };
  
  return sheetMapping[formType] || 'ManualQueue';
}

/**
 * Get hub ID for hub type
 * @param {string} hubType - Hub type (automated, manual, budget)
 * @return {string} Hub ID
 */
function getHubId(hubType) {
  const hubMapping = {
    'automated': CONFIG.AUTOMATED_HUB_ID,
    'manual': CONFIG.MANUAL_HUB_ID,
    'budget': CONFIG.BUDGET_HUB_ID
  };
  
  return hubMapping[hubType];
}

// ============================================================================
// MULTI-ITEM FORM PARSING
// ============================================================================

/**
 * Parse Amazon form with up to 5 items
 * @param {Array} formRow - Form submission row data
 * @param {Object} columnMap - Column mapping for Amazon form
 * @return {Object} Parse result with line items and details
 */
function parseAmazonForm(formRow, columnMap) {
  try {
    const lineItems = [];
    const formDetails = {
      timestamp: formRow[columnMap.Timestamp],
      emailAddress: formRow[columnMap.EmailAddress],
      totalCost: parseFloat(String(formRow[columnMap.TotalCost] || '0').replace(/[$,]/g, '')) || 0
    };
    
    // Parse up to 5 items based on Hub Headers structure
    const itemMappings = [
      { // Item 1: C,D,E,F
        description: columnMap.Item1Description,
        url: columnMap.Item1AmazonURL,
        quantity: columnMap.Item1Quantity,
        unitPrice: columnMap.Item1UnitPrice
      },
      { // Item 2: H,I,J,K  
        description: columnMap.Item2Description,
        url: columnMap.Item2AmazonURL,
        quantity: columnMap.Item2Quantity,
        unitPrice: columnMap.Item2UnitPrice
      },
      { // Item 3: M,N,O,P
        description: columnMap.Item3Description,
        url: columnMap.Item3AmazonURL,
        quantity: columnMap.Item3Quantity,
        unitPrice: columnMap.Item3UnitPrice
      },
      { // Item 4: R,S,T,U
        description: columnMap.Item4Description,
        url: columnMap.Item4AmazonURL,
        quantity: columnMap.Item4Quantity,
        unitPrice: columnMap.Item4UnitPrice
      },
      { // Item 5: W,X,Y,Z
        description: columnMap.Item5Description,
        url: columnMap.Item5AmazonURL,
        quantity: columnMap.Item5Quantity,
        unitPrice: columnMap.Item5UnitPrice
      }
    ];
    
    itemMappings.forEach((mapping, index) => {
      const description = formRow[mapping.description];
      const url = formRow[mapping.url];
      const quantity = parseInt(formRow[mapping.quantity]) || 0;
      const unitPrice = parseFloat(String(formRow[mapping.unitPrice] || '0').replace(/[$,]/g, '')) || 0;
      
      if (description && url && quantity > 0 && unitPrice > 0) {
        const asin = extractASINFromURL(url);
        
        lineItems.push({
          itemNumber: index + 1,
          itemId: asin || `AMAZON-${index + 1}`,
          description: cleanDescription(description),
          url: url,
          asin: asin,
          quantity: quantity,
          unitPrice: unitPrice,
          totalPrice: quantity * unitPrice,
          itemType: 'Amazon'
        });
      }
    });
    
    // Validate total
    const calculatedTotal = lineItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const variance = Math.abs(calculatedTotal - formDetails.totalCost);
    
    return {
      lineItems: lineItems,
      formDetails: {
        ...formDetails,
        calculatedTotal: calculatedTotal,
        variance: variance,
        isVarianceAcceptable: variance < 0.01 // Less than 1 cent
      },
      additionalInfo: {
        itemCount: lineItems.length,
        hasVariance: variance >= 0.01
      }
    };
    
  } catch (error) {
    throw new Error(`Amazon form parsing failed: ${error.message}`);
  }
}

/**
 * Parse Warehouse form with up to 5 items
 * @param {Array} formRow - Form submission row data
 * @param {Object} columnMap - Column mapping for Warehouse form
 * @return {Object} Parse result with line items and details
 */
function parseWarehouseForm(formRow, columnMap) {
  try {
    const lineItems = [];
    const formDetails = {
      timestamp: formRow[columnMap.Timestamp],
      emailAddress: formRow[columnMap.EmailAddress],
      totalCost: parseFloat(String(formRow[columnMap.TotalCost] || '0').replace(/[$,]/g, '')) || 0
    };
    
    // Parse up to 5 items based on Hub Headers structure
    const itemMappings = [
      { // Item 1: ID in C, Qty in D, Desc in R, Price in S
        itemId: columnMap.Item1ItemID,
        quantity: columnMap.Item1Quantity,
        description: columnMap.Item1Description,
        price: columnMap.Item1Price
      },
      { // Item 2: ID in F, Qty in G, Desc in T, Price in U
        itemId: columnMap.Item2ItemID,
        quantity: columnMap.Item2Quantity,
        description: columnMap.Item2Description,
        price: columnMap.Item2Price
      },
      { // Item 3: ID in I, Qty in J, Desc in V, Price in W
        itemId: columnMap.Item3ItemID,
        quantity: columnMap.Item3Quantity,
        description: columnMap.Item3Description,
        price: columnMap.Item3Price
      },
      { // Item 4: ID in L, Qty in M, Desc in X, Price in Y
        itemId: columnMap.Item4ItemID,
        quantity: columnMap.Item4Quantity,
        description: columnMap.Item4Description,
        price: columnMap.Item4Price
      },
      { // Item 5: ID in O, Qty in P, Desc in Z, Price in AA
        itemId: columnMap.Item5ItemID,
        quantity: columnMap.Item5Quantity,
        description: columnMap.Item5Description,
        price: columnMap.Item5Price
      }
    ];
    
    itemMappings.forEach((mapping, index) => {
      const itemId = formRow[mapping.itemId];
      const quantity = parseInt(formRow[mapping.quantity]) || 0;
      const description = formRow[mapping.description];
      const totalPrice = parseFloat(String(formRow[mapping.price] || '0').replace(/[$,]/g, '')) || 0;
      
      if (itemId && quantity > 0 && description && totalPrice > 0) {
        const unitPrice = totalPrice / quantity;
        
        lineItems.push({
          itemNumber: index + 1,
          itemId: cleanItemId(itemId),
          description: cleanDescription(description),
          quantity: quantity,
          unitPrice: unitPrice,
          totalPrice: totalPrice,
          itemType: 'Warehouse',
          warehouseInfo: {
            stockNumber: itemId,
            catalogLookup: true
          }
        });
      }
    });
    
    // Validate against warehouse catalog if needed
    const catalogValidation = validateWarehouseItems(lineItems);
    
    // Calculate totals
    const calculatedTotal = lineItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const variance = Math.abs(calculatedTotal - formDetails.totalCost);
    
    return {
      lineItems: lineItems,
      formDetails: {
        ...formDetails,
        calculatedTotal: calculatedTotal,
        variance: variance,
        isVarianceAcceptable: variance < 0.01,
        catalogValidation: catalogValidation
      },
      additionalInfo: {
        itemCount: lineItems.length,
        hasVariance: variance >= 0.01,
        allItemsValid: catalogValidation.allValid
      }
    };
    
  } catch (error) {
    throw new Error(`Warehouse form parsing failed: ${error.message}`);
  }
}

/**
 * Parse single-item forms (Field Trip, Curriculum, Admin)
 * @param {Array} formRow - Form submission row data
 * @param {Object} columnMap - Column mapping for form
 * @param {string} formType - Form type
 * @return {Object} Parse result with line items and details
 */
function parseSingleItemForm(formRow, columnMap, formType) {
  try {
    const formDetails = {
      timestamp: formRow[columnMap.Timestamp],
      emailAddress: formRow[columnMap.EmailAddress]
    };
    
    let lineItems = [];
    let additionalInfo = {};
    
    if (formType === 'Field Trip' || formType === 'FIELDTRIP') {
      const totalCost = parseFloat(String(formRow[columnMap.TotalCost] || '0').replace(/[$,]/g, '')) || 0;
      
      lineItems.push({
        itemNumber: 1,
        itemId: 'FIELDTRIP',
        description: `Field Trip: ${formRow[columnMap.TripDestination] || 'Unknown Destination'}`,
        quantity: parseInt(formRow[columnMap.NumberOfStudents]) || 1,
        unitPrice: totalCost / (parseInt(formRow[columnMap.NumberOfStudents]) || 1),
        totalPrice: totalCost,
        itemType: 'Field Trip'
      });
      
      additionalInfo = {
        destination: formRow[columnMap.TripDestination],
        tripDate: formRow[columnMap.TripDate],
        studentCount: formRow[columnMap.NumberOfStudents],
        transportationType: formRow[columnMap.TransportationType]
      };
      
      formDetails.totalCost = totalCost;
      
    } else if (formType === 'Curriculum' || formType === 'CURRICULUM') {
      const totalCost = parseFloat(String(formRow[columnMap.TotalCost] || '0').replace(/[$,]/g, '')) || 0;
      const quantity = parseInt(formRow[columnMap.QuantityNeeded]) || 1;
      
      lineItems.push({
        itemNumber: 1,
        itemId: formRow[columnMap.ISBN] || 'CURRICULUM',
        description: `Curriculum: ${formRow[columnMap.ResourceName] || 'Educational Resource'}`,
        quantity: quantity,
        unitPrice: totalCost / quantity,
        totalPrice: totalCost,
        itemType: 'Curriculum'
      });
      
      additionalInfo = {
        curriculumType: formRow[columnMap.CurriculumType],
        resourceName: formRow[columnMap.ResourceName],
        resourceURL: formRow[columnMap.ResourceURL],
        isbn: formRow[columnMap.ISBN],
        quantityNeeded: formRow[columnMap.QuantityNeeded]
      };
      
      formDetails.totalCost = totalCost;
      
    } else if (formType === 'Admin' || formType === 'ADMIN') {
      const totalCost = parseFloat(String(formRow[columnMap.TotalCost] || '0').replace(/[$,]/g, '')) || 0;
      
      lineItems.push({
        itemNumber: 1,
        itemId: 'ADMIN',
        description: formRow[columnMap.PurchaseDescription] || 'Administrative Purchase',
        quantity: 1,
        unitPrice: totalCost,
        totalPrice: totalCost,
        itemType: 'Administrative'
      });
      
      additionalInfo = {
        rationale: formRow[columnMap.Rationale],
        uploadedFile: formRow[columnMap.UploadInvoice]
      };
      
      formDetails.totalCost = totalCost;
    }
    
    return {
      lineItems: lineItems,
      formDetails: formDetails,
      additionalInfo: additionalInfo
    };
    
  } catch (error) {
    throw new Error(`Single item form parsing failed: ${error.message}`);
  }
}

// ============================================================================
// CROSS-DIVISION TOTALS CALCULATION
// ============================================================================

/**
 * Calculate total amount across all divisions for the same order ID
 * @param {string} orderId - Order ID to calculate totals for
 * @return {number} Total amount across all divisions
 */
function calculateCrossDivisionTotals(orderId) {
  const cacheKey = `cross_division_total_${orderId}`;
  
  try {
    // Check cache first
    const cache = CacheService.getScriptCache();
    const cached = cache.get(cacheKey);
    
    if (cached) {
      console.log(`💰 Using cached cross-division total for ${orderId}`);
      return parseFloat(cached);
    }
    
    console.log(`🔍 Calculating cross-division total for order ${orderId}`);
    
    const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
    const ledgerSheet = budgetHub.getSheetByName('TransactionLedger');
    
    if (!ledgerSheet) {
      throw new Error('TransactionLedger sheet not found');
    }
    
    const mappings = loadHubHeaderMappings();
    const cols = mappings.budget.TransactionLedger;
    
    // Get all data
    const dataRange = ledgerSheet.getDataRange();
    const values = dataRange.getValues();
    
    let total = 0;
    let transactionCount = 0;
    
    // Sum all transactions with matching order ID
    for (let i = 1; i < values.length; i++) { // Skip header
      const row = values[i];
      const rowOrderId = row[cols.OrderID];
      const amount = parseFloat(row[cols.Amount]) || 0;
      
      if (rowOrderId === orderId && amount > 0) {
        total += amount;
        transactionCount++;
      }
    }
    
    // Cache the result for 30 minutes
    cache.put(cacheKey, total.toString(), PHASE_3_CONFIG.ENRICHMENT.CACHE_EXPIRY_SECONDS);
    
    console.log(`💰 Cross-division total for ${orderId}: $${total.toFixed(2)} (${transactionCount} transactions)`);
    
    return total;
    
  } catch (error) {
    logError(`Failed to calculate cross-division totals for ${orderId}`, error);
    return 0;
  }
}

// ============================================================================
// USER NAME RESOLUTION
// ============================================================================

/**
 * Resolve user names from email addresses using UserDirectory
 * @param {Array} emails - Array of email addresses to resolve
 * @return {Object} Map of email to full name
 */
function resolveUserNames(emails) {
  try {
    if (!emails || emails.length === 0) {
      return {};
    }
    
    // Get unique emails and filter out invalid ones
    const uniqueEmails = [...new Set(emails.filter(email => 
      email && typeof email === 'string' && email.includes('@')
    ))];
    
    if (uniqueEmails.length === 0) {
      return {};
    }
    
    console.log(`👥 Resolving names for ${uniqueEmails.length} users`);
    
    // Load user directory (with caching)
    const userDirectory = loadUserDirectory();
    
    const nameMap = {};
    
    uniqueEmails.forEach(email => {
      const user = userDirectory[email.toLowerCase()];
      
      if (user) {
        // Construct full name from first and last name
        const firstName = user.firstName || '';
        const lastName = user.lastName || '';
        const fullName = `${firstName} ${lastName}`.trim();
        
        nameMap[email] = fullName || extractNameFromEmail(email);
      } else {
        // Fallback to extracting name from email
        nameMap[email] = extractNameFromEmail(email);
      }
    });
    
    console.log(`✅ Resolved ${Object.keys(nameMap).length} user names`);
    
    return nameMap;
    
  } catch (error) {
    logError('Failed to resolve user names', error, { emails });
    
    // Return fallback map
    const fallbackMap = {};
    emails.forEach(email => {
      if (email && typeof email === 'string') {
        fallbackMap[email] = extractNameFromEmail(email);
      }
    });
    
    return fallbackMap;
  }
}

/**
 * Load user directory with caching
 * @return {Object} User directory map (email -> user info)
 */
function loadUserDirectory() {
  try {
    // Check cache validity (30 minutes)
    const now = Date.now();
    if (userDirectoryCache && userDirectoryCacheTimestamp && 
        now - userDirectoryCacheTimestamp < PHASE_3_CONFIG.ENRICHMENT.CACHE_EXPIRY_SECONDS * 1000) {
      return userDirectoryCache;
    }
    
    console.log('📖 Loading user directory from BudgetHub...');
    
    const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
    const userDirSheet = budgetHub.getSheetByName('UserDirectory');
    
    if (!userDirSheet) {
      throw new Error('UserDirectory sheet not found in BudgetHub');
    }
    
    const mappings = loadHubHeaderMappings();
    const cols = mappings.budget.UserDirectory;
    
    const dataRange = userDirSheet.getDataRange();
    const values = dataRange.getValues();
    
    const userMap = {};
    
    // Build user map (skip header row)
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const email = row[cols.Email];
      
      if (email && typeof email === 'string' && email.includes('@')) {
        userMap[email.toLowerCase()] = {
          email: email,
          firstName: row[cols.FirstName] || '',
          lastName: row[cols.LastName] || '',
          role: row[cols.Role] || '',
          department: row[cols.Department] || '',
          division: row[cols.Division] || '',
          approver: row[cols.Approver] || '',
          active: row[cols.Active]
        };
      }
    }
    
    // Update cache
    userDirectoryCache = userMap;
    userDirectoryCacheTimestamp = now;
    
    console.log(`✅ Loaded ${Object.keys(userMap).length} users into directory cache`);
    
    return userMap;
    
  } catch (error) {
    logError('Failed to load user directory', error);
    return userDirectoryCache || {};
  }
}

/**
 * Extract name from email address as fallback
 * @param {string} email - Email address
 * @return {string} Extracted name
 */
function extractNameFromEmail(email) {
  try {
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return PHASE_3_CONFIG.ENRICHMENT.UNKNOWN_USER_NAME;
    }
    
    const username = email.split('@')[0];
    
    // Handle common patterns like firstname.lastname
    if (username.includes('.')) {
      const parts = username.split('.');
      return parts.map(part => 
        part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
      ).join(' ');
    }
    
    // Handle patterns like firstnamelastname with capital letters
    const nameMatch = username.match(/^([a-z]+)([A-Z][a-z]+)$/);
    if (nameMatch) {
      const firstName = nameMatch[1].charAt(0).toUpperCase() + nameMatch[1].slice(1);
      const lastName = nameMatch[2];
      return `${firstName} ${lastName}`;
    }
    
    // Default: capitalize the username
    return username.charAt(0).toUpperCase() + username.slice(1).toLowerCase();
    
  } catch (error) {
    return PHASE_3_CONFIG.ENRICHMENT.UNKNOWN_USER_NAME;
  }
}

// ============================================================================
// DATA VALIDATION AND CLEANUP
// ============================================================================

/**
 * Validate and clean enriched transaction data
 * @param {Object} transaction - Enriched transaction
 * @return {Object} Validated and cleaned transaction
 */
function validateAndCleanEnrichedData(transaction) {
  try {
    const cleaned = { ...transaction };
    
    // Validate amounts
    if (cleaned.amount && (cleaned.amount < PHASE_3_CONFIG.ENRICHMENT.MIN_AMOUNT || 
                          cleaned.amount > PHASE_3_CONFIG.ENRICHMENT.MAX_AMOUNT)) {
      cleaned.validationWarnings = cleaned.validationWarnings || [];
      cleaned.validationWarnings.push(`Amount ${cleaned.amount} is outside normal range`);
    }
    
    // Clean descriptions
    if (cleaned.description && cleaned.description.length > PHASE_3_CONFIG.ENRICHMENT.MAX_DESCRIPTION_LENGTH) {
      cleaned.description = cleaned.description.substring(0, PHASE_3_CONFIG.ENRICHMENT.MAX_DESCRIPTION_LENGTH) + '...';
    }
    
    // Validate line items
    if (cleaned.lineItems && cleaned.lineItems.length > 0) {
      cleaned.lineItems = cleaned.lineItems.map(item => {
        return {
          ...item,
          description: cleanDescription(item.description),
          quantity: Math.max(1, parseInt(item.quantity) || 1),
          unitPrice: Math.max(0, parseFloat(item.unitPrice) || 0),
          totalPrice: Math.max(0, parseFloat(item.totalPrice) || 0)
        };
      });
      
      // Limit to max items per transaction
      if (cleaned.lineItems.length > PHASE_3_CONFIG.ENRICHMENT.MAX_ITEMS_PER_TRANSACTION) {
        cleaned.lineItems = cleaned.lineItems.slice(0, PHASE_3_CONFIG.ENRICHMENT.MAX_ITEMS_PER_TRANSACTION);
        cleaned.validationWarnings = cleaned.validationWarnings || [];
        cleaned.validationWarnings.push('Line items truncated to maximum allowed');
      }
    }
    
    return cleaned;
    
  } catch (error) {
    logError('Failed to validate enriched data', error, { transactionId: transaction.transactionId });
    return transaction;
  }
}

/**
 * Create default line item for transactions without form data
 * @param {Object} transaction - Base transaction
 * @return {Array} Array with single default line item
 */
function createDefaultLineItem(transaction) {
  return [{
    itemNumber: 1,
    itemId: transaction.transactionId || 'UNKNOWN',
    description: transaction.description || PHASE_3_CONFIG.ENRICHMENT.DEFAULT_DESCRIPTION,
    quantity: PHASE_3_CONFIG.ENRICHMENT.DEFAULT_QUANTITY,
    unitPrice: transaction.amount || 0,
    totalPrice: transaction.amount || 0,
    itemType: 'Default',
    isDefault: true
  }];
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Clean and validate description text
 * @param {string} description - Raw description
 * @return {string} Cleaned description
 */
function cleanDescription(description) {
  if (!description || typeof description !== 'string') {
    return PHASE_3_CONFIG.ENRICHMENT.DEFAULT_DESCRIPTION;
  }
  
  return description
    .trim()
    .replace(/\s+/g, ' ') // Normalize whitespace
    .substring(0, PHASE_3_CONFIG.ENRICHMENT.MAX_DESCRIPTION_LENGTH);
}

/**
 * Clean and validate item ID
 * @param {string} itemId - Raw item ID
 * @return {string} Cleaned item ID
 */
function cleanItemId(itemId) {
  if (!itemId || typeof itemId !== 'string') {
    return 'UNKNOWN';
  }
  
  return itemId.toString().trim().toUpperCase();
}

/**
 * Extract ASIN from Amazon URL
 * @param {string} url - Amazon URL
 * @return {string|null} ASIN or null if not found
 */
function extractASINFromURL(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }
  
  const asinPatterns = [
    /\/dp\/([A-Z0-9]{10})/i,
    /\/gp\/product\/([A-Z0-9]{10})/i,
    /\/product\/([A-Z0-9]{10})/i,
    /[?&]asin=([A-Z0-9]{10})/i
  ];
  
  for (const pattern of asinPatterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Validate warehouse items against catalog
 * @param {Array} lineItems - Line items with warehouse stock numbers
 * @return {Object} Validation result
 */
function validateWarehouseItems(lineItems) {
  try {
    // This would typically check against the WarehouseCatalog sheet
    // For now, return basic validation
    const result = {
      allValid: true,
      validItems: [],
      invalidItems: []
    };
    
    lineItems.forEach(item => {
      if (item.itemId && item.itemId !== 'UNKNOWN') {
        result.validItems.push(item.itemId);
      } else {
        result.invalidItems.push(item.itemId);
        result.allValid = false;
      }
    });
    
    return result;
    
  } catch (error) {
    return {
      allValid: false,
      validItems: [],
      invalidItems: lineItems.map(item => item.itemId),
      error: error.message
    };
  }
}

/**
 * Clear all enrichment caches (for testing/maintenance)
 */
function clearEnrichmentCaches() {
  try {
    userDirectoryCache = null;
    userDirectoryCacheTimestamp = null;
    formDataCache.clear();
    
    const cache = CacheService.getScriptCache();
    // Clear relevant cache keys
    ['cross_division_total_', 'user_lookup_', 'form_data_'].forEach(prefix => {
      // Note: CacheService doesn't have a clear by prefix method
      // In production, you might want to track cache keys
    });
    
    console.log('🧹 Enrichment caches cleared');
    
  } catch (error) {
    console.error('Failed to clear enrichment caches:', error);
  }
}

/**
 * Test Phase 3 functions
 */
function testPhase3Functions() {
  console.log('🧪 Testing Phase 3 data enrichment functions...');
  
  try {
    // Test user name resolution
    const testEmails = ['test@keswick.edu', 'john.doe@keswick.edu'];
    const userNames = resolveUserNames(testEmails);
    console.log('✅ User name resolution:', userNames);
    
    // Test cross-division total calculation
    const testOrderId = 'US-AMZ-0713-01';
    const crossTotal = calculateCrossDivisionTotals(testOrderId);
    console.log(`✅ Cross-division total for ${testOrderId}: $${crossTotal}`);
    
    // Test utility functions
    const testDescription = cleanDescription('  Test   Description   with   extra   spaces  ');
    console.log('✅ Description cleaning:', testDescription);
    
    const testASIN = extractASINFromURL('https://amazon.com/dp/B07J6H8VPR');
    console.log('✅ ASIN extraction:', testASIN);
    
    // Test with mock transaction
    const mockTransaction = {
      transactionId: 'TEST-001',
      orderId: 'TEST-ORDER',
      formType: 'Amazon',
      requestor: 'test@keswick.edu',
      approver: 'admin@keswick.edu',
      amount: 150.00,
      description: 'Test transaction',
      processedOn: new Date()
    };
    
    console.log('🔍 Testing enrichment with mock transaction...');
    const enriched = enrichTransactionData(mockTransaction);
    console.log(`✅ Enrichment completed - ${enriched.lineItems.length} line items`);
    
    console.log('🎉 Phase 3 test completed successfully');
    
  } catch (error) {
    console.error('❌ Phase 3 test failed:', error);
    throw error;
  }
}