/**
 * ============================================================================
 * USER DIRECTORY SETUP & MAINTENANCE
 * ============================================================================
 * Utilities for managing the UserDirectory and approver assignments.
 */

/**
 * Approver mapping by division
 */
const DIVISION_APPROVERS = {
  'KK': 'scarmichael@keswickchristian.org',  // Keswick Kids
  'LS': 'ddumais@keswickchristian.org',       // Lower School
  'US': 'lmortimer@keswickchristian.org',     // Upper School
  'AD': 'SELF'                                 // Admin - self-approving
};

/**
 * Business Office signatures by form type
 */
const BUSINESS_OFFICE_SIGNATURES = {
  'AMAZON': { name: 'Sherilyn Neel', title: 'Business Office' },
  'WAREHOUSE': { name: 'Sherilyn Neel', title: 'Business Office' },
  'CURRICULUM': { name: 'Sherilyn Neel', title: 'Business Office' },
  'FIELD_TRIP': { name: 'Beth Endrulat', title: 'Chief Financial Officer' },
  'ADMIN': { name: 'Beth Endrulat', title: 'Chief Financial Officer' }
};

/**
 * Updates all users' approvers based on their division.
 * Run this once to fix the approver column.
 */
function updateAllApproversByDivision() {
  console.log('🔄 === UPDATING APPROVERS BY DIVISION ===');

  const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
  const userSheet = budgetHub.getSheetByName('UserDirectory');
  const data = userSheet.getDataRange().getValues();

  // Column indices (0-based)
  const EMAIL_COL = 0;      // A
  const DIVISION_COL = 5;   // F
  const APPROVER_COL = 6;   // G

  let updatedCount = 0;
  const updates = [];

  for (let i = 1; i < data.length; i++) {
    const email = data[i][EMAIL_COL];
    const division = data[i][DIVISION_COL];

    if (!email || !division) continue;

    // Determine the correct approver
    let newApprover;

    // Check if this is an admin user (self-approving)
    if (division === 'AD' || division === 'Admin' || division === 'Administration') {
      newApprover = email; // Self-approve
    } else {
      // Map division to approver
      const divCode = mapDivisionToCode(division);
      newApprover = DIVISION_APPROVERS[divCode] || CONFIG.BUSINESS_OFFICE_EMAIL;
    }

    const currentApprover = data[i][APPROVER_COL];

    if (currentApprover !== newApprover) {
      updates.push({
        row: i + 1,
        email: email,
        division: division,
        oldApprover: currentApprover,
        newApprover: newApprover
      });

      // Update the cell
      userSheet.getRange(i + 1, APPROVER_COL + 1).setValue(newApprover);
      updatedCount++;
    }
  }

  console.log(`✅ Updated ${updatedCount} approver assignments`);
  console.log('Updates:', JSON.stringify(updates, null, 2));

  return {
    success: true,
    updatedCount: updatedCount,
    updates: updates
  };
}

/**
 * Maps division names to standard codes
 */
function mapDivisionToCode(division) {
  if (!division) return 'AD';

  const divLower = division.toString().toLowerCase();

  if (divLower.includes('upper') || divLower === 'us') return 'US';
  if (divLower.includes('lower') || divLower === 'ls') return 'LS';
  if (divLower.includes('keswick kids') || divLower === 'kk' || divLower.includes('prek')) return 'KK';
  if (divLower.includes('admin') || divLower === 'ad') return 'AD';

  return 'AD'; // Default to admin
}

/**
 * Gets the business office signer for a form type
 */
function getBusinessOfficeSigner(formType) {
  const type = formType.toString().toUpperCase();
  return BUSINESS_OFFICE_SIGNATURES[type] || BUSINESS_OFFICE_SIGNATURES['ADMIN'];
}

/**
 * Validates the UserDirectory has correct approvers
 */
function validateApproverAssignments() {
  console.log('🔍 === VALIDATING APPROVER ASSIGNMENTS ===');

  const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
  const userSheet = budgetHub.getSheetByName('UserDirectory');
  const data = userSheet.getDataRange().getValues();

  const issues = [];
  const summary = {
    total: 0,
    valid: 0,
    invalid: 0,
    byDivision: {}
  };

  for (let i = 1; i < data.length; i++) {
    const email = data[i][0];
    const division = data[i][5];
    const approver = data[i][6];

    if (!email) continue;
    summary.total++;

    const divCode = mapDivisionToCode(division);
    summary.byDivision[divCode] = (summary.byDivision[divCode] || 0) + 1;

    const expectedApprover = divCode === 'AD' ? email : DIVISION_APPROVERS[divCode];

    if (approver !== expectedApprover) {
      issues.push({
        row: i + 1,
        email: email,
        division: division,
        currentApprover: approver,
        expectedApprover: expectedApprover
      });
      summary.invalid++;
    } else {
      summary.valid++;
    }
  }

  console.log('Summary:', JSON.stringify(summary, null, 2));
  if (issues.length > 0) {
    console.log('Issues found:', JSON.stringify(issues, null, 2));
  } else {
    console.log('✅ All approver assignments are correct!');
  }

  return { summary, issues };
}

/**
 * Lists all unique approvers currently in the directory
 */
