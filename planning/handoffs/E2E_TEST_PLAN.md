# Keswick Budget System - E2E Test Plan

**Created:** 2026-02-10
**Purpose:** Complete end-to-end testing of all submission and approval flows
**Status:** Ready for execution in new session

---

## Pre-Test Checklist

Before starting tests, verify:
- [ ] Apps Script Processing is deployed (Script ID: `1HvQFOTy3ZmJIf8Tsz3NkMV5aXP5g95oyU9hs8xbs1Gcoweq9N2f9GhN7`)
- [ ] Apps Script Invoicing is deployed (Script ID: `1UJN7BkwJi7ULWV81yXK9OcP9eV6aE9dH0c09XqjxlqJ8t9f-jxiNcyTx`)
- [ ] All Google Forms are published and accessible
- [ ] Budget Hub spreadsheet is accessible
- [ ] Automated Hub spreadsheet is accessible
- [ ] Manual Hub spreadsheet is accessible
- [ ] Test email inbox is accessible (Outlook)

---

## Test Categories Overview

| Category | # Tests | Priority |
|----------|---------|----------|
| A. Form Submissions (5 types) | 5 | HIGH |
| B. Approval Workflows | 8 | HIGH |
| C. Email Generation | 9 | HIGH |
| D. Hub Data Flow | 6 | HIGH |
| E. Batching & Invoice Generation | 5 | HIGH |
| F. Edge Cases & Error Handling | 7 | MEDIUM |
| **TOTAL** | **40** | |

---

## A. Form Submission Tests (5 Tests)

### A1. Amazon Request Form
**Form ID:** `1NqsPZeptLKTf8aKbRH9E6_pnB79DJnBs9tdUP0A2HKY`

**Test Steps:**
1. Open Amazon Request Form
2. Fill in:
   - Requestor name & email
   - Division (e.g., Upper School)
   - Budget code
   - Item 1: ASIN `B07ZPKN6YR`, Qty: 2
   - Item 2: ASIN `B00006IE7F`, Qty: 5
   - Justification text
3. Submit form

**Expected Results:**
- [ ] Form submission succeeds
- [ ] Entry appears in Automated Hub "Amazon_Requests" sheet
- [ ] Status = "Pending Approval"
- [ ] Timestamp recorded
- [ ] Cart URL generated (if applicable)

**Verification Points:**
- Automated Hub: Row added with all fields populated
- Email: Approval request sent to approver

---

### A2. Warehouse Request Form
**Form ID:** `19G0wER7rh4sdswQD4vZbRxPnIc1DJpqw0j7dCLpn0YY`

**Test Steps:**
1. Open Warehouse Request Form
2. Fill in:
   - Requestor name & email
   - Division
   - Budget code
   - Warehouse item codes (3 items)
   - Quantities
3. Submit form

**Expected Results:**
- [ ] Entry appears in Automated Hub "Warehouse_Requests" sheet
- [ ] Item codes validated against catalog
- [ ] Prices pulled from warehouse catalog

---

### A3. Field Trip Request Form
**Form ID:** `1akolIQr412xmroEdChLkoO4frTCa8SitbP7-DlO-HrI`

**Test Steps:**
1. Open Field Trip Request Form
2. Fill in:
   - Trip name & destination
   - Date range
   - Number of students/chaperones
   - Transportation needs
   - Estimated costs (bus, admission, meals)
   - Budget code
3. Submit form

**Expected Results:**
- [ ] Entry appears in Manual Hub "Field_Trip" sheet
- [ ] Total cost calculated
- [ ] Approval workflow initiated

---

### A4. Curriculum Request Form
**Form ID:** `1D2zRvTi2KZsGCHKGwnGFF2z0HWF-KGOcf6N2qKRIwmE`

**Test Steps:**
1. Open Curriculum Request Form
2. Fill in:
   - Course/subject
   - Materials description
   - Vendor (if known)
   - Estimated cost
   - Budget code
3. Submit form

**Expected Results:**
- [ ] Entry appears in Manual Hub "Curriculum" sheet
- [ ] Linked to appropriate division budget

---

### A5. Admin Request Form
**Form ID:** `1K4AMJU75COtJfub4BbrRaRJJUgfNPvCh6vszvxiKTtg`

**Test Steps:**
1. Open Admin Request Form
2. Fill in:
   - Request type (supplies, equipment, services)
   - Description
   - Vendor
   - Cost estimate
   - Budget code
3. Submit form

