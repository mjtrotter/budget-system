// ============================================================================
// INVOICING SYSTEM PHASE 4 - INTELLIGENT PROCESSING ENGINE
// ============================================================================
// Production-ready processing engine with smart batching, warehouse aggregation,
// template selection, and form-specific processing rules.
// ============================================================================

// ============================================================================
// PHASE 4 EXTENSIONS TO CONFIG
// ============================================================================
const PHASE_4_CONFIG = {
  // Batching Configuration
  BATCHING: {
    MAX_LINE_ITEMS_PER_BATCH: 10,
    MAX_TRANSACTIONS_PER_BATCH: 20,
    MIN_BATCH_SIZE: 2,
    
    // Batch priority (higher = processed first)
    PRIORITY: {
      'Admin': 100,
      'ADMIN': 100,
      'Field Trip': 90,
      'FIELDTRIP': 90,
      'Curriculum': 80,
      'CURRICULUM': 80,
      'Amazon': 70,
      'AMAZON': 70,
      'Warehouse': 60,
      'WAREHOUSE': 60
    }
  },
  
  // Template Selection Rules
  TEMPLATES: {
    'Amazon': 'batch_internal_template',
    'AMAZON': 'batch_internal_template',
    'Warehouse': 'batch_internal_template',
    'WAREHOUSE': 'batch_internal_template',
    'Field Trip': 'single_internal_template',
    'FIELDTRIP': 'single_internal_template',
    'Curriculum': 'single_internal_template',
    'CURRICULUM': 'single_internal_template',
    'Admin': 'single_internal_template',
    'ADMIN': 'single_internal_template',
    'warehouse_external': 'warehouse_external_template'
  },
  
  // Signature Rules
  SIGNATURE_RULES: {
    'Amazon': 'principal',
    'AMAZON': 'principal',
    'Warehouse': 'principal', 
    'WAREHOUSE': 'principal',
    'Field Trip': 'principal',
    'FIELDTRIP': 'principal',
    'Curriculum': 'principal',
    'CURRICULUM': 'principal',
    'Admin': 'admin',
    'ADMIN': 'admin'
  },
  
  // Processing Days
  WAREHOUSE_EXTERNAL_DAY: 4, // Thursday (0=Sunday)
  
  // Aggregation Settings
  AGGREGATION: {
    WAREHOUSE_EXTERNAL: true,
    AMAZON_EXTERNAL: false,
    COMBINE_SAME_ITEMS: true,
    MIN_QUANTITY_THRESHOLD: 0.01
  }
};

// ============================================================================
// MAIN BATCH PROCESSING FUNCTION
// ============================================================================

/**
 * Process transactions with intelligent batching algorithm
 * @param {Array} transactions - Array of enriched transactions
 * @return {Object} Processing results
 */
function processBatchTransactions(transactions) {
  const startTime = Date.now();
  
  try {
    console.log(`🚀 Processing ${transactions.length} transactions with intelligent batching`);
    
    if (!transactions || transactions.length === 0) {
      return {
        success: true,
        processed: 0,
        batches: [],
        singles: [],
        errors: []
      };
    }
    
    const results = {
      success: true,
      processed: 0,
      successful: 0,
      failed: 0,
      batches: [],
      singles: [],
      errors: [],
      processingTime: 0
    };
    
    // Step 1: Sort and group transactions
    const groupedTransactions = groupTransactionsByBatchingRules(transactions);
    
    // Step 2: Create optimal batches for each group
    const processableGroups = [];
    
    Object.entries(groupedTransactions).forEach(([groupKey, group]) => {
      if (group.canBatch && group.transactions.length > 1) {
        // Create optimal batches for this group
        const batches = createOptimalBatches(group.transactions, PHASE_4_CONFIG.BATCHING.MAX_LINE_ITEMS_PER_BATCH);
        batches.forEach(batch => {
          processableGroups.push({
            type: 'batch',
            key: `${groupKey}_batch_${processableGroups.length}`,
            ...batch,
            formType: group.formType,
            division: group.division
          });
        });
      } else {
        // Process as individual transactions - FIXED totalAmount calculation
        group.transactions.forEach(transaction => {
          const lineItemTotal = (transaction.lineItems || []).reduce((sum, item) => sum + (item.totalPrice || item.amount || 0), 0);
          const transactionTotal = lineItemTotal || transaction.amount || 0;
          
          processableGroups.push({
            type: 'single',
            key: `${groupKey}_single_${transaction.transactionId}`,
            transactions: [transaction],
            lineItems: transaction.lineItems || [],
            totalAmount: transactionTotal, // FIXED: Calculate properly
            formType: group.formType,
            division: group.division
          });
        });
      }
    });
    
    // Step 3: Sort by priority
    processableGroups.sort((a, b) => {
      const priorityA = PHASE_4_CONFIG.BATCHING.PRIORITY[a.formType] || 50;
      const priorityB = PHASE_4_CONFIG.BATCHING.PRIORITY[b.formType] || 50;
      return priorityB - priorityA;
    });
    
    console.log(`📦 Created ${processableGroups.length} processable groups (${processableGroups.filter(g => g.type === 'batch').length} batches, ${processableGroups.filter(g => g.type === 'single').length} singles)`);
    
    // Step 4: Process each group
    processableGroups.forEach((group, index) => {
      try {
        results.processed++;
        
        let processResult;
        if (group.type === 'batch') {
          processResult = processBatchGroup(group);
          if (processResult.success) {
            results.batches.push(processResult);
            results.successful++;
          } else {
            results.failed++;
            results.errors.push(processResult.error);
            console.error(`❌ Batch processing failed for ${group.key}:`, processResult.error);
          }
        } else {
          processResult = processSingleGroup(group);
          if (processResult.success) {
            results.singles.push(processResult);
            results.successful++;
          } else {
            results.failed++;
            results.errors.push(processResult.error);
            console.error(`❌ Single processing failed for ${group.key}:`, processResult.error);
          }
        }
        
        // Brief pause between processing to avoid overwhelming services
        if (index < processableGroups.length - 1) {
          Utilities.sleep(500);
        }
        
      } catch (error) {
        results.failed++;
        results.errors.push({
          group: group.key,
          error: error.message,
          transactions: group.transactions.map(t => t.transactionId)
        });
        
        logError(`Failed to process group ${group.key}`, error, {
          groupType: group.type,
          transactionCount: group.transactions.length
        });
      }
    });
    
    results.processingTime = Date.now() - startTime;
    
    console.log(`✅ Batch processing completed: ${results.successful}/${results.processed} successful (${results.processingTime}ms)`);
    
    return results;
    
  } catch (error) {
    logError('Batch processing failed completely', error, { transactionCount: transactions.length });
    
    return {
      success: false,
      error: error.message,
      processed: 0,
      successful: 0,
      failed: transactions.length,
      batches: [],
      singles: [],
      errors: [error.message],
      processingTime: Date.now() - startTime
    };
  }
}

// ============================================================================
// TRANSACTION GROUPING FOR BATCHING
// ============================================================================

/**
 * Group transactions by batching rules (order > division > form type)
 * @param {Array} transactions - Enriched transactions
 * @return {Object} Grouped transactions
 */
