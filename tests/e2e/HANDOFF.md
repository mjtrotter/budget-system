# E2E Test Handoff — Keswick Budget System

**Date:** 2026-04-03
**Status:** Phase 0 complete (scaffold + bootstrap), Phase 1 reset verified, Phase 2 not started
**Blocker:** Injection script wrote to wrong cells. Fixed in helpers/sheets.py but scenarios need rewrite.

---

## What Exists

```
tests/e2e/
├── bootstrap.py              ✅ Works — opens headed browser for manual login
├── conftest.py               ✅ All URLs, paths, constants
├── preflight.py              ✅ Safety check (blocks mtrotter@ from running)
├── run_all.py                ⚠️  Orchestrator — needs testing
├── helpers/
│   ├── sheets.py             ✅ REWRITTEN — uses Name Box navigation (see below)
│   ├── owa.py                ⚠️  Untested — selectors may need adjustment
│   └── forms.py              ⚠️  Untested — Google Forms selectors unverified
├── scenarios/
│   ├── a1_auto_approval.py   ❌ Uses OLD sheets.py API — needs rewrite
│   ├── a2_velocity.py        ❌ Uses OLD sheets.py API — needs rewrite
│   ├── a3_over_threshold.py  ❌ Uses OLD sheets.py API — needs rewrite
│   ├── a4_over_budget.py     ❌ Uses OLD sheets.py API — needs rewrite
│   ├── b1_curriculum.py      ❌ Uses OLD sheets.py API — needs rewrite
│   └── b2_field_trip.py      ❌ Uses OLD sheets.py API — needs rewrite
└── evidence/                 ✅ Screenshot output dir
```

## Persistent Browser Profile

- **Path:** `/Users/mtrotter/budget-system/.playwright-profile`
- **Status:** Logged into Google (invoicing@keswickchristian.org) + OWA as of 2026-04-03
- **Sessions may expire.** If they do, re-run `bootstrap.py` and log in again.

---

## CRITICAL: Amazon Order Safety

The Apps Script at `Amazon_Engine.js:319-330` makes REAL Amazon Business API calls.

**Protection:** The code forces `TrialMode` for any email ≠ `mtrotter@keswickchristian.org`:
```javascript
const isMtrotter = String(requesterEmail).toLowerCase().trim() === 'mtrotter@keswickchristian.org';
const forceTrial = !isMtrotter || CONFIG.AMAZON_B2B.TRIAL_MODE_ENABLED;
if (forceTrial) {
  attributes.push({ attributeType: 'TrialMode' });  // Amazon won't fulfill
}
```

Our test email `invoicing@keswickchristian.org` ≠ mtrotter, so **TrialMode is forced**.
Every scenario file has an `assert` that blocks execution if TARGET_EMAIL is mtrotter.

**DO NOT change TARGET_EMAIL to mtrotter@keswickchristian.org. That places real orders.**

Config.gs `TRIAL_MODE_ENABLED` is hardcoded `false` (not via getDyn), so it can't be toggled
from Script Properties. The email-based protection is the actual safety net.

---

## UserDirectory Schema (VERIFIED from Budget_Engine.gs:12-41 AND screenshot)

```
Col  Letter  Index  Field              Reset Default
───  ──────  ─────  ─────              ─────────────
 A     A       0    Email              (preserved)
 B     B       1    FirstName          (preserved)
 C     C       2    LastName           (preserved)
 D     D       3    Role               Teacher/Admin/etc (preserved)
 E     E       4    Department         (preserved)
 F     F       5    Division           (preserved)
 G     G       6    Approver           (preserved)
 H     H       7    BudgetAllocated    200 (reset default)
 I     I       8    BudgetSpent        0 (reset clears)
 J     J       9    BudgetEncumbered   0 (reset clears)
 K     K      10    BudgetRemaining    200 (formula: H-I-J)
 L     L      11    UtilizationRate    0.00% (formula)
 M     M      12    Active             TRUE
 N     N      13    LastModified       (timestamp)
```

**invoicing@keswickchristian.org is ROW 2** (first data row after header).

### How to edit cells (NEW API):

