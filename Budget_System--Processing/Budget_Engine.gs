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
    const userSheet = budgetHub.getSheetByName("UserDirectory");
    const data = userSheet.getDataRange().getValues();

    const searchEmail = email.toString().trim().toLowerCase();

    for (let i = 1; i < data.length; i++) {
      if (!data[i][0]) continue;

      const storedEmail = data[i][0].toString().trim().toLowerCase();

      if (storedEmail === searchEmail) {
        return {
          email: data[i][0],
          firstName: data[i][1] || "",
          lastName: data[i][2] || "",
          role: data[i][3] || "",
          department: data[i][4] || "General",
          division: data[i][5] || "General",
          approver: data[i][6] || "",
          allocated: parseFloat(data[i][7]) || 0,
          spent: parseFloat(data[i][8]) || 0,
          encumbered: parseFloat(data[i][9]) || 0,
          available: parseFloat(data[i][10]) || 0,
          utilizationRate: parseFloat(data[i][11]) || 0,
          active: data[i][12] === true || data[i][12] === "TRUE",
        };
      }
    }

    // User not found — reject rather than silently assigning a default budget
    console.warn(`⚠️ User ${email} not found in UserDirectory — rejecting request`);
    return null;
  } catch (error) {
    console.error("Error getting user budget info:", error);
    return null;
  }
}

function getApproverForRequest(requestData, userBudget) {
  // Simply return the approver listed in the user's directory row

  if (userBudget && userBudget.approver && userBudget.approver.trim() !== "") {
    console.log(
      `📋 Using designated approver for ${userBudget.email || userBudget.organization}: ${userBudget.approver}`,
    );
    return userBudget.approver;
  }

  // Fallback to business office if no approver specified
  console.log(
    `⚠️ No approver found for ${userBudget?.email || userBudget?.organization || "unknown user"}, using business office`,
  );
  return CONFIG.BUSINESS_OFFICE_EMAIL;
}

// ============================================================================
// ORGANIZATION BUDGET QUERYING
// ============================================================================

function getOrganizationBudgetInfo(orgName) {
  try {
    const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
    const orgSheet = budgetHub.getSheetByName("OrganizationBudgets");
    if (!orgSheet) throw new Error("OrganizationBudgets tab not found");
    const data = orgSheet.getDataRange().getValues();

    const searchOrg = orgName.toString().trim().toLowerCase();

    for (let i = 1; i < data.length; i++) {
      if (!data[i][0]) continue;

      const storedOrg = data[i][0].toString().trim().toLowerCase();

      if (storedOrg === searchOrg) {
        const allocated = parseFloat(data[i][1]) || 0;
        const spent = parseFloat(data[i][2]) || 0;
        const encumbered = parseFloat(data[i][3]) || 0;
        const available = parseFloat(data[i][4]) || 0;
        const utilizationRate =
          allocated > 0 ? (spent + encumbered) / allocated : 0;

        return {
          organization: data[i][0],
          approver: data[i][5] || "",
          allocated: allocated,
          spent: spent,
          encumbered: encumbered,
          available: available,
          utilizationRate: utilizationRate,
          active: data[i][6] === true || data[i][6] === "TRUE",
          // Maps to user format for unified templates
          firstName: data[i][0],
          lastName: "Budget",
          department: data[i][0],
          division: data[i][0],
        };
      }
    }

    console.warn(`⚠️ Organization budget not found for ${orgName}`);
    return null;
  } catch (error) {
    console.error(`Error querying organization budget for ${orgName}:`, error);
    return null;
  }
}

/**
 * Retrieves the Division Principal's email for escalation based on a user's profile
 * or a specific division string.
 * @param {string} email - The user's email 
 * @param {string} divisionOverride - Optional specific division name to lookup directly
 */
function getDivisionPrincipal(email, divisionOverride = null) {
  let targetDivision = divisionOverride;

  if (!targetDivision && email) {
    const userProfile = getUserBudgetInfo(email);
    if (userProfile && userProfile.division) {
      targetDivision = userProfile.division;
    }
  }

  if (!targetDivision) return null;

  const orgBudget = getOrganizationBudgetInfo(targetDivision);
  return orgBudget ? orgBudget.approver : null;
}

/**
 * FIX #5: Validates budget before approval using the correct budget scope per form type.
 *
 * Budget scoping rules:
 *   - FIELD_TRIP  → Division-level org budget (e.g., "Upper School", "Lower School")
 *   - CURRICULUM / CURRICULUM_AMAZON → Department-level org budget (e.g., "Math", "English")
 *   - AMAZON / WAREHOUSE / ADMIN → Individual user budget
 *
 * @param {Object} request - The request object from the queue. Must include:
 *   request.email       - Requestor email
 *   request.amount      - Requested dollar amount
 *   request.type        - Form type string (AMAZON, WAREHOUSE, FIELD_TRIP, CURRICULUM, ADMIN, etc.)
 *   request.division    - Division name (used for Field Trip org lookup)
 *   request.department  - Department name (used for Curriculum org lookup)
 */