function listCurrentApprovers() {
  const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
  const userSheet = budgetHub.getSheetByName('UserDirectory');
  const data = userSheet.getDataRange().getValues();

  const approvers = new Set();
  const approverCounts = {};

  for (let i = 1; i < data.length; i++) {
    const approver = data[i][6];
    if (approver) {
      approvers.add(approver);
      approverCounts[approver] = (approverCounts[approver] || 0) + 1;
    }
  }

  console.log('Current Approvers:');
  Object.entries(approverCounts).forEach(([approver, count]) => {
    console.log(`  ${approver}: ${count} users`);
  });

  return { approvers: Array.from(approvers), counts: approverCounts };
}

/**
 * Adds the division approvers as users if they don't exist
 */
function ensureApproversInDirectory() {
  console.log('🔄 === ENSURING APPROVERS IN DIRECTORY ===');

  const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
  const userSheet = budgetHub.getSheetByName('UserDirectory');
  const data = userSheet.getDataRange().getValues();

  const existingEmails = new Set(data.slice(1).map(row => row[0]?.toString().toLowerCase()));

  const approversToAdd = [
    {
      email: 'scarmichael@keswickchristian.org',
      firstName: 'S',
      lastName: 'Carmichael',
      role: 'Principal',
      department: 'Keswick Kids',
      division: 'KK',
      approver: 'scarmichael@keswickchristian.org', // Self
      budgetAllocated: 0,
      budgetSpent: 0,
      budgetEncumbered: 0,
      budgetRemaining: 0,
      utilizationRate: 0,
      active: true
    },
    {
      email: 'ddumais@keswickchristian.org',
      firstName: 'D',
      lastName: 'Dumais',
      role: 'Principal',
      department: 'Lower School',
      division: 'LS',
      approver: 'ddumais@keswickchristian.org', // Self
      budgetAllocated: 0,
      budgetSpent: 0,
      budgetEncumbered: 0,
      budgetRemaining: 0,
      utilizationRate: 0,
      active: true
    },
    {
      email: 'lmortimer@keswickchristian.org',
      firstName: 'Lee',
      lastName: 'Mortimer',
      role: 'Principal',
      department: 'Upper School',
      division: 'US',
      approver: 'lmortimer@keswickchristian.org', // Self
      budgetAllocated: 0,
      budgetSpent: 0,
      budgetEncumbered: 0,
      budgetRemaining: 0,
      utilizationRate: 0,
      active: true
    },
    {
      email: 'mtrotter@keswickchristian.org',
      firstName: 'Matt',
      lastName: 'Trotter',
      role: 'Administrator',
      department: 'Administration',
      division: 'AD',
      approver: 'mtrotter@keswickchristian.org', // Self
      budgetAllocated: 10000,
      budgetSpent: 0,
      budgetEncumbered: 0,
      budgetRemaining: 10000,
      utilizationRate: 0,
      active: true
    },
    {
      email: 'nstratis@keswickchristian.org',
      firstName: 'Nick',
      lastName: 'Stratis',
      role: 'Administrator',
      department: 'Administration',
      division: 'AD',
      approver: 'nstratis@keswickchristian.org', // Self
      budgetAllocated: 10000,
      budgetSpent: 0,
      budgetEncumbered: 0,
      budgetRemaining: 10000,
      utilizationRate: 0,
      active: true
    },
    {
      email: 'sneel@keswickchristian.org',
      firstName: 'Sherilyn',
      lastName: 'Neel',
      role: 'Business Office',
      department: 'Administration',
      division: 'AD',
      approver: 'sneel@keswickchristian.org', // Self
      budgetAllocated: 10000,
      budgetSpent: 0,
      budgetEncumbered: 0,
      budgetRemaining: 10000,
      utilizationRate: 0,
      active: true
    },
    {
      email: 'bendrulat@keswickchristian.org',
      firstName: 'Beth',
      lastName: 'Endrulat',
      role: 'CFO',
      department: 'Administration',
      division: 'AD',
      approver: 'bendrulat@keswickchristian.org', // Self
      budgetAllocated: 10000,
      budgetSpent: 0,
      budgetEncumbered: 0,
      budgetRemaining: 10000,
      utilizationRate: 0,
      active: true
    }
  ];

  let addedCount = 0;

  for (const approver of approversToAdd) {
    if (!existingEmails.has(approver.email.toLowerCase())) {
      const newRow = [
        approver.email,
        approver.firstName,
        approver.lastName,
        approver.role,
        approver.department,
        approver.division,
        approver.approver,
        approver.budgetAllocated,
        approver.budgetSpent,
        approver.budgetEncumbered,
        approver.budgetRemaining,
        approver.utilizationRate,
        approver.active,
        new Date()
      ];

      userSheet.appendRow(newRow);
      console.log(`✅ Added: ${approver.email}`);
      addedCount++;
    } else {
      console.log(`⏭️ Already exists: ${approver.email}`);
    }
  }

  console.log(`Added ${addedCount} new approvers`);
  return { addedCount };
}

/**
 * Master function to set up the directory correctly
 */
function setupUserDirectory() {
  console.log('🚀 === SETTING UP USER DIRECTORY ===');

  // Step 1: Ensure approvers exist
  const addResult = ensureApproversInDirectory();
  console.log(`Step 1: Added ${addResult.addedCount} approvers`);

  // Step 2: Update all approver assignments
  const updateResult = updateAllApproversByDivision();
  console.log(`Step 2: Updated ${updateResult.updatedCount} assignments`);

  // Step 3: Validate
  const validateResult = validateApproverAssignments();
  console.log(`Step 3: Validation - ${validateResult.summary.valid}/${validateResult.summary.total} valid`);

  return {
    approversAdded: addResult.addedCount,
    assignmentsUpdated: updateResult.updatedCount,
    validationIssues: validateResult.issues.length
  };
}