function groupTransactionsByBatchingRules(transactions) {
  const groups = {};
  
  transactions.forEach(transaction => {
    // Determine grouping key based on batching rules
    const division = getDivisionFromTransaction(transaction);
    const formType = transaction.formType;
    const orderId = transaction.orderId;
    
    // Group key: OrderID_Division_FormType
    const groupKey = `${orderId}_${division}_${formType}`;
    
    if (!groups[groupKey]) {
      groups[groupKey] = {
        orderId: orderId,
        division: division,
        formType: formType,
        canBatch: canFormTypeBatch(formType),
        transactions: [],
        totalLineItems: 0
      };
    }
    
    groups[groupKey].transactions.push(transaction);
    groups[groupKey].totalLineItems += (transaction.lineItems || []).length;
  });
  
  return groups;
}

/**
 * Determine if form type can be batched
 * @param {string} formType - Form type
 * @return {boolean} Can batch
 */
function canFormTypeBatch(formType) {
  // Amazon and Warehouse can be batched, others are typically single items
  return ['Amazon', 'AMAZON', 'Warehouse', 'WAREHOUSE'].includes(formType);
}

// ============================================================================
// OPTIMAL BATCH CREATION
// ============================================================================

/**
 * Create optimal batches from line items with intelligent distribution
 * @param {Array} transactions - Transactions to batch
 * @param {number} maxLineItemsPerBatch - Maximum line items per batch
 * @return {Array} Array of batch objects
 */
function createOptimalBatches(transactions, maxLineItemsPerBatch) {
  try {
    // Collect all line items with transaction context
    const allLineItems = [];
    
    transactions.forEach(transaction => {
      const lineItems = transaction.lineItems || [];
      lineItems.forEach(lineItem => {
        allLineItems.push({
          ...lineItem,
          transactionId: transaction.transactionId,
          transaction: transaction,
          requestorName: transaction.requestorName,
          approverName: transaction.approverName
        });
      });
    });
    
    if (allLineItems.length === 0) {
      return [{
        transactions: transactions,
        lineItems: [],
        totalAmount: transactions.reduce((sum, t) => sum + (t.amount || 0), 0)
      }];
    }
    
    // Sort line items by transaction for better grouping
    allLineItems.sort((a, b) => {
      if (a.transactionId !== b.transactionId) {
        return a.transactionId.localeCompare(b.transactionId);
      }
      return (a.itemNumber || 0) - (b.itemNumber || 0);
    });
    
    const batches = [];
    let currentBatch = {
      transactions: new Set(),
      lineItems: [],
      totalAmount: 0
    };
    
    allLineItems.forEach(lineItem => {
      // Check if adding this line item would exceed the limit
      if (currentBatch.lineItems.length >= maxLineItemsPerBatch) {
        // Finalize current batch
        if (currentBatch.lineItems.length > 0) {
          batches.push(finalizeBatch(currentBatch));
        }
        
        // Start new batch
        currentBatch = {
          transactions: new Set(),
          lineItems: [],
          totalAmount: 0
        };
      }
      
      // Add line item to current batch
      currentBatch.lineItems.push(lineItem);
      currentBatch.transactions.add(lineItem.transaction);
      currentBatch.totalAmount += lineItem.totalPrice || 0;
    });
    
    // Don't forget the last batch
    if (currentBatch.lineItems.length > 0) {
      batches.push(finalizeBatch(currentBatch));
    }
    
    console.log(`📊 Created ${batches.length} optimal batches from ${allLineItems.length} line items`);
    
    return batches;
    
  } catch (error) {
    logError('Failed to create optimal batches', error);
    
    // Fallback: simple transaction-based batching
    const fallbackBatches = [];
    for (let i = 0; i < transactions.length; i += maxLineItemsPerBatch) {
      const batchTransactions = transactions.slice(i, i + maxLineItemsPerBatch);
      fallbackBatches.push({
        transactions: batchTransactions,
        lineItems: batchTransactions.flatMap(t => t.lineItems || []),
        totalAmount: batchTransactions.reduce((sum, t) => sum + (t.amount || 0), 0)
      });
    }
    
    return fallbackBatches;
  }
}

/**
 * Finalize batch object
 * @param {Object} batchData - Raw batch data
 * @return {Object} Finalized batch
 */
function finalizeBatch(batchData) {
  return {
    transactions: Array.from(batchData.transactions),
    lineItems: batchData.lineItems,
    totalAmount: batchData.totalAmount,
    itemCount: batchData.lineItems.length,
    transactionCount: batchData.transactions.size
  };
}

// ============================================================================
// WAREHOUSE EXTERNAL PROCESSING
// ============================================================================

/**
 * Process warehouse external orders (Thursday processing)
 * Pulls from AutomatedQueue, generates external orders, moves to TransactionLedger
 * @return {Object} Processing result
 */
function processWarehouseExternal() {
  const startTime = Date.now();
  
  try {
    console.log('🏭 Starting Thursday warehouse external processing');
    
    // Check if today is Thursday
    const today = new Date();
    if (today.getDay() !== PHASE_4_CONFIG.WAREHOUSE_EXTERNAL_DAY) {
      console.log(`⏭️ Skipping warehouse external processing (today is ${getDayName(today.getDay())}, need Thursday)`);
      return {
        success: true,
        skipped: true,
        reason: 'Not Thursday'
      };
    }
    
    // Step 1: Get approved warehouse transactions from AutomatedQueue
    const approvedWarehouseTransactions = getApprovedWarehouseTransactions();
    
    if (approvedWarehouseTransactions.length === 0) {
      console.log('📭 No approved warehouse transactions found');
      return {
        success: true,
        processed: 0,
        generated: 0,
        moved: 0
      };
    }
    
    console.log(`📦 Found ${approvedWarehouseTransactions.length} approved warehouse transactions`);
    
    // Step 2: Group by division for aggregation
    const divisionGroups = groupWarehouseByDivision(approvedWarehouseTransactions);
    
    const results = {
      success: true,
      processed: approvedWarehouseTransactions.length,
      generated: 0,
      moved: 0,
      externalOrders: [],
      errors: []
    };
    
    // Step 3: Process each division group
    Object.entries(divisionGroups).forEach(([division, transactions]) => {
      try {
        // Generate external order for this division
        const externalOrderResult = generateWarehouseExternalOrder(division, transactions);
        
        if (externalOrderResult.success) {
          results.generated++;
          results.externalOrders.push(externalOrderResult);
          
          // Move transactions to ledger and update status
          const moveResult = moveWarehouseTransactionsToLedger(transactions, externalOrderResult.orderId);
          results.moved += moveResult.moved;
          
          if (moveResult.errors.length > 0) {
            results.errors.push(...moveResult.errors);
          }
        } else {
          results.errors.push({
            division: division,
            error: externalOrderResult.error,
            transactions: transactions.map(t => t.transactionId)
          });
        }
        
      } catch (error) {
        results.errors.push({
          division: division,
          error: error.message,
          transactions: transactions.map(t => t.transactionId)
        });
        
        logError(`Failed to process warehouse external for division ${division}`, error);
      }
    });
    
    const processingTime = Date.now() - startTime;
    console.log(`✅ Warehouse external processing completed: ${results.generated} orders generated, ${results.moved} transactions moved (${processingTime}ms)`);
    
    return {
      ...results,
      processingTime: processingTime
    };
    
  } catch (error) {
    logError('Warehouse external processing failed', error);
    
    return {
      success: false,
      error: error.message,
      processed: 0,
      generated: 0,
      moved: 0,
      externalOrders: [],
      errors: [error.message],
      processingTime: Date.now() - startTime
    };
  }
}

