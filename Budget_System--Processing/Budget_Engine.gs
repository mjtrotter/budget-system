/**
 * ============================================================================
 * BUDGET ENGINE
 * ============================================================================
 * Core logic for budget calculations, encumbrance tracking, and approval validation.
 */

// ============================================================================
// BUDGET INFORMATION & VALIDATION
// ============================================================================

function getUserBudgetInfo(email) {
  try {
    const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
    const userSheet = budgetHub.getSheetByName('UserDirectory');
    const data = userSheet.getDataRange().getValues();
    
    const searchEmail = email.toString().trim().toLowerCase();
    
    for (let i = 1; i < data.length; i++) {
      if (!data[i][0]) continue;
      
      const storedEmail = data[i][0].toString().trim().toLowerCase();
      
      if (storedEmail === searchEmail) {
        return {
          email: data[i][0],
          firstName: data[i][1] || '',
          lastName: data[i][2] || '',
          role: data[i][3] || '',
          department: data[i][4] || 'General',
          division: data[i][5] || 'General',
          approver: data[i][6] || '',
          allocated: parseFloat(data[i][7]) || 0,
          spent: parseFloat(data[i][8]) || 0,
          encumbered: parseFloat(data[i][9]) || 0,
          available: parseFloat(data[i][10]) || 0,
          utilizationRate: parseFloat(data[i][11]) || 0,
          active: data[i][12] === true || data[i][12] === 'TRUE'
        };
      }
    }
    
    // Default user if not found
    return {
      email: email,
      firstName: 'Unknown',
      lastName: 'User',
      role: 'Staff',
      department: 'General',
      division: 'General',
      approver: CONFIG.TEST_EMAIL,
      allocated: 500,
      spent: 0,
      encumbered: 0,
      available: 500,
      utilizationRate: 0,
      active: true
    };
    
  } catch (error) {
    console.error('Error getting user budget info:', error);
    return null;
  }
}

function getApproverForRequest(requestData, userBudget) {
  // Simply return the approver listed in the user's directory row
  
  if (userBudget && userBudget.approver && userBudget.approver.trim() !== '') {
    console.log(`📋 Using designated approver for ${userBudget.email}: ${userBudget.approver}`);
    return userBudget.approver;
  }
  
  // Fallback to business office if no approver specified
  console.log(`⚠️ No approver found for ${userBudget?.email || 'unknown user'}, using business office`);
  return CONFIG.BUSINESS_OFFICE_EMAIL;
}

function validateBudgetBeforeApproval(request) {
  try {
    const userBudget = getUserBudgetInfo(request.email);
    
    if (!userBudget) {
      return { valid: false, message: 'User budget profile not found', available: 0 };
    }
    
    // Allow small overages? Currently strict.
    if (userBudget.available >= request.amount) {
      return { 
        valid: true, 
        available: userBudget.available,
        encumbrance: userBudget.encumbered
      };
    } else {
      return { 
        valid: false, 
        message: 'Insufficient funds', 
        available: userBudget.available,
        encumbrance: userBudget.encumbered
      };
    }
    
  } catch (error) {
    console.error('Budget validation error:', error);
    return { valid: false, message: 'Validation error', available: 0 };
  }
}

function checkBudgetAlerts(email) {
  const userBudget = getUserBudgetInfo(email);
  const utilizationPercent = userBudget.utilizationRate * 100;
  
  if (utilizationPercent >= 90) {
    return {
      alert: true,
      level: 'critical',
      message: `Budget utilization at ${utilizationPercent.toFixed(1)}%`,
      user: userBudget
    };
  } else if (utilizationPercent >= 75) {
    return {
      alert: true,
      level: 'warning',
      message: `Budget utilization at ${utilizationPercent.toFixed(1)}%`,
      user: userBudget
    };
  }
  
  return { alert: false };
}

