import sys

with open('/Users/mtrotter/budget-system/Budget_System--Processing/Budget_Engine.gs', 'r') as f:
    lines = f.readlines()

# Find the start of ENCUMBRANCE MANAGEMENT
start_idx = -1
for i, line in enumerate(lines):
    if 'ENCUMBRANCE MANAGEMENT (OPTIMIZED)' in line:
        start_idx = i - 1
        break

if start_idx != -1:
    new_lines = lines[:start_idx]
    stubs = """
// ============================================================================
// ENCUMBRANCE MANAGEMENT (DEPRECATED - REPLACED BY SHEETS FORMULAS)
// ============================================================================

function updateUserEncumbranceRealTime(userEmail, amount, action) {
  SpreadsheetApp.flush();
}

function calculateUserRealTimeEncumbrance(userEmail) {
  SpreadsheetApp.flush();
  return 0;
}

function calculateOrganizationRealTimeEncumbrance(orgName) {
  SpreadsheetApp.flush();
  return 0;
}

function recordBudgetSpent(userEmail, amount) {
  SpreadsheetApp.flush();
}

function updateOrganizationEncumbranceRealTime(orgName) {
  SpreadsheetApp.flush();
}

function updateAllUserEncumbrances() {
  SpreadsheetApp.flush();
}

function updateUserBudgetEncumbrance(userEmail, amount, action) {
  SpreadsheetApp.flush();
}

function releaseBudgetHold(email, amount) {
  SpreadsheetApp.flush();
}

function queueEncumbranceUpdate(userEmail, amount, action) {
  SpreadsheetApp.flush();
}

function processPendingEncumbrances() {
  SpreadsheetApp.flush();
}
"""
    new_lines.append(stubs)
    with open('/Users/mtrotter/budget-system/Budget_System--Processing/Budget_Engine.gs', 'w') as f:
        f.writelines(new_lines)
    print("Successfully updated Budget_Engine.gs")
else:
    print("Could not find ENCUMBRANCE MANAGEMENT section")