**Expected Results:**
- [ ] Entry appears in Manual Hub "Admin" sheet

---

## B. Approval Workflow Tests (8 Tests)

### B1. Standard Approval (Happy Path)
**Precondition:** Pending request exists in hub

**Test Steps:**
1. Locate approval email in inbox
2. Click "Approve" button
3. Verify confirmation page

**Expected Results:**
- [ ] Request status changes to "Approved"
- [ ] Approval timestamp recorded
- [ ] Approver email recorded
- [ ] Requestor receives approval notification email
- [ ] Request queued for batching

---

### B2. Standard Rejection
**Precondition:** Pending request exists in hub

**Test Steps:**
1. Locate approval email in inbox
2. Click "Reject" button
3. Enter rejection reason
4. Submit

**Expected Results:**
- [ ] Request status changes to "Rejected"
- [ ] Rejection reason recorded
- [ ] Requestor receives rejection notification email
- [ ] Request NOT queued for batching

---

### B3. Approval Reminder (24-hour)
**Precondition:** Request pending for 24+ hours

**Test Steps:**
1. Trigger reminder manually OR wait for scheduled trigger
2. Check approver inbox

**Expected Results:**
- [ ] Reminder email sent with orange/yellow styling
- [ ] Original request details included
- [ ] Approve/Reject buttons still functional

---

### B4. Escalation Reminder (48-hour)
**Precondition:** Request pending for 48+ hours

**Test Steps:**
1. Trigger escalation manually OR wait
2. Check approver inbox

**Expected Results:**
- [ ] Escalation email sent with red styling
- [ ] CC'd to supervisor/backup approver
- [ ] Urgency indicated

---

### B5. Price Change Re-approval (Amazon)
**Precondition:** Approved Amazon request with price change detected

**Test Steps:**
1. Simulate price change (or wait for actual change)
2. Trigger price verification
3. Check approver inbox

**Expected Results:**
- [ ] Re-approval email sent showing old vs new price
- [ ] 2-hour response window indicated
- [ ] Original approval preserved if no response needed

---

### B6. Budget Exceeded Warning
**Precondition:** Request that would exceed division budget

**Test Steps:**
1. Submit request with amount > remaining budget
2. Check approval email

**Expected Results:**
- [ ] Warning indicator in approval email
- [ ] Current budget utilization shown
- [ ] Approver can still approve with override

---

### B7. Multi-Approver Workflow
**Precondition:** Request requiring multiple approvals (if applicable)

**Test Steps:**
1. Submit high-value request
2. Track through approval chain

**Expected Results:**
- [ ] Each approver receives notification
- [ ] Status shows partial approval state
- [ ] Final approval triggers processing

---

### B8. Approval Link Expiration
**Precondition:** Old approval email (7+ days)

**Test Steps:**
1. Click approve/reject on old email
2. Observe behavior

**Expected Results:**
- [ ] Graceful error message if link expired
- [ ] Instructions to contact admin

---

## C. Email Generation Tests (9 Tests)

### Email Types to Test

| ID | Email Type | Trigger | Template |
|----|------------|---------|----------|
| C1 | Enhanced Approval Request | Form submission | `sendEnhancedApprovalEmail` |
| C2 | Approval Notification | Approve clicked | `sendApprovalNotification` |
| C3 | Rejection Notification | Reject clicked | `sendRejectionNotification` |
| C4 | Approval Reminder (24h) | Scheduled trigger | `sendApprovalReminder` |
| C5 | Escalation (48h) | Scheduled trigger | `sendApprovalReminder` (escalated) |
| C6 | Daily Error Digest | Nightly batch | `sendDailyErrorDigest` |
| C7 | Price Change Alert | Price verification | Custom |
| C8 | Invoice Ready | PDF generated | Custom |
| C9 | Health Check | System monitor | `sendHealthCheckEmail` |

