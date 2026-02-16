# Budget System Authorization Scenarios

**Document Purpose:** Comprehensive outline of all authorization flows per form type for verification.

**Last Updated:** February 11, 2026

---

## System Configuration

| Setting | Value | Location |
|---------|-------|----------|
| Auto-Approval Threshold | $200 | `Config.gs:45` |
| Daily Velocity Limit | $500/day | Forms_Engine.gs |
| Business Office Email | mtrotter@keswickchristian.org | `Config.gs:51` |
| Test Mode | `true` (currently) | `Config.gs:58` |

---

## User Directory Structure (Budget Hub → UserDirectory)

| Column | Field | Purpose |
|--------|-------|---------|
| A | Email | User identifier |
| B | FirstName | Display name |
| C | LastName | Display name |
| D | Role | User's role (Teacher, Admin, etc.) |
| E | Department | Budget department |
| F | Division | US, LS, KK, AD |
| **G** | **Approver** | **Email of designated approver** |
| H | BudgetAllocated | Annual budget |
| I | BudgetSpent | YTD spending |
| J | BudgetEncumbered | Pending approvals |
| K | BudgetRemaining | Available budget |
| L | UtilizationRate | % used |
| M | Active | TRUE/FALSE |

**Key:** The `Approver` field (Column G) determines who receives approval requests for each user.

---

## Form Types & Processing Hubs

| Form | Hub | Queue | Auto-Approval Eligible |
|------|-----|-------|------------------------|
| Amazon | Automated Hub | AutomatedQueue | **YES** |
| Warehouse | Automated Hub | AutomatedQueue | **YES** |
| Field Trip | Manual Hub | ManualQueue | NO |
| Curriculum | Manual Hub | ManualQueue | NO |
| Admin | Manual Hub | ManualQueue | NO |

---

## Authorization Scenarios by Form

### 1. AMAZON FORM

**Flow:** Form Submit → AutomatedQueue → Check Conditions → Route

#### Scenario 1A: Auto-Approval (Happy Path)
```
Conditions:
  ✓ Amount < $200 (AUTO_APPROVAL_LIMIT)
  ✓ Amount ≤ Available Budget
  ✓ Daily Velocity ≤ $500

Result:
  → Status: APPROVED (auto)
  → Approver: User's designated approver (from UserDirectory)
  → Notification: Approval confirmation sent to requestor
  → Budget: Encumbrance added
  → Next: Awaits batch processing for Amazon order
```

#### Scenario 1B: Manual Approval Required (Over Threshold)
```
Conditions:
  ✗ Amount ≥ $200

Result:
  → Status: PENDING
  → Approval Email: Sent to designated approver
  → WebApp Link: Included for approve/reject
  → Budget: Encumbrance added (pending)
```

#### Scenario 1C: Manual Approval Required (Over Budget)
```
Conditions:
  ✓ Amount < $200
  ✗ Amount > Available Budget

Result:
  → Status: PENDING
  → Approval Email: Sent to designated approver
  → Warning: "OVER BUDGET" flag in email
  → Budget Context: Shows current utilization
```

#### Scenario 1D: Manual Approval Required (Velocity Exceeded)
```
Conditions:
  ✓ Amount < $200
  ✓ Within Budget
  ✗ Daily spending > $500

Result:
  → Status: PENDING
  → Approval Email: Sent to designated approver
  → Log: AUTO_APPROVAL_DENIED_VELOCITY
```

---

### 2. WAREHOUSE FORM

**Flow:** Form Submit → AutomatedQueue → Check Conditions → Route

#### Scenario 2A: Auto-Approval
```
Conditions:
  ✓ Amount < $200
  ✓ Amount ≤ Available Budget

Result:
  → Status: APPROVED (auto)
  → Notification: Sent to requestor
  → Note: No velocity check for Warehouse
```

#### Scenario 2B: Manual Approval Required
```
Conditions:
  ✗ Amount ≥ $200 OR Amount > Available Budget

Result:
  → Status: PENDING
  → Approval Email: Sent to designated approver
```

---

### 3. FIELD TRIP FORM

**Flow:** Form Submit → ManualQueue → ALWAYS Requires Approval

#### Scenario 3A: Standard Approval Request
```
Conditions:
  - Any amount (no auto-approval)

Result:
  → Status: PENDING
  → Approval Email: Sent to designated approver
  → Includes: Trip details, student count, transportation type
  → PDF: Attached if uploaded
```

**Rationale:** Field trips require administrative oversight regardless of cost.

---

### 4. CURRICULUM FORM

**Flow:** Form Submit → ManualQueue → ALWAYS Requires Approval

#### Scenario 4A: Standard Approval Request
```
Conditions:
  - Any amount (no auto-approval)

Result:
  → Status: PENDING
  → Approval Email: Sent to designated approver
  → Includes: Resource name, ISBN, quantity
  → PDF: Attached if uploaded
```

**Rationale:** Curriculum purchases require review for educational alignment.

---

### 5. ADMIN FORM

**Flow:** Form Submit → ManualQueue → ALWAYS Requires Approval

