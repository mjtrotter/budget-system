# E2E Testing Handoff Prompt

Use this prompt in a new Claude Code session to continue comprehensive E2E testing of the Keswick Budget System.

---

## HANDOFF PROMPT (Copy everything below this line)

```
I need to continue comprehensive E2E testing of the Keswick Budget System. Here's the context:

## What Was Completed in Previous Session

### Bug Fixes Applied (14+ bugs fixed in local files)
The following files were modified and need to be deployed to Google Apps Script:

1. **Utils.gs** - Fixed `constPatterns` → `const patterns` syntax error (line 46)
2. **Forms_Engine.gs** - Multiple fixes:
   - Fixed Amazon column indices to account for "Add another item?" gap columns
   - Fixed `sendApprovalNotification` call sites to pass object instead of 4 args
   - Fixed `generateOrderID` calls with correct (division, formType) signature
   - Fixed `offerResubmission` → `sendResubmissionNotification`
   - Fixed `orderId` scope issue in processWarehouseOrders
3. **Communication.js** - Fixed:
   - `getUserBudget` → `getUserBudgetInfo`
   - `BudgetCalculator.getUserBudget` → `getUserBudgetInfo`
4. **Budget_Engine.gs** - Removed `setTimeout`/`clearTimeout` (not available in Apps Script)
5. **Main.gs** - Added complete doGet/doPost handlers for approval WebApp
6. **WebApp.html** - Replaced simulated data with real `google.script.run` calls
7. **Invoicing_Engine.gs** - Added `runNightlyInvoiceBatch()` function

### Infrastructure Verified
- Amazon form is accessible at: https://docs.google.com/forms/d/1xPOiW6izitS9UW1YxpbAJTMnYnQP6l4P4WlfxKPjz_I/viewform
- Smoke test submission completed successfully
- Form logged in as invoicing@keswickchristian.org

## What Needs To Be Done

### Step 1: Deploy Code Changes
The local files have been fixed but need to be copied to the Google Apps Script project. Either:
- Copy/paste each file's contents into the Apps Script editor
- Or use `clasp push` if configured

### Step 2: Run the E2E Test Matrix
Reference the full test plan at: `/Users/mjtrotter/budget-system/.claude/plans/prancy-mixing-codd.md`

Key test scenarios (~50 total):

**Phase 1: Form Submissions**
- Amazon: A1-A8 (auto-approve, manual approve, over-budget, velocity, invalid URL)
- Warehouse: W1-W4
- Field Trip: FT1-FT3
- Curriculum: C1-C3
- Admin: AD1-AD3

**Phase 2: Approval Flow**
- AP1-AP7 (approve, reject, unauthorized, already-processed)
- Navigate to approval WebApp URLs and test approve/reject buttons

**Phase 3: Batch Processing**
- Run `runAmazonWorkflow(true)` from Apps Script
- Run `processWarehouseOrders()`
- Run `runNightlyInvoiceBatch()`

**Phase 4: Budget Verification**
- Verify encumbrance adds/removes correctly
- Verify budget spent updates after processing
- Test 75%/90% utilization alerts

**Phase 5: Dashboard**
- Verify Dashboard WebApp loads and shows correct KPIs

### Step 3: For Each Test
1. Submit form via Chrome automation
2. Check the Hub sheet for new row
3. Check Queue sheet for transaction entry and status
4. Check UserDirectory for budget encumbrance update
5. Check email for approval notification
6. Click approval link and verify WebApp works

## Key Configuration
- BUDGET_HUB_ID: 1wbv44RU18vJXlImWwxf4VRX932LgWCTBEn6JNws9HhQ
- AUTOMATED_HUB_ID: 1mGcKhEehd4OwqUy1_zN40SWJ7O_aL5ax-6B_oZDddfM
- MANUAL_HUB_ID: 1-t7YnyVvk0vxqbKGNteNHOQ92XOJNme4eJPjxVRVI5M
- Test email: mtrotter@keswickchristian.org
- Auto-approval limit: $200
- TEST_MODE: true (all emails redirect to mtrotter@)

## Chrome Setup
Start Claude Code with: `claude --chrome`
Login to Chrome as: invoicing@keswickchristian.org

## Commands to Verify Sheets
After form submission, navigate to these URLs to verify data:
- Automated Hub (Amazon/Warehouse): https://docs.google.com/spreadsheets/d/1mGcKhEehd4OwqUy1_zN40SWJ7O_aL5ax-6B_oZDddfM
- Manual Hub (Field Trip/Curriculum/Admin): https://docs.google.com/spreadsheets/d/1-t7YnyVvk0vxqbKGNteNHOQ92XOJNme4eJPjxVRVI5M
- Budget Hub (UserDirectory/Ledger): https://docs.google.com/spreadsheets/d/1wbv44RU18vJXlImWwxf4VRX932LgWCTBEn6JNws9HhQ

Please help me:
1. First deploy the code changes to Apps Script (I can share the script editor link)
2. Then systematically run through the E2E test scenarios
3. Fix any issues discovered during testing
4. Document results
```

---

## Files Modified (need deployment)

| File | Changes |
|------|---------|
| `Budget_System--Processing/Utils.gs` | Fixed syntax error |
| `Budget_System--Processing/Forms_Engine.gs` | Column indices, function calls, scope fixes |
| `Budget_System--Processing/Communication.js` | getUserBudget → getUserBudgetInfo |
| `Budget_System--Processing/Budget_Engine.gs` | Removed setTimeout |
| `Budget_System--Processing/Main.gs` | Added doGet/doPost |
| `Budget_System--Processing/WebApp.html` | Real server integration |
| `Budget_System--Processing/Invoicing_Engine.gs` | Added runNightlyInvoiceBatch |

## Session Summary

- **Bugs Found**: 6 CRITICAL, 8+ MEDIUM
- **Bugs Fixed**: All critical and medium bugs
- **Forms Verified**: Amazon form accessible, smoke test passed
- **Remaining**: Deploy code, run full E2E test matrix (~50 scenarios)