function validateBudgetBeforeApproval(request) {
  try {
    const formType = (request.type || "").toUpperCase();

    // --- FIELD TRIP: Division org budget ---
    if (formType === "FIELD_TRIP") {
      const division = request.division || request.department || "";
      if (!division) {
        return { valid: false, message: "Division not specified for Field Trip budget check", available: 0 };
      }
      const orgBudget = getOrganizationBudgetInfo(division);
      if (!orgBudget) {
        return { valid: false, message: `Division budget not found for: ${division}`, available: 0 };
      }
      if (orgBudget.available >= request.amount) {
        return { valid: true, available: orgBudget.available, encumbrance: orgBudget.encumbered };
      }
      return { valid: false, message: "Insufficient funds", available: orgBudget.available, encumbrance: orgBudget.encumbered };
    }

    // --- CURRICULUM (including cross-routed AMAZON from Curriculum): Department org budget ---
    if (formType === "CURRICULUM" || formType === "CURRICULUM_AMAZON" || formType === "CURRICULUM-AMAZON") {
      const department = request.department || request.division || "";
      if (!department) {
        return { valid: false, message: "Department not specified for Curriculum budget check", available: 0 };
      }
      const orgBudget = getOrganizationBudgetInfo(department);
      if (!orgBudget) {
        return { valid: false, message: `Department budget not found for: ${department}`, available: 0 };
      }
      if (orgBudget.available >= request.amount) {
        return { valid: true, available: orgBudget.available, encumbrance: orgBudget.encumbered };
      }
      return { valid: false, message: "Insufficient funds", available: orgBudget.available, encumbrance: orgBudget.encumbered };
    }

    // --- AMAZON / WAREHOUSE / ADMIN: Individual user budget ---
    const userBudget = getUserBudgetInfo(request.email);
    if (!userBudget) {
      return { valid: false, message: "User budget profile not found", available: 0 };
    }
    if (userBudget.available >= request.amount) {
      return { valid: true, available: userBudget.available, encumbrance: userBudget.encumbered };
    }
    return { valid: false, message: "Insufficient funds", available: userBudget.available, encumbrance: userBudget.encumbered };

  } catch (error) {
    console.error("Budget validation error:", error);
    return { valid: false, message: "Validation error", available: 0 };
  }
}


function checkBudgetAlerts(email) {
  const userBudget = getUserBudgetInfo(email);
  const utilizationPercent = userBudget.utilizationRate * 100;

  if (utilizationPercent >= 90) {
    return {
      alert: true,
      level: "critical",
      message: `Budget utilization at ${utilizationPercent.toFixed(1)}%`,
      user: userBudget,
    };
  } else if (utilizationPercent >= 75) {
    return {
      alert: true,
      level: "warning",
      message: `Budget utilization at ${utilizationPercent.toFixed(1)}%`,
      user: userBudget,
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
    // Role-aware velocity limits (configurable via Script Properties)
    // Standard users: $500/day  |  Admin roles: $2,000/day
    const DEFAULT_VELOCITY_LIMIT = getDyn("VELOCITY_LIMIT_DEFAULT", 500, "int");
    const ADMIN_VELOCITY_LIMIT   = getDyn("VELOCITY_LIMIT_ADMIN",   2000, "int");

    const userInfo = getUserBudgetInfo(email);
    const isAdminRole = userInfo && (userInfo.role || "").toLowerCase().includes("admin");
    const DAILY_AUTO_APPROVE_LIMIT = isAdminRole ? ADMIN_VELOCITY_LIMIT : DEFAULT_VELOCITY_LIMIT;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const autoHub = SpreadsheetApp.openById(CONFIG.AUTOMATED_HUB_ID);
    const queueSheet = autoHub.getSheetByName("AutomatedQueue");
    const data = queueSheet.getDataRange().getValues();

    let dailyTotal = 0;

    // Scan queue for today's approved/pending items for this user
    for (let i = 1; i < data.length; i++) {
      const rowDate = new Date(data[i][8]); // Column I: Timestamp
      const rowEmail = data[i][1]; // Column B: Requestor
      const rowStatus = data[i][7]; // Column H: Status
      const rowAmount = parseFloat(data[i][5]) || 0; // Column F: Amount

      if (
        rowEmail === email &&
        rowDate >= today &&
        (rowStatus === "APPROVED" ||
          rowStatus === "PENDING" ||
          rowStatus === "ORDERED")
      ) {
        dailyTotal += rowAmount;
      }
    }

    const newTotal = dailyTotal + currentAmount;

    return {
      allowed: newTotal <= DAILY_AUTO_APPROVE_LIMIT,
      dailyTotal: newTotal,
      limit: DAILY_AUTO_APPROVE_LIMIT,
    };
  } catch (error) {
    console.error("Error checking velocity:", error);
    // Fail safe - deny auto-approval on error
    return { allowed: false, dailyTotal: currentAmount, limit: 0 };
  }
}


// ============================================================================
// ENCUMBRANCE MANAGEMENT (DEPRECATED - REPLACED BY SHEETS FORMULAS)
// ============================================================================

function updateUserEncumbranceRealTime(userEmail, amount, action) {
  forceBudgetRecalculation();
}

function calculateUserRealTimeEncumbrance(userEmail) {
  forceBudgetRecalculation();
  return 0;
}

function calculateOrganizationRealTimeEncumbrance(orgName) {
  forceBudgetRecalculation();
  return 0;
}

function recordBudgetSpent(userEmail, amount) {
  forceBudgetRecalculation();
}

function updateOrganizationEncumbranceRealTime(orgName) {
  forceBudgetRecalculation();
}

function updateAllUserEncumbrances() {
  forceBudgetRecalculation();
}

function updateUserBudgetEncumbrance(userEmail, amount, action) {
  forceBudgetRecalculation();
}

function releaseBudgetHold(email, amount) {
  forceBudgetRecalculation();
}

function queueEncumbranceUpdate(userEmail, amount, action) {
  forceBudgetRecalculation();
}

function processPendingEncumbrances() {
  forceBudgetRecalculation();
}