### Verification for Each Email:
- [ ] Email received in inbox
- [ ] Subject line correct
- [ ] Sender shows correct address
- [ ] School branding/colors correct (green #2e7d32, gold #ffc107)
- [ ] Buttons clickable and functional
- [ ] Budget bar renders correctly (if applicable)
- [ ] Mobile responsive (check on phone or resize window)
- [ ] No broken images
- [ ] Footer complete with contact info

---

## D. Hub Data Flow Tests (6 Tests)

### D1. Form → Automated Hub
**Test:** Amazon/Warehouse submissions flow to Automated Hub

**Verification:**
- [ ] New row created in correct sheet
- [ ] All form fields mapped correctly
- [ ] Timestamp accurate
- [ ] Status = "Pending Approval"

---

### D2. Form → Manual Hub
**Test:** Field Trip/Curriculum/Admin submissions flow to Manual Hub

**Verification:**
- [ ] New row created in correct sheet
- [ ] All form fields mapped correctly
- [ ] Division correctly identified

---

### D3. Approval → Status Update
**Test:** Approval action updates hub status

**Verification:**
- [ ] Status column updated
- [ ] Approver email recorded
- [ ] Approval timestamp recorded
- [ ] Comments/notes preserved

---

### D4. Approved → Budget Hub
**Test:** Approved requests update Budget Hub

**Verification:**
- [ ] Transaction recorded in Budget Hub
- [ ] Division budget decremented
- [ ] Running total updated
- [ ] Budget utilization % recalculated

---

### D5. Amazon → Ledger
**Test:** Amazon orders recorded in Amazon Ledger

**Verification:**
- [ ] Order details recorded
- [ ] ASINs listed
- [ ] Prices captured
- [ ] Order status tracked

---

### D6. Invoice → Archive
**Test:** Generated invoices archived properly

**Verification:**
- [ ] PDF saved to correct Drive folder
- [ ] Folder structure: `/Invoices/[Division]/[YYYY-MM]/`
- [ ] Filename follows convention
- [ ] Invoice number recorded in hub

---

## E. Batching & Invoice Generation Tests (5 Tests)

### E1. Single Item Invoice
**Precondition:** One approved request ready for processing

**Test Steps:**
1. Run `runNightlyInvoiceBatch` manually
2. Check output

**Expected Results:**
- [ ] Single invoice PDF generated
- [ ] Correct template used (single_internal_template)
- [ ] All fields populated
- [ ] Logo renders
- [ ] Signature placeholder present
- [ ] Totals calculated correctly

---

### E2. Batch Invoice (Multiple Items, Same Division)
**Precondition:** Multiple approved Amazon requests from same division

**Test Steps:**
1. Ensure 3+ Amazon requests approved for same division
2. Run batching process

**Expected Results:**
- [ ] Items grouped into single batch invoice
- [ ] batch_internal_template used
- [ ] Line items table formatted correctly
- [ ] Subtotals per request
- [ ] Grand total correct

---

### E3. Cross-Division Batching
**Precondition:** Approved requests from multiple divisions

**Test Steps:**
1. Ensure requests from 2+ divisions pending
2. Run batching process

**Expected Results:**
- [ ] Separate invoices per division
- [ ] Each invoice routes to correct folder
- [ ] Budget decrements correct division

---

### E4. Warehouse External PO
**Precondition:** Approved warehouse request

**Test Steps:**
1. Process warehouse request
2. Check generated document

**Expected Results:**
- [ ] warehouse_external_template used
- [ ] PO number generated
- [ ] Vendor information correct
- [ ] Line items with warehouse codes

---

### E5. Nightly Batch Full Run
**Precondition:** Mix of pending approved requests

**Test Steps:**
1. Trigger `runNightlyInvoiceBatch` (normally runs 3 AM)
2. Monitor execution
3. Review all outputs

**Expected Results:**
- [ ] All approved requests processed
- [ ] Invoices generated for each
- [ ] Status updated to "Invoiced"
- [ ] Invoice numbers assigned
- [ ] Health check email sent (if configured)

---

## F. Edge Cases & Error Handling Tests (7 Tests)

### F1. Duplicate Submission Prevention
**Test:** Submit same form twice quickly

**Expected:** Second submission detected, not duplicated

---

### F2. Invalid ASIN Handling
**Test:** Submit Amazon request with invalid ASIN

**Expected:**
- [ ] Error logged
- [ ] Graceful fallback (manual price entry or rejection)
- [ ] User notified

---

### F3. Missing Required Fields
**Test:** Submit form with missing required data

**Expected:** Form validation prevents submission

---

### F4. Budget Code Not Found
**Test:** Submit with invalid/unknown budget code

**Expected:**
- [ ] Error flagged
- [ ] Request still captured for manual review
- [ ] Admin notified

---

### F5. Approver Not in Directory
**Test:** Request from user not mapped to approver

**Expected:**
- [ ] Default approver used OR
- [ ] Admin notified for manual routing

---

### F6. PDF Generation Failure
**Test:** Simulate template error

**Expected:**
- [ ] Error logged
- [ ] Fallback template used (text-only)
- [ ] Admin notified
- [ ] Request not marked as processed

---

### F7. Network/API Timeout
**Test:** Simulate slow response from external service

**Expected:**
- [ ] Timeout handled gracefully
- [ ] Retry logic (if implemented)
- [ ] Error logged
- [ ] Request preserved for retry

---

## Test Execution Sequence

### Day 1: Form Submissions & Approvals
1. Run tests A1-A5 (all form types)
2. Verify hub data (D1-D2)
3. Run tests B1-B2 (approve/reject)
4. Verify emails (C1-C3)

### Day 2: Reminders & Batching
1. Run tests B3-B4 (reminders) - may need to wait or mock
2. Run tests E1-E4 (invoice generation)
3. Verify hub updates (D3-D6)
4. Check remaining emails (C4-C9)

### Day 3: Edge Cases & Full E2E
1. Run tests F1-F7 (edge cases)
2. Run test E5 (full nightly batch)
3. Run test B5 (price change re-approval)
4. Final verification pass

---

## Verification Sheets & Locations

| Resource | ID/Location |
|----------|-------------|
| **Budget Hub** | `161gV5ZI_J9pDEi7BD-6uOAMtAYmLD_CEDwUgVpRms20` |
| **Automated Hub** | `1CfktVXDNTY499U7zgkBVJ0DyBePH_BsYJeMtwyaxolM` |
| **Manual Hub** | `1V67-P_fNTwITJ9YeGh7HURLhaQFLQgBzCiz3IT0rJnY` |
| **Apps Script (Processing)** | `1HvQFOTy3ZmJIf8Tsz3NkMV5aXP5g95oyU9hs8xbs1Gcoweq9N2f9GhN7` |
| **Apps Script (Invoicing)** | `1UJN7BkwJi7ULWV81yXK9OcP9eV6aE9dH0c09XqjxlqJ8t9f-jxiNcyTx` |
| **Email Inbox** | Outlook - budget-system@keswickchristian.org |
| **Invoice Folder** | `/Budget System Invoices/` in Google Drive |

---

## Manual Trigger Commands

Run these in Apps Script editor:

```javascript
// Form processing (after form submit)
processAmazonFormSubmission()
processWarehouseFormSubmission()
processFieldTripFormSubmission()
processCurriculumFormSubmission()
processAdminFormSubmission()

// Approval simulation
approveRequest(requestId)
rejectRequest(requestId, reason)

// Reminders
sendPendingApprovalReminders()

// Batching & Invoicing
runNightlyInvoiceBatch()

// Health check
runHealthCheck()

// Full E2E simulation
runTrueE2ETest()
```

---

## Test Results Template

| Test ID | Test Name | Status | Notes | Date |
|---------|-----------|--------|-------|------|
| A1 | Amazon Form Submit | | | |
| A2 | Warehouse Form Submit | | | |
| A3 | Field Trip Form Submit | | | |
| A4 | Curriculum Form Submit | | | |
| A5 | Admin Form Submit | | | |
| B1 | Standard Approval | | | |
| B2 | Standard Rejection | | | |
| B3 | 24h Reminder | | | |
| B4 | 48h Escalation | | | |
| B5 | Price Change Re-approval | | | |
| B6 | Budget Exceeded Warning | | | |
| B7 | Multi-Approver | | | |
| B8 | Link Expiration | | | |
| C1-C9 | Email Generation | | | |
| D1-D6 | Hub Data Flow | | | |
| E1 | Single Invoice | | | |
| E2 | Batch Invoice | | | |
| E3 | Cross-Division | | | |
| E4 | Warehouse PO | | | |
| E5 | Full Nightly Batch | | | |
| F1-F7 | Edge Cases | | | |

---

## Handoff Notes

**What was completed before this plan:**
- PDF templates redesigned (watermarks, green theme consistent)
- Email HTML templates created and rendered (5 templates in `/email_qc/`)
- Cart scraper investigation concluded (use RapidAPI with key rotation)

**What this plan covers:**
- 40 test scenarios across 6 categories
- Complete form-to-invoice flow testing
- All email types verification
- Hub data integrity checks
- Edge case handling

**To execute this plan:**
1. Open this file in new session
2. Follow test sequence (Day 1 → Day 2 → Day 3)
3. Record results in Test Results Template
4. Note any failures for debugging

**Key contacts:**
- System: budget-system@keswickchristian.org
- Invoice folder: `/Budget System Invoices/`

---

*Plan created: 2026-02-10*
*Ready for execution in new session*
