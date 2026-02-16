# Handoff: E2E Testing Session

**Date:** 2026-02-10
**From:** Previous session (cart scraper investigation + audit planning)
**To:** New session for E2E test execution

---

## Quick Context

The Keswick Budget System is a Google Apps Script solution managing invoice generation and budget tracking. It has three arms:
- **Processing Arm** - Form handling, approvals, Amazon orders
- **Invoicing Arm** - PDF generation, batching
- **Dashboard Arm** - Visualization (not focus of this testing)

---

## What's Already Done

| Task | Status | Notes |
|------|--------|-------|
| PDF Templates | ✅ Complete | Watermarks at 8% opacity, all green theme |
| Email HTML Templates | ✅ Complete | 5 templates in `/Budget_System--Processing/email_qc/` |
| Cart Scraper | ✅ Investigated | Conclusion: Use RapidAPI with key rotation (Amazon blocks headless browsers) |
| Test Plan | ✅ Created | See `E2E_TEST_PLAN.md` - 40 test scenarios |

---

## What Needs To Be Done

Execute the E2E test plan covering:
1. **Form Submissions** - All 5 form types (Amazon, Warehouse, Field Trip, Curriculum, Admin)
2. **Approval Workflows** - Approve, reject, reminders, escalation
3. **Email Verification** - Check inbox for all 9 email types
4. **Hub Data Flow** - Verify data moves correctly between sheets
5. **Invoice Generation** - Single, batch, warehouse PO
6. **Edge Cases** - Error handling scenarios

---

## Key Resources

### Apps Script Projects
- **Processing:** `1HvQFOTy3ZmJIf8Tsz3NkMV5aXP5g95oyU9hs8xbs1Gcoweq9N2f9GhN7`
- **Invoicing:** `1UJN7BkwJi7ULWV81yXK9OcP9eV6aE9dH0c09XqjxlqJ8t9f-jxiNcyTx`

### Spreadsheets
- **Budget Hub:** `161gV5ZI_J9pDEi7BD-6uOAMtAYmLD_CEDwUgVpRms20`
- **Automated Hub:** `1CfktVXDNTY499U7zgkBVJ0DyBePH_BsYJeMtwyaxolM`
- **Manual Hub:** `1V67-P_fNTwITJ9YeGh7HURLhaQFLQgBzCiz3IT0rJnY`

### Forms
- Amazon: `1NqsPZeptLKTf8aKbRH9E6_pnB79DJnBs9tdUP0A2HKY`
- Warehouse: `19G0wER7rh4sdswQD4vZbRxPnIc1DJpqw0j7dCLpn0YY`
- Field Trip: `1akolIQr412xmroEdChLkoO4frTCa8SitbP7-DlO-HrI`
- Curriculum: `1D2zRvTi2KZsGCHKGwnGFF2z0HWF-KGOcf6N2qKRIwmE`
- Admin: `1K4AMJU75COtJfub4BbrRaRJJUgfNPvCh6vszvxiKTtg`

### Email
- Inbox: Outlook - `budget-system@keswickchristian.org`

---

## How To Start New Session

**Prompt for new session:**

```
Resume E2E testing of the Keswick Budget System.

Read the test plan at /Users/mjtrotter/budget-system/E2E_TEST_PLAN.md

We need to:
1. Execute form submission tests (A1-A5)
2. Test approval workflows (B1-B8)
3. Verify emails in Outlook inbox (C1-C9)
4. Check hub data flow (D1-D6)
5. Test invoice generation (E1-E5)
6. Test edge cases (F1-F7)

Start with Day 1 tests: Form submissions and basic approvals.
Open the necessary sheets and forms to begin testing.
```

---

## Files Created This Session

| File | Purpose |
|------|---------|
| `/budget-system/E2E_TEST_PLAN.md` | Comprehensive 40-test plan |
| `/budget-system/HANDOFF_E2E_TESTING.md` | This handoff document |
| `/Budget_System--Processing/cart-scraper/` | Playwright scraper (not deployed - using RapidAPI instead) |

---

## Known Issues / Decisions Made

1. **Cart Scraper:** Amazon blocks all headless browser approaches. Stick with RapidAPI + key rotation for price verification.

2. **Email HTML Templates:** Already rendered and approved in previous session. Templates are in `/email_qc/` folder.

3. **PDF Templates:** Updated with visible watermarks (8% opacity) and consistent green theme across all 3 templates.

---

## Test Execution Order

### Day 1: Forms & Basic Approvals
- Submit all 5 form types
- Approve 2-3 requests
- Reject 1 request
- Check emails received

### Day 2: Reminders & Invoicing
- Test reminder flows
- Run invoice generation
- Verify PDFs

### Day 3: Edge Cases & Full Run
- Test error scenarios
- Run full nightly batch
- Final verification

---

*Ready for new session*