/**
 * Get approved warehouse transactions from AutomatedQueue
 * @return {Array} Approved warehouse transactions
 */
function getApprovedWarehouseTransactions() {
  try {
    const autoHub = SpreadsheetApp.openById(CONFIG.AUTOMATED_HUB_ID);
    const queueSheet = autoHub.getSheetByName('AutomatedQueue');
    
    if (!queueSheet) {
      throw new Error('AutomatedQueue sheet not found');
    }
    
    const mappings = loadHubHeaderMappings();
    const cols = mappings.automated.AutomatedQueue;
    
    const dataRange = queueSheet.getDataRange();
    const values = dataRange.getValues();
    
    const approvedTransactions = [];
    
    for (let i = 1; i < values.length; i++) { // Skip header
      const row = values[i];
      
      if (row[cols.RequestType] === 'WAREHOUSE' && row[cols.Status] === 'APPROVED') {
        approvedTransactions.push({
          rowIndex: i,
          transactionId: row[cols.TransactionID],
          requestor: row[cols.Requestor],
          requestType: row[cols.RequestType],
          department: row[cols.Department],
          division: row[cols.Division],
          amount: row[cols.Amount],
          description: row[cols.Description],
          status: row[cols.Status],
          requested: row[cols.Requested],
          approved: row[cols.Approved],
          processed: row[cols.Processed],
          responseId: row[cols.ResponseID]
        });
      }
    }
    
    return approvedTransactions;
    
  } catch (error) {
    logError('Failed to get approved warehouse transactions', error);
    return [];
  }
}

/**
 * Group warehouse transactions by division
 * @param {Array} transactions - Warehouse transactions
 * @return {Object} Transactions grouped by division
 */
function groupWarehouseByDivision(transactions) {
  const groups = {};
  
  transactions.forEach(transaction => {
    const division = transaction.division || 'Administration';
    
    if (!groups[division]) {
      groups[division] = [];
    }
    
    groups[division].push(transaction);
  });
  
  return groups;
}

/**
 * Generate external warehouse order for a division
 * @param {string} division - Division name
 * @param {Array} transactions - Warehouse transactions for this division
 * @return {Object} Generation result
 */
function generateWarehouseExternalOrder(division, transactions) {
  try {
    console.log(`📄 Generating external warehouse order for ${division} (${transactions.length} transactions)`);
    
    // Step 1: Get detailed line items for all transactions
    const allLineItems = [];
    
    transactions.forEach(transaction => {
      const lineItems = getWarehouseLineItems(transaction);
      allLineItems.push(...lineItems);
    });
    
    // Step 2: Aggregate items by item ID (combine quantities for same items)
    const aggregatedItems = aggregateWarehouseItems(allLineItems);
    
    // Step 3: Generate order ID
    const orderId = generateWarehouseExternalOrderId(division);
    
    // Step 4: Prepare template data
    const templateData = prepareWarehouseExternalTemplateData({
      orderId: orderId,
      division: division,
      transactions: transactions,
      aggregatedItems: aggregatedItems,
      orderDate: new Date()
    });
    
    // Step 5: Generate PDF
    const template = selectTemplate('warehouse_external', aggregatedItems.length);
    const pdfResult = generatePDFFromTemplate(templateData, template);
    
    if (!pdfResult.success) {
      throw new Error(`PDF generation failed: ${pdfResult.error}`);
    }
    
    // Step 6: Save to Drive
    const fileUrl = saveWarehouseExternalOrder(pdfResult.blob, templateData);
    
    // Step 7: Send to vendor (business office)
    sendWarehouseExternalOrder(pdfResult.blob, templateData);
    
    console.log(`✅ External warehouse order generated: ${orderId}`);
    
    return {
      success: true,
      orderId: orderId,
      division: division,
      itemCount: aggregatedItems.length,
      totalAmount: aggregatedItems.reduce((sum, item) => sum + item.totalAmount, 0),
      fileUrl: fileUrl,
      transactionIds: transactions.map(t => t.transactionId)
    };
    
  } catch (error) {
    logError(`Failed to generate warehouse external order for ${division}`, error);
    
    return {
      success: false,
      error: error.message,
      division: division,
      transactionIds: transactions.map(t => t.transactionId)
    };
  }
}

/**
 * Aggregate warehouse items by item ID
 * @param {Array} lineItems - Individual line items
 * @return {Array} Aggregated items
 */
function aggregateWarehouseItems(lineItems) {
  const itemMap = new Map();
  
  lineItems.forEach(item => {
    const key = item.itemId;
    
    if (itemMap.has(key)) {
      const existing = itemMap.get(key);
      existing.totalQuantity += item.quantity;
      existing.totalAmount += item.totalPrice;
      existing.requestors.add(item.requestorName || 'Unknown');
    } else {
      itemMap.set(key, {
        itemId: item.itemId,
        description: item.description,
        unitPrice: item.unitPrice,
        totalQuantity: item.quantity,
        totalAmount: item.totalPrice,
        requestors: new Set([item.requestorName || 'Unknown'])
      });
    }
  });
  
  // Convert map to array and format
  return Array.from(itemMap.values()).map(item => ({
    ...item,
    requestors: Array.from(item.requestors).join(', '),
    requestorCount: item.requestors.size
  }));
}

/**
 * Move warehouse transactions to TransactionLedger and update status
 * @param {Array} transactions - Warehouse transactions
 * @param {string} orderId - Generated order ID
 * @return {Object} Move result
 */
function moveWarehouseTransactionsToLedger(transactions, orderId) {
  try {
    const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
    const ledgerSheet = budgetHub.getSheetByName('TransactionLedger');
    const autoHub = SpreadsheetApp.openById(CONFIG.AUTOMATED_HUB_ID);
    const queueSheet = autoHub.getSheetByName('AutomatedQueue');
    
    let moved = 0;
    const errors = [];
    
    transactions.forEach(transaction => {
      try {
        // Add to TransactionLedger
        const ledgerRow = [
          transaction.transactionId,
          orderId,
          new Date(), // ProcessedOn
          transaction.requestor,
          transaction.requestor, // Approver (warehouse uses requestor as approver for external)
          transaction.division,
          'Warehouse',
          transaction.amount,
          transaction.description,
          getCurrentFiscalQuarter(),
          '', // InvoiceGenerated (will be filled by internal processing)
          '', // InvoiceID
          ''  // InvoiceURL
        ];
        
        ledgerSheet.appendRow(ledgerRow);
        
        // Update status in AutomatedQueue to "ORDERED"
        queueSheet.getRange(transaction.rowIndex + 1, 8).setValue('ORDERED'); // Status column
        queueSheet.getRange(transaction.rowIndex + 1, 11).setValue(new Date()); // Processed column
        
        moved++;
        
      } catch (error) {
        errors.push({
          transactionId: transaction.transactionId,
          error: error.message
        });
      }
    });
    
    console.log(`📋 Moved ${moved}/${transactions.length} transactions to ledger`);
    
    return {
      moved: moved,
      total: transactions.length,
      errors: errors
    };
    
  } catch (error) {
    logError('Failed to move warehouse transactions to ledger', error);
    
    return {
      moved: 0,
      total: transactions.length,
      errors: [{ error: error.message }]
    };
  }
}

