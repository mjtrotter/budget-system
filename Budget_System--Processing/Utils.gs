/**
 * ============================================================================
 * UTILITY HELPER FUNCTIONS
 * ============================================================================
 * Shared utilties for formatting, parsing, and ID generation.
 */

// ============================================================================
// FORMATTING
// ============================================================================

/**
 * Formats a decimal as a percentage
 * @param {number} value - Decimal value (e.g., 0.75)
 * @param {number} decimals - Number of decimal places (default 1)
 * @return {string} Formatted percentage (e.g., "75.0%")
 */
function formatPercentage(value, decimals = 1) {
  if (typeof value !== 'number' || isNaN(value)) {
    return '0.0%';
  }
  return (value * 100).toFixed(decimals) + '%';
}

function formatDate(date) {
  if (!date) return 'N/A';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getCurrentQuarter() {
  const month = new Date().getMonth() + 1;
  if (month <= 3) return 'Q3';
  if (month <= 6) return 'Q4';
  if (month <= 9) return 'Q1';
  return 'Q2';
}

// ============================================================================
// PARSING & EXTRACTION
// ============================================================================

function extractASIN(url) {
  if (!url) return null;
  
  const patterns = CONFIG.ASIN_PATTERNS || [
    /\/dp\/([A-Z0-9]{10})/i,
    /\/gp\/product\/([A-Z0-9]{10})/i,
    /\/product\/([A-Z0-9]{10})/i,
    /[?&]asin=([A-Z0-9]{10})/i,
    /\/([A-Z0-9]{10})(?:[/?#]|$)/i
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

function extractPdfLink(uploadResponse) {
  try {
    if (!uploadResponse || uploadResponse === '') return null;
    
    // Google Forms uploads return file IDs, convert to viewable links
    const fileId = uploadResponse.toString().trim();
    
    // Check if it's already a full link or just a file ID
    if (fileId.includes('drive.google.com')) {
      return fileId;
    } else {
      // Convert file ID to viewable link
      return `https://drive.google.com/file/d/${fileId}/view`;
    }
  } catch (error) {
    console.error('Error extracting PDF link:', error);
    return null;
  }
}

// ============================================================================
// ID GENERATION
// ============================================================================

function generateSequentialTransactionId(formType) {
  try {
    // Determine which hub to check
    const isAutomated = ['AMAZON', 'WAREHOUSE'].includes(formType);
    const hubId = isAutomated ? CONFIG.AUTOMATED_HUB_ID : CONFIG.MANUAL_HUB_ID;
    const hub = SpreadsheetApp.openById(hubId);
    const queueSheet = hub.getSheetByName(isAutomated ? 'AutomatedQueue' : 'ManualQueue');
    
    // Map form type to prefix
    const prefixMap = {
      'AMAZON': 'AMZ',
      'WAREHOUSE': 'PCW',
      'FIELD_TRIP': 'FT',
      'CURRICULUM': 'CI',
      'ADMIN': 'ADMIN'
    };
    
    const prefix = prefixMap[formType] || 'TXN';
    
    // Get all existing IDs with this prefix
    const data = queueSheet.getDataRange().getValues();
    let maxNumber = 0;
    
    for (let i = 1; i < data.length; i++) {
      const id = data[i][0];
      if (id && id.toString().startsWith(prefix + '-')) {
        const numberPart = id.substring(prefix.length + 1);
        const number = parseInt(numberPart);
        if (!isNaN(number) && number > maxNumber) {
          maxNumber = number;
        }
      }
    }
    
    // Next sequential number
    const nextNumber = maxNumber + 1;
    const transactionId = `${prefix}-${nextNumber.toString().padStart(3, '0')}`;
    
    console.log(`✅ Generated sequential ID: ${transactionId}`);
    return transactionId;
    
  } catch (error) {
    console.error('Error generating sequential transaction ID:', error);
    // Fallback to timestamp-based
    return `${formType}-${Date.now().toString().slice(-6)}`;
  }
}

/**
 * Generates order ID in format: US-AMZ-MMDD-NN
 * @param {string} division - Division name
 * @param {string} formType - Type of form (AMAZON, WAREHOUSE, etc.)
 * @return {string} Order ID
 */
function generateOrderID(division, formType) {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = month + day;

  // Map division to code
  const divisionCode = division.toLowerCase().includes('upper') ? 'US' :
                      division.toLowerCase().includes('lower') ? 'LS' :
                      division.toLowerCase().includes('keswick') ? 'KK' :
                      'AD';

  // Map form type to code
  const typeCode = formType === 'AMAZON' ? 'AMZ' :
                   formType === 'WAREHOUSE' ? 'PCW' :
                   formType === 'FIELD_TRIP' ? 'FT' :
                   formType === 'CURRICULUM' ? 'CI' :
                   'GEN';

  const baseOrderId = `${divisionCode}-${typeCode}-${dateStr}`;

  // Check for existing orders today and add suffix if needed
  const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
  const ledger = budgetHub.getSheetByName('TransactionLedger');

  if (!ledger) return baseOrderId + '-01';

  const data = ledger.getDataRange().getValues();
  let maxNum = 0;

  for (let i = 1; i < data.length; i++) {
    const orderId = String(data[i][1] || '');
    if (orderId.startsWith(baseOrderId + '-')) {
      const numPart = orderId.split('-').pop();
      const num = parseInt(numPart);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  const nextNum = String(maxNum + 1).padStart(2, '0');
  return `${baseOrderId}-${nextNum}`;
}

/**
 * Backward compatibility wrapper for generateOrderIdWithSuffix
 * Maps old prefix format to new division/formType format
 */
function generateOrderIdWithSuffix(prefix) {
  console.log(`⚠️ generateOrderIdWithSuffix called with prefix: ${prefix} - using compatibility wrapper`);

  // Map old prefixes to division and form type
  const prefixMapping = {
    'AMZ': { division: 'Upper School', formType: 'AMAZON' },
    'PCW': { division: 'Upper School', formType: 'WAREHOUSE' },
    'CC': { division: 'Upper School', formType: 'CREDITCARD' },
    'RMB': { division: 'Upper School', formType: 'REIMBURSEMENT' },
    'FT': { division: 'Upper School', formType: 'FIELD_TRIP' },
    'CI': { division: 'Upper School', formType: 'CURRICULUM' }
  };

  // Get mapping or use defaults
  const mapping = prefixMapping[prefix] || { 
    division: 'Admin', 
    formType: 'DEFAULT' 
  };

  // Call the new function with proper parameters
  return generateOrderID(mapping.division, mapping.formType);
}

/**
 * Determines the division (Lower School / Upper School / Admin) based on department.
 * @param {string} department - The department name.
 * @return {string} The division name.
 */
function getDivisionFromDepartment(department) {
  if (!department) return 'Administration';
  
  const dept = department.toString().toLowerCase();
  
  // Lower School Departments
  if (dept.includes('lower') || 
      dept.includes('elementary') || 
      dept.includes('kindergarten') || 
      dept.includes('pk')) {
    return 'Lower School';
  }
  
  // Upper School Departments
  if (dept.includes('upper') || 
      dept.includes('middle') || 
      dept.includes('high') || 
      dept.includes('science') || 
      dept.includes('math') || 
      dept.includes('english') || 
      dept.includes('history') || 
      dept.includes('bible') || 
      dept.includes('sports') || 
      dept.includes('athletics')) {
    return 'Upper School';
  }
  
  // Default to Admin
  return 'Administration';
}