```python
from helpers.sheets import open_sheet, set_cell

page = open_sheet(context, BUDGET_HUB, "UserDirectory")
set_cell(page, "H2", "500")   # BudgetAllocated = 500
set_cell(page, "I2", "0")     # BudgetSpent = 0
set_cell(page, "D2", "Teacher")  # Role
```

**DO NOT use the old `set_cell_in_row()` / `find_row_by_column_value()` + offset approach.**
Those functions are removed. Use `set_cell(page, "H2", "500")` — direct Name Box navigation.

---

## What the OLD injection got wrong

The previous approach:
1. Used Ctrl+F to find the email → cursor lands on col A
2. Pressed Home + ArrowRight×N to navigate to target column
3. **Problem:** Home doesn't always go to col A in Google Sheets (frozen columns,
   merged cells, filters). ArrowRight skips over hidden columns. The cursor drifted.
4. After pressing Tab to confirm, the cursor moved to the next column, so re-finding
   was needed for each cell — each re-find introduced more drift.
5. Result: Values written to wrong cells, including overwriting a header.

The new `set_cell(page, "H2", "500")` approach clicks the Name Box, types the exact
cell reference, and presses Enter. Zero ambiguity.

---

## Global Reset

```python
page.goto(WEBAPP_URL + "?action=reset", wait_until="domcontentloaded")
page.wait_for_timeout(15000)
# Verify: page shows "All Test Data Reset Successfully!"
# NOTE: Text is in an iframe — page.inner_text('body') returns empty.
# Use page.content() or page.screenshot() to verify.
```

Reset clears: AutomatedQueue, ManualQueue, TransactionLedger, SystemLog,
form responses, and resets Spent/Encumbered to 0 in UserDirectory.

Reset does NOT clear: UserDirectory rows, names, roles, approvers, or allocated amounts.
Reset does NOT cancel any Amazon orders already placed via API.

---

## Scenario Rewrites Needed

Each scenario file in `scenarios/` imports from the OLD `helpers.sheets` API.
They need to be updated to use the new `set_cell(page, "H2", "500")` pattern.

### A1: Auto-Approval ($45)

**Inject** (UserDirectory row 2):
```python
page = open_sheet(context, BUDGET_HUB, "UserDirectory")
set_cell(page, "D2", "Teacher")
set_cell(page, "G2", "invoicing@keswickchristian.org")
set_cell(page, "H2", "500")
set_cell(page, "I2", "0")
set_cell(page, "J2", "0")
set_cell(page, "M2", "TRUE")
page.close()
```
**Execute:** Submit Amazon Form — description "Test Item A1", URL any valid Amazon, qty 1, price 45.00
**Verify:** AutomatedQueue → status = "APPROVED (auto)"; OWA → confirmation email

### A2: Velocity ($480 pre-spent + $30)

**Inject:**
```python
# UserDirectory
set_cell(page, "H2", "1000")  # Allocated
set_cell(page, "G2", "invoicing@keswickchristian.org")  # Approver

# TransactionLedger in Automated Hub — add dummy $480 row
# Go to first empty row and add: email, 480, APPROVED (auto), 2026-04-03
```
**Execute:** Submit Amazon Form for $30
**Verify:** AutomatedQueue → status = "PENDING" with VELOCITY note; OWA → approval request email

### A3: Over Threshold ($205)

**Inject:** Reset first, then set H2 = 1000
**Execute:** Submit Amazon Form for $205
**Verify:** AutomatedQueue → PENDING → open approval email → extract script.google.com link → approve → APPROVED

### A4: Over Budget ($150 on $50)

**Inject:** Set H2 = 50, I2 = 0
**Execute:** Submit Amazon Form for $150
**Verify:** AutomatedQueue → PENDING; OWA → email contains "OVER BUDGET"

### B1: Curriculum ($25)

**Inject:** Ensure G2 = invoicing@
**Execute:** Submit Curriculum Form
**Verify:** Manual Hub ManualQueue → PENDING; OWA → email contains resource name

### B2: Field Trip

**Execute:** Submit Field Trip Form (Tampa Museum of Science, 2026-05-15, 30 students, Bus, $450)
**Verify:** Manual Hub ManualQueue → PENDING; OWA → email contains trip details

