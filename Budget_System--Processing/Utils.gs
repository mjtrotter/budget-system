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

    let fileId = uploadResponse.toString().trim();

    // Extract file ID from various Google Drive URL formats
    if (fileId.includes('drive.google.com') || fileId.includes('docs.google.com')) {
      const patterns = [
        /\/d\/([a-zA-Z0-9_-]+)/,
        /[?&]id=([a-zA-Z0-9_-]+)/,
        /\/open\?id=([a-zA-Z0-9_-]+)/
      ];
      for (const pattern of patterns) {
        const match = fileId.match(pattern);
        if (match) { fileId = match[1]; break; }
      }
    }

    // Make file viewable by anyone with the link so approvers can access it
    try {
      const file = DriveApp.getFileById(fileId);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      console.log(`📎 Set sharing to "anyone with link" for uploaded file: ${fileId} (${file.getName()})`);
    } catch (shareError) {
      console.warn(`⚠️ Could not set sharing on file ${fileId}: ${shareError.message}`);
      // Try alternative: set access via permission add
      try {
        DriveApp.getFileById(fileId).addViewer('anyone');
      } catch (e2) {
        console.warn(`⚠️ Fallback sharing also failed: ${e2.message}`);
      }
    }

    return `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;
  } catch (error) {
    console.error('Error extracting PDF link:', error);
    return null;
  }
}

// ============================================================================
// ID GENERATION
// ============================================================================

function generateSequentialTransactionId(formType, division = 'Admin') {
  try {
    // Determine which hub to check
    const isAutomated = ['AMAZON', 'WAREHOUSE'].includes(formType);
    const hubId = isAutomated ? CONFIG.AUTOMATED_HUB_ID : CONFIG.MANUAL_HUB_ID;
    const hub = SpreadsheetApp.openById(hubId);
    const queueSheet = hub.getSheetByName(isAutomated ? 'AutomatedQueue' : 'ManualQueue');
    
    // Map form type to code
    const prefixMap = {
      'AMAZON': 'AMZ',
      'WAREHOUSE': 'PCW',
      'FIELD_TRIP': 'FT',
      'CURRICULUM': 'CI',
      'ADMIN': 'ADM'
    };
    const typeCode = prefixMap[formType] || 'TXN';
    
    // Map division to code
    const divisionStr = (division || 'Admin').toLowerCase();
    const divisionCode = divisionStr.includes('upper') ? 'US' :
                         divisionStr.includes('lower') ? 'LS' :
                         divisionStr.includes('keswick') ? 'KK' :
                         'AD';
                         
    // Format Date: MMDD
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = month + day;
    
    // Build daily pattern: [TYPE]-[DIV]-[MMDD]
    const prefix = `${typeCode}-${divisionCode}-${dateStr}`;
    
    // Get all existing IDs with this prefix to find the max NN
    const data = queueSheet.getDataRange().getValues();
    let maxNumber = 0;
    
    for (let i = 1; i < data.length; i++) {
      const id = data[i][0];
      if (id && id.toString().startsWith(prefix + '-')) {
        const numberPart = id.toString().split('-').pop();
        const number = parseInt(numberPart);
        if (!isNaN(number) && number > maxNumber) {
          maxNumber = number;
        }
      }
    }
    
    // Generate next sequential number with suffix padding
    const nextNumber = maxNumber + 1;
    const transactionId = `${prefix}-${nextNumber.toString().padStart(2, '0')}`;
    
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
  if (!department) return 'Admin';
  
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
  return 'Admin';
}