// ============================================================================
// TEMPLATE LOADING AND PROCESSING FUNCTIONS
// ============================================================================

/**
 * Load HTML template content from external files in Drive
 * @param {string} templateName - Name of the template to load
 * @return {string} HTML template content
 */
function loadHTMLTemplate(templateName) {
  try {
    console.log(`📄 Loading HTML template: ${templateName}`);
    
    // Map template names to actual filenames (without .html extension for HtmlService)
    const templateFiles = {
      'batch_internal_template': 'batch_internal_template',
      'single_internal_template': 'single_internal_template', 
      'warehouse_external_template': 'warehouse_external_template'
    };
    
    const filename = templateFiles[templateName];
    if (!filename) {
      throw new Error(`Unknown template: ${templateName}`);
    }
    
    // Use HtmlService to load template from Apps Script project
    console.log(`🔍 Loading template from Apps Script project: ${filename}`);
    
    try {
      const htmlTemplate = HtmlService.createTemplateFromFile(filename);
      const htmlContent = htmlTemplate.getCode();
      
      if (!htmlContent || htmlContent.trim().length === 0) {
        throw new Error(`Template file is empty: ${filename}`);
      }
      
      console.log(`✅ Template loaded successfully: ${filename} (${htmlContent.length} characters)`);
      return htmlContent;
      
    } catch (htmlServiceError) {
      console.log(`⚠️ HtmlService failed: ${htmlServiceError.message}`);
      throw new Error(`Template file not found in Apps Script project: ${filename}`);
    }
    
  } catch (error) {
    console.error(`Failed to load template: ${templateName}`, error);
    
    console.warn(`🔄 Falling back to built-in template for: ${templateName}`);
    // Return a template-specific fallback
    return getTemplateFallback(templateName);
  }
}

/**
 * Process HTML template with data - FIXED VERSION
 * @param {string} template - HTML template string
 * @param {Object} data - Data object
 * @return {string} Processed HTML
 */
function processHTMLTemplate(template, data) {
  try {
    console.log('🔄 Processing template with data substitution');
    
    // Method 1: Try HtmlService (often fails with complex templates)
    try {
      const htmlTemplate = HtmlService.createTemplate(template);
      htmlTemplate.data = data;
      const evaluated = htmlTemplate.evaluate().getContent();
      console.log('✅ Template processed with HtmlService');
      return evaluated;
    } catch (error) {
      console.log('Template processing failed with HtmlService, trying fallback', error);
      
      // Method 2: Simple string replacement
      let processed = template;
      
      // Replace <?= expressions ?>
      processed = processed.replace(/<\?=\s*(.*?)\s*\?>/g, (match, expression) => {
        try {
          // Handle data.field
          if (expression.startsWith('data.')) {
            const field = expression.substring(5).trim();
            
            // Handle nested properties
            const parts = field.split('.');
            let value = data;
            for (const part of parts) {
              value = value ? value[part] : '';
            }
            return value || '';
          }
          
          // Handle expressions with ||
          if (expression.includes('||')) {
            const alternatives = expression.split('||').map(alt => alt.trim());
            
            for (const alt of alternatives) {
              if (alt.startsWith('data.')) {
                const field = alt.substring(5).trim();
                if (data[field]) return data[field];
              } else if (alt.includes('Date()')) {
                return new Date().toLocaleDateString();
              } else {
                // Return literal string without quotes
                return alt.replace(/['"]/g, '');
              }
            }
            return '';
          }
          
          // Handle function calls
          if (expression === 'new Date().toLocaleDateString()') {
            return new Date().toLocaleDateString();
          }
          if (expression === 'new Date().toLocaleString()') {
            return new Date().toLocaleString();
          }
          
          // Handle numeric operations
          if (expression.includes('.toFixed(')) {
            const match = expression.match(/\(([^)]+)\)\.toFixed\((\d+)\)/);
            if (match) {
              const valueExpr = match[1];
              const decimals = parseInt(match[2]);
              
              if (valueExpr.startsWith('data.')) {
                const field = valueExpr.substring(5);
                const value = parseFloat(data[field] || 0);
                return value.toFixed(decimals);
              }
            }
          }
          
          return '';
        } catch (e) {
          console.error('Expression evaluation error:', e, expression);
          return '';
        }
      });
      
      // Handle conditionals - simplified approach
      // Remove <? if ?> blocks if condition is false
      processed = processed.replace(/<\?\s*if\s*\((.*?)\)\s*\{\s*\?>([\s\S]*?)<\?\s*\}\s*\?>/g, (match, condition, content) => {
        try {
          // Simple condition evaluation
          if (condition.startsWith('data.')) {
            const field = condition.substring(5).trim();
            return data[field] ? content : '';
          }
          return content; // Default to showing content
        } catch (e) {
          return content;
        }
      });
      
      // Handle forEach loops - for now, just remove them
      processed = processed.replace(/<\?\s*.*?forEach.*?\s*\?>/g, '');
      processed = processed.replace(/<\?\s*\}\);\s*\?>/g, '');
      
      console.log('✅ Fallback template processing completed');
      return processed;
    }
    
  } catch (error) {
    console.error('Template processing failed:', error);
    // Return original template as last resort
    return template;
  }
}

/**
 * Get template-specific fallback content
 * @param {string} templateName - Name of the template
 * @return {string} Fallback HTML content
 */
function getTemplateFallback(templateName) {
  const isBatch = templateName.includes('batch');
  const isWarehouse = templateName.includes('warehouse');
  
  if (isBatch) {
    return getBatchFallbackTemplate();
  } else if (isWarehouse) {
    return getWarehouseFallbackTemplate();
  } else {
    return getSingleFallbackTemplate();
  }
}

// ============================================================================
// TEMPLATE SELECTION ENGINE
// ============================================================================

/**
 * Select appropriate template based on form type and item count
 * @param {string} formType - Form type
 * @param {number} itemCount - Number of items/line items
 * @return {string} Template name
 */
function selectTemplate(formType, itemCount = 1) {
  try {
    // Special case for warehouse external
    if (formType === 'warehouse_external') {
      return PHASE_4_CONFIG.TEMPLATES.warehouse_external;
    }
    
    // Get base template for form type
    const baseTemplate = PHASE_4_CONFIG.TEMPLATES[formType];
    
    if (!baseTemplate) {
      console.warn(`Unknown form type for template selection: ${formType}`);
      return 'single_internal_template'; // Default fallback
    }
    
    // For Amazon and Warehouse, use batch template if multiple items
    if (['Amazon', 'AMAZON', 'Warehouse', 'WAREHOUSE'].includes(formType)) {
      return itemCount > 1 ? 'batch_internal_template' : 'single_internal_template';
    }
    
    // Other form types typically use single template
    return baseTemplate;
    
  } catch (error) {
    logError('Template selection failed', error, { formType, itemCount });
    return 'single_internal_template'; // Safe fallback
  }
}

