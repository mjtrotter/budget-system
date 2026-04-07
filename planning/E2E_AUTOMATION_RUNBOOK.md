# 🤖 Automated E2E Testing Blueprint: Keswick Budget System

**Document Purpose:** A deterministic, step-by-step runbook for browser automation subagents (e.g., Playwright, Selenium, AI Web Agents) to validate the Keswick Budget System's authorization flows.

**Target Domain:** `keswickchristian.org`
**Testing Inbox:** `invoicing@keswickchristian.org` (via Outlook Web / OWA)
**Reference Documentation:** `AUTHORIZATION_SCENARIOS.md`, `INVOICING_SYSTEM_DESIGN.md`

## 🌐 Global Agent Variables
*   **HUB_AUTOMATED_URL:** URL to your "Automated Hub" Google Sheet.
*   **HUB_MANUAL_URL:** URL to your "Manual Hub" Google Sheet.
*   **USER_DIRECTORY_URL:** URL to the Hub housing `UserDirectory`.
*   **FORM_BASE_URL:** URL to the published Google Apps Script web app / Forms.
*   **INBOX_URL:** Outlook Web (OWA) for `invoicing@keswickchristian.org`.
*   **TARGET_EMAIL:** `invoicing@keswickchristian.org`
*   **THRESHOLD:** `$200.00`
*   **VELOCITY_LIMIT:** `$500.00/day`

---

## 📦 Category A: Automated Hub (Amazon & Warehouse)

### Scenario A1: Amazon Auto-Approval (Happy Path)
**Objective:** Verify an order < $200, within budget, and under the $500 daily velocity limit passes cleanly.

*   **Phase 1: State Injection (UserDirectory)**
    1. Update Row for `TARGET_EMAIL`: **Role** = `Teacher`, **Approver** = `TARGET_EMAIL`, **BudgetRemaining** = `$500.00`.
*   **Phase 2: Execution (Amazon Form)**
    1. Navigate to `FORM_BASE_URL` (Amazon Form).
    2. Fill out a valid ASIN/URL. Set order amount to `$45.00`. Submit.
*   **Phase 3: Ledger Verification**
    1. Navigate to `HUB_AUTOMATED_URL` -> **TransactionLedger** (or AutomatedQueue).
    2. Find latest row for `TARGET_EMAIL`.
    3. **Assert:** Status == `APPROVED (auto)`.
    4. **Assert:** Encumbrance added to the user's budget.
*   **Phase 4: Outlook Verification**
    1. Log into Outlook Web as `invoicing@keswickchristian.org`.
    2. Search Inbox: `subject:"Approval confirmation" is:unread`.
    3. Open email, assert receipt, then delete/archive.

### Scenario A2: The Daily Velocity Denial
**Objective:** Verify that multiple rapid, small Amazon orders exceeding $500/day trigger a velocity halt.

*   **Phase 1: State Injection**
    1. Set **BudgetRemaining** = `$1000.00`, **Approver** = `TARGET_EMAIL`.
    2. Inject dummy data into `TransactionLedger` simulating `$480.00` spent today by `TARGET_EMAIL`.
*   **Phase 2: Execution**
    1. Submit Amazon Form for `$30.00`.
*   **Phase 3: Verification**
    1. Check `AutomatedQueue`. **Assert:** Status == `PENDING`.
    2. **Assert:** System log/status note indicates `AUTO_APPROVAL_DENIED_VELOCITY`.
    3. Verify Outlook inbox receives an Approval Email.

### Scenario A3: Over Threshold Routing ($200 Gate)
**Objective:** Verify an Amazon order > $200 pauses for manual approval.

*   **Phase 1: State Injection**
    1. Set **BudgetRemaining** = `$1000.00`, **Approver** = `TARGET_EMAIL`.
*   **Phase 2: Execution**
    1. Submit Amazon Form for `$205.00`.
*   **Phase 3: Verification (Ledger & Outlook)**
    1. Check `AutomatedQueue` / `TransactionLedger`. **Assert:** Status == `PENDING`.
    2. Open Outlook, find the `Approval Request` email.
    3. Extract the WebApp link embedded in the email and navigate to it.
    4. Click "Approve".
    5. Verify Ledger status updates from `PENDING` to `APPROVED`.

### Scenario A4: Over Budget Routing
**Objective:** Verify orders exceeding the user's remaining balance route to the approver with an "OVER BUDGET" warning.

*   **Phase 1: State Injection**
    1. Set **BudgetRemaining** = `$50.00`, **Approver** = `TARGET_EMAIL`.
*   **Phase 2: Execution**
    1. Submit Amazon Form for `$150.00`.
*   **Phase 3: Verification**
    1. Check `AutomatedQueue`. **Assert:** Status == `PENDING`.
    2. Check Outlook Inbox. **Assert:** The approval email contains the text `"OVER BUDGET"`.

---

## 🏛️ Category B: Manual Hub (Field Trip, Curriculum, Admin)
*(Note per AUTHORIZATION_SCENARIOS.md: These forms NEVER auto-approve).*

### Scenario B1: Curriculum Form (Standard Route)
**Objective:** Verify Manual forms always require approval.

*   **Phase 1: State Injection**
    1. Ensure **Approver** = `TARGET_EMAIL`.
*   **Phase 2: Execution (Curriculum Form)**
    1. Navigate to Curriculum Form. Fill Resource Name, ISBN, Qty, cost (`$25.00`). Submit.
*   **Phase 3: Verification**
    1. Navigate to `HUB_MANUAL_URL` -> **ManualQueue**. **Assert:** Status == `PENDING`.
    2. Check Outlook. Open Curriculum approval email.
    3. **Assert:** Email body contains the submitted Resource Name and ISBN.

### Scenario B2: Field Trip Form Review
*   **Phase 1: Execution (Field Trip Form)**
    1. Navigate to Field Trip Form. Enter student count, transportation type. Submit.
*   **Phase 2: Verification**
    1. Check `HUB_MANUAL_URL` -> **ManualQueue**. **Assert:** Status == `PENDING`.
    2. Check Outlook. **Assert:** Email contains trip details matching submission.

---

## 🛠️ Implementation Directives for Subagents
1. **Google Apps Script RPC:** To make "Phase 1: State Injection" fast and reliable, it is highly recommended to expose a hidden `doPost` endpoint in the GAS project (e.g., `?action=setTestState&email=invoicing@keswickchristian.org&budget=500`). This allows configuring the `UserDirectory` via HTTP request rather than brittle UI manipulation.
2. **Outlook (OWA) Automation:** When navigating Outlook Web, use explicit DOM waits (`waitForSelector`) for email subject lines. OWA heavily uses virtualized lists; searching via the top search bar is much more reliable than scrolling through the inbox list.