/**
 * Checks if a user has exceeded their daily spending velocity for auto-approvals
 * @param {string} email - User email
 * @param {number} currentAmount - Amount of current transaction
 * @returns {Object} { allowed: boolean, dailyTotal: number, limit: number }
 */
function checkDailySpendingVelocity(email, currentAmount) {
    try {
        const DAILY_AUTO_APPROVE_LIMIT = 500; // Max $500/day in auto-approved items
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const autoHub = SpreadsheetApp.openById(CONFIG.AUTOMATED_HUB_ID);
        const queueSheet = autoHub.getSheetByName('AutomatedQueue');
        const data = queueSheet.getDataRange().getValues();

        let dailyTotal = 0;

        // Scan queue for today's approved/pending items for this user
        for (let i = 1; i < data.length; i++) {
            const rowDate = new Date(data[i][8]); // Column I: Timestamp
            const rowEmail = data[i][1];          // Column B: Requestor
            const rowStatus = data[i][7];         // Column H: Status
            const rowAmount = parseFloat(data[i][5]) || 0; // Column F: Amount

            if (rowEmail === email &&
                rowDate >= today &&
                (rowStatus === 'APPROVED' || rowStatus === 'PENDING' || rowStatus === 'ORDERED')) {
                dailyTotal += rowAmount;
            }
        }

        const newTotal = dailyTotal + currentAmount;

        return {
            allowed: newTotal <= DAILY_AUTO_APPROVE_LIMIT,
            dailyTotal: newTotal,
            limit: DAILY_AUTO_APPROVE_LIMIT
        };

    } catch (error) {
        console.error('Error checking velocity:', error);
        // Fail safe - deny auto-approval on error
        return { allowed: false, dailyTotal: currentAmount, limit: 0 };
    }
}

// ============================================================================
// ENCUMBRANCE MANAGEMENT (OPTIMIZED)
// ============================================================================

/**
 * Updates a user's encumbrance in real-time by recalculating from the queues.
 * @param {string} userEmail - The email of the user to update.
 * @param {number} amount - Ignored in the new logic (recalculated from source).
 * @param {string} action - Ignored in the new logic.
 */
function updateUserEncumbranceRealTime(userEmail, amount, action) {
  try {
    console.log(`🔄 Recalculating encumbrance for ${userEmail}...`);
    
    // Call the calculation function directly
    const currentEncumbrance = calculateUserRealTimeEncumbrance(userEmail);
    
    // Update the User Directory
    const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
    const userSheet = budgetHub.getSheetByName('UserDirectory');
    const data = userSheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === userEmail) {
        const allocated = parseFloat(data[i][7]) || 0;
        const spent = parseFloat(data[i][8]) || 0;
        
        const available = allocated - spent - currentEncumbrance;
        const utilization = allocated > 0 ? (spent + currentEncumbrance) / allocated : 0;
        
        // Update Encumbered (Column J -> 10)
        userSheet.getRange(i + 1, 10).setValue(currentEncumbrance);
        
        // Update Available (Column K -> 11)
        userSheet.getRange(i + 1, 11).setValue(available);
        
        // Update Utilization (Column L -> 12)
        userSheet.getRange(i + 1, 12).setValue(utilization);
        
        console.log(`✅ Updated ${userEmail}: Encumbered=$${currentEncumbrance.toFixed(2)}, Available=$${available.toFixed(2)}`);
        break;
      }
    }
    
  } catch (error) {
    console.error(`Error updating encumbrance for ${userEmail}:`, error);
  }
}

/**
 * Calculates real-time encumbrance for a single user by scanning active queues.
 * @param {string} userEmail - The user's email.
 * @return {number} Total current encumbrance.
 */