// ============================================================================
// TEMPLATE DATA PREPARATION
// ============================================================================

/**
 * Prepare template data for invoice generation
 * @param {Object} batch - Batch or single transaction data
 * @param {string} template - Selected template name
 * @return {Object} Prepared template data
 */
function prepareTemplateData(batch, template) {
  try {
    console.log(`🔧 Preparing template data for template: ${template}`);
    console.log(`📊 Batch data keys: ${Object.keys(batch).join(', ')}`);
    
    const isBatch = batch.transactions && batch.transactions.length > 1;
    const primaryTransaction = batch.transactions[0];
    
    if (!primaryTransaction) {
      throw new Error('No primary transaction found in batch data');
    }
    
    console.log(`📋 Primary transaction keys: ${Object.keys(primaryTransaction).join(', ')}`);
    
    const division = getDivisionFromTransaction(primaryTransaction);
    const formType = primaryTransaction.formType || batch.formType;
    
    if (!formType) {
      console.warn(`⚠️ formType is missing from both primary transaction and batch data`);
      console.warn(`Primary transaction: ${JSON.stringify(primaryTransaction, null, 2)}`);
      console.warn(`Batch data: ${JSON.stringify(batch, null, 2)}`);
      throw new Error(`formType is missing from transaction ${primaryTransaction.transactionId || 'UNKNOWN'}`);
    }
    
    console.log(`✅ Extracted formType: ${formType}, division: ${division}`);
    
    // Generate invoice ID
    const invoiceId = generateInvoiceId(primaryTransaction, false);
    
    // Calculate total amount properly
    const calculatedTotal = batch.totalAmount || 
      (batch.lineItems?.reduce((sum, item) => sum + (item.totalPrice || item.amount || 0), 0)) ||
      (batch.transactions?.reduce((sum, txn) => sum + (txn.amount || 0), 0)) || 0;
    
    // Base template data
    const templateData = {
      // Invoice identification
      invoiceId: invoiceId,
      invoiceNumber: invoiceId,
      invoiceDate: formatDate(new Date()),
      
      // Batch/single info
      isBatch: isBatch,
      isAdmin: ['Admin', 'ADMIN'].includes(formType),
      
      // Division and organization
      division: division,
      divisionName: division,
      divisionCode: getDivisionCode(division),
      
      // Financial - FIXED CALCULATION
      totalAmount: calculatedTotal,
      amount: calculatedTotal,
      
      // Form type
      formType: formType,
      typeLabel: getFormTypeLabel(formType),
      
      // School information
      schoolName: CONFIG.SCHOOL_NAME || 'Keswick Christian School',
      schoolAddress: CONFIG.SCHOOL_ADDRESS || '',
      schoolCityStateZip: CONFIG.SCHOOL_CITY_STATE_ZIP || '',
      schoolPhone: CONFIG.SCHOOL_PHONE || '',
      schoolTaxId: CONFIG.SCHOOL_TAX_ID || '',
      
      // Visual elements
      logoBase64: getSchoolLogoBase64(),
      
      // Line items
      lineItems: batch.lineItems || [],
      transactions: batch.transactions || [primaryTransaction]
    };
    
    // Add template-specific data
    if (template === 'batch_internal_template') {
      templateData.batchTotal = templateData.totalAmount;
      templateData.orderId = primaryTransaction.orderId;
      templateData.orderTotal = calculateCrossDivisionTotals(primaryTransaction.orderId);
      templateData.batchNumber = 1;
      templateData.totalBatches = 1;
      templateData.transactionCount = batch.transactions.length;
      
    } else if (template === 'single_internal_template') {
      templateData.transactionId = primaryTransaction.transactionId;
      templateData.description = primaryTransaction.description;
      templateData.quantity = 1;
      templateData.unitPrice = templateData.totalAmount;
      
      // Requestor info (not for admin forms)
      if (!templateData.isAdmin) {
        templateData.requestorName = primaryTransaction.requestorName;
        templateData.requestorSignatureBase64 = null;
      }
      
    } else if (template === 'warehouse_external_template') {
      templateData.orderNumber = templateData.invoiceId;
      templateData.orderDate = templateData.invoiceDate;
      templateData.vendorName = 'Warehouse Supplier';
      templateData.aggregatedItems = batch.aggregatedItems || [];
      templateData.orderTotal = templateData.totalAmount;
      templateData.authorizerName = getDivisionSignatory(division);
      templateData.authorizerTitle = getDivisionSignatoryTitle(division);
    }
    
    // Add signature based on form type
    const signatureRule = PHASE_4_CONFIG.SIGNATURE_RULES[formType] || 'principal';
    
    if (signatureRule === 'admin') {
      // Admin signature for admin forms
      templateData.approverSignatureBase64 = getAdminSignatureBase64(primaryTransaction.approver);
      templateData.approverName = primaryTransaction.approverName;
      templateData.approverTitle = 'Administrator';
    } else {
      // Principal signature for other forms
      templateData.signatureBase64 = getDivisionSignatureBase64(getDivisionCode(division));
      templateData.approverSignatureBase64 = templateData.signatureBase64;
      templateData.principalName = getDivisionSignatory(division);
      templateData.principalTitle = getDivisionSignatoryTitle(division);
      templateData.approverName = templateData.principalName;
      templateData.approverTitle = templateData.principalTitle;
    }
    
    return templateData;
    
  } catch (error) {
    logError('Template data preparation failed', error, { formType, division, batch });
    
    // Return minimal template data
    return {
      invoiceId: 'UNKNOWN',
      invoiceDate: new Date().toLocaleDateString(),
      totalAmount: '0.00',
      error: error.message
    };
  }
}

/**
 * Get a batch-specific fallback template
 * @return {string} Batch HTML template
 */