---

## Google Forms — Unverified Selectors

The `helpers/forms.py` fills forms by finding all visible text inputs in order.
Google Forms DOM structure varies. **Before running any form submission:**
1. Open the form URL in the persistent browser manually
2. Use browser DevTools to inspect the actual input elements
3. Verify that `fill_text_fields()` targets the right inputs

The Amazon Form fields in order (expected):
1. Item Description (text)
2. Item URL (text)
3. Quantity (number)
4. Unit Price (number)

**This has NOT been verified.** The form may have dropdowns, radio buttons, or multi-section
layouts that `fill_text_fields()` can't handle.

---

## OWA — Unverified Selectors

`helpers/owa.py` uses generic selectors for OWA search and message interaction.
OWA's DOM changes frequently. The selectors may need updating:

```python
# Search box — try these in order:
"[aria-label='Search']"
"#topSearchInput"
"input[type='search']"

# Message list items:
"[role='option']"
"[data-convid]"

# Delete button:
"[aria-label='Delete']"
"button:has-text('Delete')"
```

**Recommendation:** Before automating OWA, manually test each selector in the browser console.

---

## Environment

- Python venv: `/Users/mtrotter/budget-system/venv`
- Playwright 1.58.0 with Chromium installed
- Activate: `source venv/bin/activate`
- Run bootstrap: `python tests/e2e/bootstrap.py`
- Run preflight: `python tests/e2e/preflight.py`

---

## What to Do Next

1. **Update scenario files** to use new `set_cell(page, "REF", "value")` API
2. **Verify form selectors** by opening each form URL and inspecting DOM
3. **Verify OWA selectors** similarly
4. **Run A1 inject manually first** — just the inject step, then screenshot to confirm values landed correctly
5. **Then run A1 execute + verify**
6. **Proceed through A2-B2 sequentially**, resetting between each

---

## Key URLs

| Resource | URL |
|----------|-----|
| Budget Hub | `https://docs.google.com/spreadsheets/d/1GpCs2p3dra7xf68Ezz-FSsIScqtc7A62h95FIDc-mKY/edit` |
| Automated Hub | `https://docs.google.com/spreadsheets/d/1nYl89UUBtk4U1CpcVtX0p3V6wZkCkKD8XtR1eWNza5E/edit` |
| Manual Hub | `https://docs.google.com/spreadsheets/d/1MxYNCHZD1SsqcB2oeX5FEgddA6pFRyK-0foCT8SZjYw/edit` |
| WebApp | `https://script.google.com/a/keswickchristian.org/macros/s/AKfycbwUAhH2X8jnj53SQ4fZ-TqGMH_OE-r1ySbQIaKS9e1vu8Z5I3ib82mFGEZ_tdZl3iSmaA/exec` |
| Amazon Form | `https://docs.google.com/forms/d/1Ew8fgcI-wdJmRDftG2CHAIIay3dtF-RYt3ktuuSpV70/viewform` |
| Curriculum Form | `https://docs.google.com/forms/d/1v8I7re72IyU7NapXBpwsTaib8gY3DC1E56DWi5JCR-8/viewform` |
| Field Trip Form | `https://docs.google.com/forms/d/1K1B9KLo-J4sO8J-RLOut9DIm5uMwdj14iaFJu4l4v8Y/viewform` |
| OWA Inbox | `https://outlook.office365.com/mail/inbox` |

## Key Source Files

| File | What to look at |
|------|----------------|
| `Budget_System--Processing/Config.gs` | Hub IDs, form IDs, thresholds, TRIAL_MODE at line 104 |
| `Budget_System--Processing/Budget_Engine.gs:12-41` | UserDirectory schema — `getUserBudgetInfo()` |
| `Budget_System--Processing/Amazon_Engine.js:319-330` | TrialMode safety logic |
| `Budget_System--Processing/Forms_Engine.gs` | COLUMN_MAP, form processing, approval routing |
| `Budget_System--Processing/Main.gs:610` | `resetAllTestData()` |
| `Budget_System--Processing/Main.gs:536` | `doGet()` — WebApp entry point |