function calculateUserRealTimeEncumbrance(userEmail) {
  let totalEncumbrance = 0;
  
  // 1. Scan Automated Queue (Amazon, Warehouse)
  try {
    const autoHub = SpreadsheetApp.openById(CONFIG.AUTOMATED_HUB_ID);
    const autoQueue = autoHub.getSheetByName('AutomatedQueue');
    const autoData = autoQueue.getDataRange().getValues();
    
    for (let i = 1; i < autoData.length; i++) {
      if (autoData[i][1] === userEmail) {
        const status = autoData[i][7]; // Column H
        if (status === 'PENDING' || status === 'APPROVED') {
          totalEncumbrance += parseFloat(autoData[i][5]) || 0; // Column F: Amount
        }
      }
    }
  } catch (e) {
    console.error('Error scanning AutomatedQueue:', e);
  }
  
  // 2. Scan Manual Queue (Field Trip, Curriculum, Admin)
  try {
    const manualHub = SpreadsheetApp.openById(CONFIG.MANUAL_HUB_ID);
    const manualQueue = manualHub.getSheetByName('ManualQueue');
    const manualData = manualQueue.getDataRange().getValues();
    
    for (let i = 1; i < manualData.length; i++) {
      if (manualData[i][1] === userEmail) {
        const status = manualData[i][7];
        if (status === 'PENDING' || status === 'APPROVED') {
          totalEncumbrance += parseFloat(manualData[i][5]) || 0;
        }
      }
    }
  } catch (e) {
    console.error('Error scanning ManualQueue:', e);
  }
  
  return totalEncumbrance;
}

/**
 * Updates encumbrances for ALL users.
 * Runs on a schedule to ensure consistency.
 */
function updateAllUserEncumbrances() {
  console.log('🔄 Starting global encumbrance update...');
  const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
  const userSheet = budgetHub.getSheetByName('UserDirectory');
  const users = userSheet.getDataRange().getValues(); // Skip header in loop
  
  for (let i = 1; i < users.length; i++) {
    const email = users[i][0];
    if (email) {
      updateUserEncumbranceRealTime(email, 0, 'recalc');
    }
  }
  console.log('✅ Global encumbrance update complete.');
}

/**
 * Simple helper to update budget values directly (legacy support)
 */
function updateUserBudgetEncumbrance(userEmail, amount, action) {
  // Redirect to the robust real-time update
  updateUserEncumbranceRealTime(userEmail, amount, action);
}

function releaseBudgetHold(email, amount) {
  updateUserEncumbranceRealTime(email, amount, 'remove');
}

// ============================================================================
// BATCH ENCUMBRANCE UPDATES
// ============================================================================

const ENCUMBRANCE_BATCH = {
  pending: [],
  timer: null,
  threshold: 5, // Batch after 5 updates or 30 seconds
  timeout: 30000 // 30 seconds
};

/**
 * Queues encumbrance updates for batch processing
 * Reduces database writes for high-volume periods
 */
function queueEncumbranceUpdate(userEmail, amount, action) {
  ENCUMBRANCE_BATCH.pending.push({ userEmail, amount, action, timestamp: new Date() });

  // Process immediately if threshold reached
  // Note: Apps Script doesn't have setTimeout, so we process immediately on threshold
  if (ENCUMBRANCE_BATCH.pending.length >= ENCUMBRANCE_BATCH.threshold) {
    processPendingEncumbrances();
  }
  // Without setTimeout, pending items will be processed on next threshold hit
  // or by a scheduled trigger calling processPendingEncumbrances()
}

/**
 * Processes all pending encumbrance updates
 */
function processPendingEncumbrances() {
  if (ENCUMBRANCE_BATCH.pending.length === 0) return;

  console.log(`📊 Processing ${ENCUMBRANCE_BATCH.pending.length} pending encumbrance updates`);

  // Reset timer reference (no longer using setTimeout in Apps Script)
  ENCUMBRANCE_BATCH.timer = null;
  
  // Process all pending updates
  const updates = [...ENCUMBRANCE_BATCH.pending];
  ENCUMBRANCE_BATCH.pending = [];
  
  // Run full update once for all changes
  updateAllUserEncumbrances();
  
  console.log(`✅ Batch encumbrance update complete`);
}