function getBatchFallbackTemplate() {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; font-size: 10pt; }
        .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #1b5e3f; padding-bottom: 10px; }
        .batch-info { background: #f8f9fa; padding: 15px; margin-bottom: 20px; border-radius: 5px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
        th, td { border: 1px solid #ddd; padding: 6px; text-align: left; font-size: 9pt; }
        th { background-color: #1b5e3f; color: white; }
        .total { font-size: 14pt; font-weight: bold; text-align: right; color: #1b5e3f; }
        .signature { margin-top: 30px; text-align: right; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>BATCH INVOICE</h1>
        <p>Invoice ID: <?= data.invoiceId ?></p>
        <p>Date: <?= data.invoiceDate ?></p>
      </div>
      
      <div class="batch-info">
        <p><strong>Division:</strong> <?= data.division ?></p>
        <p><strong>Form Type:</strong> <?= data.formType ?></p>
        <p><strong>Total Transactions:</strong> <?= (data.transactions && data.transactions.length) || 1 ?></p>
        <p><strong>Total Items:</strong> <?= (data.lineItems && data.lineItems.length) || 0 ?></p>
      </div>
      
      <? if (data.transactions && data.transactions.length > 0) { ?>
      <h3>Transactions</h3>
      <table>
        <thead>
          <tr>
            <th>Transaction ID</th>
            <th>Description</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <? data.transactions.forEach(function(transaction) { ?>
          <tr>
            <td><?= transaction.transactionId ?></td>
            <td><?= transaction.description ?></td>
            <td>$<?= (transaction.amount || 0).toFixed(2) ?></td>
          </tr>
          <? }); ?>
        </tbody>
      </table>
      <? } ?>
      
      <? if (data.lineItems && data.lineItems.length > 0) { ?>
      <h3>Line Items</h3>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Description</th>
            <th>Quantity</th>
            <th>Unit Price</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          <? data.lineItems.forEach(function(item, index) { ?>
          <tr>
            <td><?= index + 1 ?></td>
            <td><?= item.description || item.name ?></td>
            <td><?= item.quantity || 1 ?></td>
            <td>$<?= (item.unitPrice || item.price || 0).toFixed(2) ?></td>
            <td>$<?= (item.totalPrice || (item.quantity || 1) * (item.unitPrice || item.price || 0)).toFixed(2) ?></td>
          </tr>
          <? }); ?>
        </tbody>
      </table>
      <? } ?>
      
      <div class="total">
        <h3>Total Amount: $<?= (data.totalAmount || 0).toFixed(2) ?></h3>
      </div>
      
      <div class="signature">
        <p>Processed Date: <?= new Date().toLocaleDateString() ?></p>
        <p>Digital Signature: <?= data.signatureName || 'Authorized' ?></p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Get a single-specific fallback template
 * @return {string} Single HTML template
 */
function getSingleFallbackTemplate() {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #1b5e3f; padding-bottom: 15px; }
        .invoice-details { margin-bottom: 20px; background: #f8f9fa; padding: 15px; border-radius: 5px; }
        .detail-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
        .label { font-weight: bold; color: #1b5e3f; }
        .total { font-size: 18pt; font-weight: bold; text-align: center; color: #1b5e3f; margin: 20px 0; }
        .signature { margin-top: 40px; text-align: right; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1><?= data.isAdmin ? 'ADMINISTRATIVE' : 'INTERNAL' ?> INVOICE</h1>
        <p>Invoice ID: <?= data.invoiceId ?></p>
        <p>Date: <?= data.invoiceDate ?></p>
      </div>
      
      <div class="invoice-details">
        <div class="detail-row">
          <span class="label">Transaction ID:</span>
          <span><?= data.transactionId ?></span>
        </div>
        <div class="detail-row">
          <span class="label">Division:</span>
          <span><?= data.division ?></span>
        </div>
        <div class="detail-row">
          <span class="label">Form Type:</span>
          <span><?= data.formType ?></span>
        </div>
        <div class="detail-row">
          <span class="label">Requestor:</span>
          <span><?= data.requestor ?></span>
        </div>
        <div class="detail-row">
          <span class="label">Approver:</span>
          <span><?= data.approver ?></span>
        </div>
        <div class="detail-row">
          <span class="label">Description:</span>
          <span><?= data.description ?></span>
        </div>
      </div>
      
      <div class="total">
        Total Amount: $<?= (data.totalAmount || 0).toFixed(2) ?>
      </div>
      
      <div class="signature">
        <p>Processed Date: <?= new Date().toLocaleDateString() ?></p>
        <p>Digital Signature: <?= data.signatureName || 'Authorized' ?></p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Get a warehouse-specific fallback template
 * @return {string} Warehouse HTML template
 */
function getWarehouseFallbackTemplate() {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; font-size: 10pt; }
        .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #2e7d32; padding-bottom: 10px; }
        .warehouse-info { background: #e8f5e8; padding: 15px; margin-bottom: 20px; border-radius: 5px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
        th, td { border: 1px solid #ddd; padding: 6px; text-align: left; font-size: 9pt; }
        th { background-color: #2e7d32; color: white; }
        .total { font-size: 14pt; font-weight: bold; text-align: right; color: #2e7d32; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>WAREHOUSE EXTERNAL INVOICE</h1>
        <p>Invoice ID: <?= data.invoiceId ?></p>
        <p>Date: <?= data.invoiceDate ?></p>
      </div>
      
      <div class="warehouse-info">
        <p><strong>Processing Type:</strong> Warehouse External</p>
        <p><strong>Total Items:</strong> <?= (data.lineItems && data.lineItems.length) || 0 ?></p>
      </div>
      
      <? if (data.lineItems && data.lineItems.length > 0) { ?>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Description</th>
            <th>Quantity</th>
            <th>Unit Price</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          <? data.lineItems.forEach(function(item, index) { ?>
          <tr>
            <td><?= index + 1 ?></td>
            <td><?= item.description || item.name ?></td>
            <td><?= item.quantity || 1 ?></td>
            <td>$<?= (item.unitPrice || item.price || 0).toFixed(2) ?></td>
            <td>$<?= (item.totalPrice || (item.quantity || 1) * (item.unitPrice || item.price || 0)).toFixed(2) ?></td>
          </tr>
          <? }); ?>
        </tbody>
      </table>
      <? } ?>
      
      <div class="total">
        <h3>Total Amount: $<?= (data.totalAmount || 0).toFixed(2) ?></h3>
      </div>
    </body>
    </html>
  `;
}

// ============================================================================
// PDF GENERATION FUNCTION
// ============================================================================

/**
 * Generate PDF from template and data
 * @param {Object} templateData - Data for template processing
 * @param {string} template - Template name to use
 * @return {Object} PDF generation result
 */
function generatePDFFromTemplate(templateData, template) {
  try {
    console.log(`📄 Generating PDF from template: ${template}`);
    console.log(`📊 Template data keys: ${Object.keys(templateData).join(', ')}`);
    
    // Load HTML template from external file
    const htmlTemplate = loadHTMLTemplate(template);
    
    if (!htmlTemplate || htmlTemplate.length < 100) {
      console.warn(`⚠️ Template appears too short or empty: ${htmlTemplate.length} characters`);
    }
    
    // Process template with data substitution
    const processedHTML = processHTMLTemplate(htmlTemplate, templateData);
    
    console.log(`📝 Template processing result: ${processedHTML.length} characters`);
    
    // Log first 200 characters for debugging
    console.log(`🔍 Template preview: ${processedHTML.substring(0, 200)}...`);
    
    // Convert to PDF
    const pdfBlob = Utilities.newBlob(processedHTML, 'text/html', `${templateData.invoiceId}.html`)
      .getAs('application/pdf');
    
    console.log(`✅ PDF generated successfully: ${templateData.invoiceId} (${pdfBlob.getBytes().length} bytes)`);
    
    return {
      success: true,
      blob: pdfBlob,
      template: template,
      htmlContent: processedHTML, // For debugging
      templateDataUsed: templateData // For debugging
    };
    
  } catch (error) {
    logError(`PDF generation failed for template ${template}`, error, { 
      invoiceId: templateData.invoiceId,
      templateDataKeys: Object.keys(templateData)
    });
    
    // Try fallback approach with simple template
    console.warn(`🔄 Attempting fallback PDF generation...`);
    
    try {
      const fallbackTemplate = getTemplateFallback(template);
      const fallbackHTML = processHTMLTemplate(fallbackTemplate, templateData);
      const fallbackBlob = Utilities.newBlob(fallbackHTML, 'text/html', `${templateData.invoiceId}_fallback.html`)
        .getAs('application/pdf');
      
      console.log(`⚠️ Fallback PDF generated: ${templateData.invoiceId}`);
      
      return {
        success: true,
        blob: fallbackBlob,
        template: template + '_fallback',
        htmlContent: fallbackHTML,
        warning: 'Used fallback template due to error: ' + error.message
      };
      
    } catch (fallbackError) {
      logError('Fallback PDF generation also failed', fallbackError);
      
      return {
        success: false,
        error: error.message,
        fallbackError: fallbackError.message,
        template: template
      };
    }
  }
}

// ============================================================================
// BATCH PROCESSING FUNCTIONS
// ============================================================================

/**
 * Process a batch group
 * @param {Object} batchGroup - Batch group data
 * @return {Object} Processing result
 */
function processBatchGroup(batchGroup) {
  try {
    console.log(`📦 Processing batch: ${batchGroup.key || 'BATCH'} (${batchGroup.itemCount || 0} items, ${batchGroup.transactionCount || 1} transactions)`);
    
    // Step 1: Validate batch group data
    if (!batchGroup || !batchGroup.transactions || batchGroup.transactions.length === 0) {
      throw new Error('Invalid batch group data: no transactions');
    }
    
    // Step 2: Select template
    const template = selectTemplate(batchGroup.formType, batchGroup.itemCount);
    
    // Step 3: Prepare template data
    const templateData = prepareTemplateData(batchGroup, template);
    
    // Step 4: Generate PDF
    const pdfResult = generatePDFFromTemplate(templateData, template);
    
    if (!pdfResult.success) {
      throw new Error(`PDF generation failed: ${pdfResult.error}`);
    }
    
    // Step 5: Upload to Drive
    const uploadResult = uploadInvoiceToDrive(pdfResult.blob, templateData.invoiceId, templateData.division, batchGroup.formType);
    
    if (!uploadResult.success) {
      throw new Error(`Drive upload failed: ${uploadResult.error}`);
    }
    
    // Step 6: Update transaction ledger
    const updateResults = [];
    for (const transaction of batchGroup.transactions) {
      const updateResult = updateTransactionLedger(transaction.transactionId, templateData.invoiceId, uploadResult.url);
      updateResults.push(updateResult);
    }
    
    console.log(`✅ Batch processed successfully: ${templateData.invoiceId}`);
    
    return {
      success: true,
      invoiceId: templateData.invoiceId,
      driveUrl: uploadResult.url,
      template: template,
      transactionCount: batchGroup.transactions.length,
      totalAmount: templateData.totalAmount,
      updateResults: updateResults
    };
    
  } catch (error) {
    logError('Batch processing failed', error, { batchGroup });
    
    return {
      success: false,
      error: error.message,
      batchGroup: batchGroup
    };
  }
}

/**
 * Process a single group
 * @param {Object} singleGroup - Single transaction group data
 * @return {Object} Processing result
 */
function processSingleGroup(singleGroup) {
  try {
    console.log(`📄 Processing single: ${singleGroup.transactions[0]?.transactionId || 'SINGLE'}`);
    console.log(`🔍 Single group structure: ${JSON.stringify({
      type: singleGroup.type,
      transactionCount: singleGroup.transactions?.length,
      formType: singleGroup.formType,
      division: singleGroup.division,
      lineItemCount: singleGroup.lineItems?.length
    }, null, 2)}`);
    
    // Step 1: Validate single group data
    if (!singleGroup || !singleGroup.transactions || singleGroup.transactions.length === 0) {
      throw new Error('Invalid single group data: no transactions');
    }
    
    const transaction = singleGroup.transactions[0];
    console.log(`💼 Transaction data: ${JSON.stringify({
      transactionId: transaction.transactionId,
      formType: transaction.formType,
      amount: transaction.amount,
      description: transaction.description
    }, null, 2)}`);
    
    // Step 2: Select template first
    const template = selectTemplate(singleGroup.formType, singleGroup.lineItems?.length || 1);
    
    // Step 3: Prepare template data
    const templateData = prepareTemplateData(singleGroup, template);
    
    // Step 4: Generate PDF
    const pdfResult = generatePDFFromTemplate(templateData, template);
    
    if (!pdfResult.success) {
      throw new Error(`PDF generation failed: ${pdfResult.error}`);
    }
    
    // Step 5: Upload to Drive
    const uploadResult = uploadInvoiceToDrive(pdfResult.blob, templateData.invoiceId, templateData.division, singleGroup.formType);
    
    if (!uploadResult.success) {
      throw new Error(`Drive upload failed: ${uploadResult.error}`);
    }
    
    // Step 6: Update transaction ledger
    const updateResult = updateTransactionLedger(transaction.transactionId, templateData.invoiceId, uploadResult.url);
    
    console.log(`✅ Single processed successfully: ${templateData.invoiceId}`);
    
    return {
      success: true,
      invoiceId: templateData.invoiceId,
      driveUrl: uploadResult.url,
      template: template,
      totalAmount: templateData.totalAmount,
      updateResult: updateResult
    };
    
  } catch (error) {
    logError('Single processing failed', error, { singleGroup });
    
    return {
      success: false,
      error: error.message,
      transaction: singleGroup.transactions[0]
    };
  }
}

// ============================================================================
// TESTING FUNCTIONS
// ============================================================================

/**
 * Test Phase 4 processing engine with sample data
 */
function testPhase4ProcessingEngine() {
  console.log('🧪 Testing Phase 4 processing engine...');
  
  try {
    // Test template selection
    const amazonTemplate = selectTemplate('Amazon', 5);
    console.log(`Amazon template: ${amazonTemplate}`);
    
    const adminTemplate = selectTemplate('Admin', 1);
    console.log(`Admin template: ${adminTemplate}`);
    
    const warehouseExternalTemplate = selectTemplate('warehouse_external', 10);
    console.log(`Warehouse external template: ${warehouseExternalTemplate}`);
    
    // Test template loading
    console.log('Testing template loading...');
    const batchTemplate = loadHTMLTemplate('batch_internal_template');
    console.log(`Batch template loaded: ${batchTemplate.length > 0 ? 'SUCCESS' : 'FAILED'}`);
    
    const singleTemplate = loadHTMLTemplate('single_internal_template');
    console.log(`Single template loaded: ${singleTemplate.length > 0 ? 'SUCCESS' : 'FAILED'}`);
    
    console.log('🎉 Phase 4 test completed successfully');
    
  } catch (error) {
    console.error('❌ Phase 4 test failed:', error);
    throw error;
  }
}

/**
 * Test template loading and processing system
 * @return {Object} Test results
 */
function testTemplateSystem() {
  console.log('🧪 Testing template loading and processing system...');
  
  const results = {
    templateLoading: {},
    templateProcessing: {},
    pdfGeneration: {},
    errors: []
  };
  
  try {
    // Test 1: Template Loading
    console.log('📄 Testing template loading...');
    
    const templates = ['batch_internal_template', 'single_internal_template', 'warehouse_external_template'];
    
    for (const templateName of templates) {
      try {
        const htmlContent = loadHTMLTemplate(templateName);
        results.templateLoading[templateName] = {
          success: true,
          length: htmlContent.length,
          hasServerSideSyntax: htmlContent.includes('<?='),
          preview: htmlContent.substring(0, 100)
        };
        console.log(`✅ ${templateName}: ${htmlContent.length} characters`);
      } catch (error) {
        results.templateLoading[templateName] = {
          success: false,
          error: error.message
        };
        console.log(`❌ ${templateName}: ${error.message}`);
      }
    }
    
    // Test 2: Template Processing
    console.log('🔄 Testing template processing...');
    
    const testData = {
      invoiceId: 'TEST-001',
      invoiceDate: '07/17/2025',
      division: 'Upper School',
      formType: 'Amazon',
      requestor: 'Test User',
      approver: 'Test Approver',
      organization: 'Test Org',
      description: 'Test purchase for template validation',
      totalAmount: 125.50,
      isAdmin: false,
      logoBase64: 'test_logo_data',
      signatureBase64: 'test_signature_data',
      lineItems: [
        { description: 'Test Item 1', quantity: 2, unitPrice: 25.00, totalPrice: 50.00 },
        { description: 'Test Item 2', quantity: 1, unitPrice: 75.50, totalPrice: 75.50 }
      ],
      transactions: [
        { transactionId: 'TXN-001', description: 'Test transaction 1', amount: 50.00 },
        { transactionId: 'TXN-002', description: 'Test transaction 2', amount: 75.50 }
      ]
    };
    
    for (const templateName of templates) {
      if (results.templateLoading[templateName]?.success) {
        try {
          const htmlTemplate = loadHTMLTemplate(templateName);
          const processedHTML = processHTMLTemplate(htmlTemplate, testData);
          
          results.templateProcessing[templateName] = {
            success: true,
            originalLength: htmlTemplate.length,
            processedLength: processedHTML.length,
            hasData: processedHTML.includes('TEST-001'),
            preview: processedHTML.substring(0, 200)
          };
          
          console.log(`✅ ${templateName} processed: ${processedHTML.length} characters`);
          
        } catch (error) {
          results.templateProcessing[templateName] = {
            success: false,
            error: error.message
          };
          console.log(`❌ ${templateName} processing failed: ${error.message}`);
        }
      }
    }
    
    // Test 3: PDF Generation (single test to avoid quota issues)
    console.log('📑 Testing PDF generation...');
    
    try {
      const pdfResult = generatePDFFromTemplate(testData, 'single_internal_template');
      
      results.pdfGeneration = {
        success: pdfResult.success,
        template: pdfResult.template,
        blobSize: pdfResult.success ? pdfResult.blob.getBytes().length : 0,
        error: pdfResult.error,
        warning: pdfResult.warning
      };
      
      if (pdfResult.success) {
        console.log(`✅ PDF generated: ${results.pdfGeneration.blobSize} bytes`);
      } else {
        console.log(`❌ PDF generation failed: ${pdfResult.error}`);
      }
      
    } catch (error) {
      results.pdfGeneration = {
        success: false,
        error: error.message
      };
      console.log(`❌ PDF test failed: ${error.message}`);
    }
    
    // Summary
    const loadingSuccesses = Object.values(results.templateLoading).filter(r => r.success).length;
    const processingSuccesses = Object.values(results.templateProcessing).filter(r => r.success).length;
    
    console.log(`📊 Test Summary:`);
    console.log(`  Template Loading: ${loadingSuccesses}/${templates.length} successful`);
    console.log(`  Template Processing: ${processingSuccesses}/${templates.length} successful`);
    console.log(`  PDF Generation: ${results.pdfGeneration.success ? 'SUCCESS' : 'FAILED'}`);
    
    if (loadingSuccesses === templates.length && processingSuccesses === templates.length && results.pdfGeneration.success) {
      console.log('🎉 All template system tests passed!');
    } else {
      console.log('⚠️ Some template system tests failed - check logs for details');
    }
    
    return results;
    
  } catch (error) {
    console.error('❌ Template system test failed:', error);
    results.errors.push(error.message);
    return results;
  }
}

/**
 * Quick diagnostic function to test the fixes - RUN THIS IN GOOGLE APPS SCRIPT
 */
function diagnosticTest() {
  console.log('🔧 Running diagnostic test for invoice generation fixes...');
  
  try {
    // Test 1: Check if all functions exist
    console.log('\n📋 Function availability check:');
    const functions = ['loadHTMLTemplate', 'processHTMLTemplate', 'prepareTemplateData', 'processSingleGroup'];
    
    for (const funcName of functions) {
      try {
        const func = eval(funcName);
        console.log(`✅ ${funcName}: ${typeof func}`);
      } catch (error) {
        console.log(`❌ ${funcName}: ${error.message}`);
      }
    }
    
    // Test 2: Template loading
    console.log('\n📄 Template loading test:');
    try {
      const singleTemplate = loadHTMLTemplate('single_internal_template');
      console.log(`✅ Single template loaded: ${singleTemplate.length} characters`);
    } catch (error) {
      console.log(`❌ Template loading failed: ${error.message}`);
    }
    
    // Test 3: Sample data structure
    console.log('\n📊 Data structure test:');
    
    const sampleGroup = {
      type: 'single',
      transactions: [{
        transactionId: 'DIAG-001',
        formType: 'Amazon', // This should be properly defined
        amount: 99.99,
        orderId: 'ORD-001',
        requestor: 'test@test.com',
        description: 'Diagnostic test'
      }],
      formType: 'Amazon', // Also at group level
      division: 'Administration',
      lineItems: [{
        description: 'Test item',
        quantity: 1,
        unitPrice: 99.99,
        totalPrice: 99.99
      }]
    };
    
    console.log(`📋 Sample group formType: ${sampleGroup.formType}`);
    console.log(`📋 Sample transaction formType: ${sampleGroup.transactions[0].formType}`);
    
    // Test 4: Template data preparation
    console.log('\n🔧 Template data preparation test:');
    try {
      const template = selectTemplate(sampleGroup.formType, 1);
      console.log(`📄 Selected template: ${template}`);
      
      const templateData = prepareTemplateData(sampleGroup, template);
      console.log(`✅ Template data prepared successfully`);
      console.log(`📊 Template data formType: ${templateData.formType}`);
      
    } catch (error) {
      console.log(`❌ Template data preparation failed: ${error.message}`);
      console.error(error.stack);
    }
    
    console.log('\n✅ Diagnostic test completed - check results above');
    
    return {
      success: true,
      message: 'Diagnostic completed'
    };
    
  } catch (error) {
    console.error(`❌ Diagnostic test failed: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================================================
// TESTING FUNCTIONS
// ============================================================================