#### Scenario 5A: Standard Approval Request
```
Conditions:
  - Any amount (no auto-approval)

Result:
  → Status: PENDING
  → Approval Email: Sent to designated approver
  → Includes: Purchase description, rationale
  → PDF: Attached if uploaded
```

**Rationale:** Administrative purchases require oversight.

---

## Approval Processing

### WebApp Approval Flow
```
1. Approver clicks link in email
2. WebApp loads with transaction details
3. Approver sees:
   - Request type & amount
   - Requestor name
   - Budget context (available, utilization %)
   - Items/description
4. Approver clicks APPROVE or REJECT
5. If REJECT: Must provide reason
6. System processes decision
```

### Approval Validation
```javascript
// Who can approve?
1. Designated approver (UserDirectory.Approver)
2. Business Office (CONFIG.BUSINESS_OFFICE_EMAIL)
3. Division Heads (hardcoded in validateApprover)
4. [TEST MODE] invoicing@keswickchristian.org
```

### Post-Approval Actions

#### On APPROVE:
```
1. Update queue status → APPROVED
2. Send confirmation to requestor
3. Update budget encumbrance
4. For Manual items: Move to TransactionLedger
5. For Automated items: Await batch processing
```

#### On REJECT:
```
1. Update queue status → REJECTED
2. Send rejection notification to requestor
3. Release budget hold
4. For Automated: Offer resubmission option
```

---

## Approver Hierarchy

### Determination Logic (`getApproverForRequest`)
```
1. Check UserDirectory.Approver field
2. If found → Use that email
3. If empty → Fallback to Business Office
```

### Current Approver Mapping (Expected)
| Division | Typical Approver |
|----------|------------------|
| Upper School | usprincipal@keswickchristian.org |
| Lower School | lsprincipal@keswickchristian.org |
| Keswick Kids | kkprincipal@keswickchristian.org |
| Administration | mtrotter@keswickchristian.org |

**Note:** Actual approvers are defined per-user in UserDirectory.Approver column.

---

## Budget Validation

### Pre-Approval Check (`validateBudgetBeforeApproval`)
```
Available = Allocated - Spent - Encumbered

If Amount ≤ Available → Approval allowed
If Amount > Available → Approval blocked (APPROVAL_BLOCKED_OVERBUDGET)
```

### Encumbrance Flow
```
1. Form submitted → Encumbrance ADDED (pending)
2. Approved → Encumbrance remains until invoiced
3. Rejected → Encumbrance RELEASED
4. Invoiced → Encumbrance → Spent
```

---

## Email Notifications

| Event | Recipient | Email Type |
|-------|-----------|------------|
| Form submitted (needs approval) | Approver | Enhanced Approval Email |
| Auto-approved | Requestor | Approval Notification |
| Manually approved | Requestor | Approval Confirmation |
| Rejected | Requestor | Rejection Notification |
| Stale (>72 hours) | Approver | Approval Reminder |
| Critical error | Business Office | Error Digest |

---

## Test Mode Behavior

When `CONFIG.TEST_MODE = true`:
- All emails redirected to `invoicing@keswickchristian.org`
- `invoicing@keswickchristian.org` can approve any request
- Super-admin override enabled

**Production:** Set `TEST_MODE = false` in Script Properties

---

## Verification Checklist

### Per-Form Verification
- [ ] **Amazon:** Submit <$200 → Should auto-approve
- [ ] **Amazon:** Submit >$200 → Should request approval
- [ ] **Warehouse:** Submit <$200 → Should auto-approve
- [ ] **Field Trip:** Any amount → Should request approval
- [ ] **Curriculum:** Any amount → Should request approval
- [ ] **Admin:** Any amount → Should request approval

### Approval Flow Verification
- [ ] Approval email received by correct approver
- [ ] WebApp loads with correct transaction data
- [ ] APPROVE button works, sends confirmation
- [ ] REJECT button requires reason
- [ ] Budget updates correctly after approval
- [ ] Rejection releases encumbrance

### Edge Cases
- [ ] User not in directory → Error notification
- [ ] No approver defined → Fallback to Business Office
- [ ] Over budget approval → Blocked with message
- [ ] Velocity limit exceeded → Manual approval required

---

## File References

| Component | File | Key Lines |
|-----------|------|-----------|
| Form Processing | Forms_Engine.gs | 50-700 |
| Approval Logic | Forms_Engine.gs | 702-796 |
| Approver Routing | Budget_Engine.gs | 67-78 |
| Budget Validation | Budget_Engine.gs | 80-110 |
| Config Settings | Config.gs | 28-154 |
| WebApp Handler | Main.gs | 577+ |
| Email Templates | Communication.js | All |

---

## Questions for User Verification

1. **Is the $200 auto-approval threshold correct?**
2. **Should Field Trip/Curriculum/Admin have auto-approval option?**
3. **Is the approver assignment per UserDirectory correct?**
4. **Should there be amount-based escalation (e.g., >$1000 to CFO)?**
5. **Are the current division heads correctly mapped?**

---

*This document should be reviewed against actual UserDirectory data to verify approver assignments.*
