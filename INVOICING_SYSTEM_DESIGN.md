# Invoicing System Design

**Version:** 2.0

**Last Updated:** February 11, 2026

---

## Overview

The Budget System generates two types of invoices:
1. **Batch Invoices** - Amazon & Warehouse (grouped by division)
2. **Single Invoices** - Field Trip, Curriculum, Admin (per transaction)

---

## ID Formats

### Transaction ID
- **Scope:** Individual line item from form submission
- **Format:** `{FormPrefix}-{SequentialNumber}`
- **Resets:** Annually (fiscal year)
- **Examples:**
  - `AMZ-0001` - First Amazon transaction of fiscal year
  - `WHS-0142` - 142nd Warehouse transaction
  - `FLD-0023` - 23rd Field Trip transaction
  - `CUR-0089` - 89th Curriculum transaction
  - `ADM-0015` - 15th Admin transaction

### Invoice ID
- **Scope:** PDF document (can contain multiple transactions)
- **Format:** `{FormPrefix}-{Division/Identifier}-{MMDD}[-{Increment}]`
- **Increment:** Starts at `-02` for second invoice same day (first has no suffix)

| Form Type | Division/ID | Example | Notes |
|-----------|-------------|---------|-------|
| Amazon | Division code | `AMZ-US-0211` | Upper School, Feb 11 |
| Amazon (2nd) | Division code | `AMZ-US-0211-02` | Second of day |
| Warehouse Internal | Division code | `WHS-LS-0214` | Lower School, Feb 14 |
| Warehouse External | (none) | `WHS-0214` | Combined for vendor |
| Field Trip | Division code | `FLD-KK-0211` | Keswick Kids |
| Curriculum | Department code | `CUR-MATH-0211` | Math Department |
| Admin | User initials | `ADM-MJT-0211` | Mark J Trotter |

---

## Invoice Types & Generation

### Batch Invoices

#### Amazon (Internal)
- **Schedule:** Tuesday & Friday
- **Grouping:** By Division (US, LS, KK)
- **Content:** All approved Amazon transactions since last batch
- **Output:** Up to 3 invoices per batch day (one per division with transactions)
- **Signatures:** Division Principal + Sherilyn Neel (BO)

#### Warehouse Internal
- **Schedule:** Wednesday
- **Grouping:** By Division (US, LS, KK)
- **Content:** All approved Warehouse transactions since last batch
- **Output:** Up to 3 internal invoices per batch day
- **Signatures:** Division Principal + Sherilyn Neel (BO)

#### Warehouse External
- **Schedule:** Wednesday (same as internal)
- **Grouping:** ALL divisions combined
- **Content:** All Warehouse transactions for the week
- **Output:** 1 external invoice to warehouse vendor
- **Signatures:** Sherilyn Neel (BO) only? Or BO + CFO?

### Single Invoices (Generated on Approval)

#### Field Trip
- **Trigger:** Immediately upon approval
- **Content:** Single transaction
- **Organization:** Division
- **Signatures:** Division Principal + Beth Endrulat (CFO)

#### Curriculum
- **Trigger:** Immediately upon approval
- **Content:** Single transaction
- **Organization:** Department
- **Signatures:** Division Principal (per audit) + Sherilyn Neel (BO)

#### Admin
- **Trigger:** Auto-approved, invoice generated immediately
- **Content:** Single transaction
- **Organization:** Administration
- **Signatures:** Self (the admin) + Beth Endrulat (CFO)

---

## Signature Matrix

| Invoice Type | Left Signature | Right Signature |
|--------------|----------------|-----------------|
| Amazon batch | Division Principal | Sherilyn Neel |
| Warehouse internal | Division Principal | Sherilyn Neel |
| Warehouse external | Sherilyn Neel | (single signature?) |
| Field Trip | Division Principal | Beth Endrulat |
| Curriculum | Division Principal | Sherilyn Neel |
| Admin | Self (admin user) | Beth Endrulat |

### Division Principals
| Division | Principal | Email |
|----------|-----------|-------|
| US | Lee Mortimer | lmortimer@keswickchristian.org |
| LS | D. Dumais | ddumais@keswickchristian.org |
| KK | S. Carmichael | scarmichael@keswickchristian.org |

### Business Office Signers
| Role | Name | Forms |
|------|------|-------|
| Business Office | Sherilyn Neel | Amazon, Warehouse, Curriculum |
| CFO | Beth Endrulat | Field Trip, Admin |

---

## Invoice Templates

### Batch Invoice Layout (Amazon/Warehouse)

```
┌─────────────────────────────────────────────────────────────────┐
│ [KCS Text Logo]                                    INVOICE      │
│ 10100 54th Avenue North                                         │
│ St. Petersburg, FL 33708                      AMZ-US-0211       │
│ (727) 522-2111                               February 11, 2026  │
├─────────────────────────────────────────────────────────────────┤
│ DIVISION: Upper School          FORM TYPE: Amazon Orders        │
│ FISCAL PERIOD: Q3 FY2025-26     BATCH DATE: February 11, 2026   │
├─────────────────────────────────────────────────────────────────┤
│ #  │ TXN ID    │ Requestor       │ Description          │ Amount│
│────┼───────────┼─────────────────┼──────────────────────┼───────│
│ 1  │ AMZ-0142  │ Sarah Johnson   │ Lab Goggles (3x)     │ $74.97│
│ 2  │ AMZ-0145  │ Mike Chen       │ Calculators (5x)     │ $89.00│
│ 3  │ AMZ-0147  │ Sarah Johnson   │ Digital Thermometers │ $62.50│
│ 4  │ AMZ-0151  │ Lisa Park       │ Printer Paper        │ $45.99│
├─────────────────────────────────────────────────────────────────┤
│                                              TOTAL: $272.46     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ____________________              ____________________          │
│ Lee Mortimer                      Sherilyn Neel                 │
│ Principal, Upper School           Business Office               │
│ February 11, 2026                 February 11, 2026             │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ [KCS Seal Watermark - Subtle Background]                        │
│ Keswick Christian School | Budget Management System             │
└─────────────────────────────────────────────────────────────────┘
```

### Single Invoice Layout (Field Trip/Curriculum/Admin)

```
┌─────────────────────────────────────────────────────────────────┐
│ [KCS Text Logo]                                    INVOICE      │
│ 10100 54th Avenue North                                         │
│ St. Petersburg, FL 33708                      FLD-US-0211       │
│ (727) 522-2111                               February 11, 2026  │
├─────────────────────────────────────────────────────────────────┤
│ TRANSACTION DETAILS                 REQUESTOR INFORMATION       │
│ ─────────────────────               ──────────────────────      │
│ Transaction ID: FLD-0023            Requested By: Sarah Johnson │
│ Form Type: Field Trip               Department: Science         │
│ Fiscal Quarter: Q3 FY2025-26        Division: Upper School      │
│                                     Date Submitted: Feb 10, 2026│
├─────────────────────────────────────────────────────────────────┤
│ #  │ Description                              │ Qty │   Amount  │
│────┼──────────────────────────────────────────┼─────┼───────────│
│ 1  │ Museum of Science & Industry             │  45 │   $450.00 │
│    │ Trip Date: March 15, 2026                │     │           │
│    │ Transportation: Charter Bus              │     │           │
├─────────────────────────────────────────────────────────────────┤
│                                              TOTAL: $450.00     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ____________________              ____________________          │
│ Lee Mortimer                      Beth Endrulat                 │
│ Principal, Upper School           Chief Financial Officer       │
│ February 11, 2026                 February 11, 2026             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Drive Folder Structure

```
Budget_System_Invoices/
├── FY2025-26/
│   ├── Q1/
│   │   ├── Amazon/
│   │   │   ├── US/
│   │   │   ├── LS/
│   │   │   └── KK/
│   │   ├── Warehouse/
│   │   │   ├── Internal/
│   │   │   │   ├── US/
│   │   │   │   ├── LS/
│   │   │   │   └── KK/
│   │   │   └── External/
│   │   ├── Field_Trip/
│   │   │   ├── US/
│   │   │   ├── LS/
│   │   │   └── KK/
│   │   ├── Curriculum/
│   │   │   ├── Math/
│   │   │   ├── Science/
│   │   │   ├── English/
│   │   │   └── .../
│   │   └── Admin/
│   ├── Q2/
│   ├── Q3/
│   └── Q4/
└── FY2026-27/
```

---

## Batch Processing Logic

### Amazon Batch (Tuesday & Friday)

```javascript
function runAmazonBatch() {
  // 1. Get all approved Amazon transactions not yet invoiced
  // 2. Group by Division
  // 3. For each division with transactions:
  //    a. Generate Invoice ID: AMZ-{DIV}-{MMDD}[-{increment}]
  //    b. Create PDF with batch template
  //    c. Store in Drive: FY/Quarter/Amazon/{Division}/
  //    d. Update TransactionLedger: InvoiceGenerated=YES, InvoiceID, InvoiceURL
  // 4. Log batch completion
}
```

### Warehouse Batch (Wednesday)

```javascript
function runWarehouseBatch() {
  // 1. Get all approved Warehouse transactions not yet invoiced
  // 2. Group by Division for internal invoices
  // 3. For each division with transactions:
  //    a. Generate internal invoice (WHS-{DIV}-{MMDD})
  //    b. Store in Drive: FY/Quarter/Warehouse/Internal/{Division}/
  // 4. Generate ONE external invoice (WHS-{MMDD}) for all transactions
  //    - Store in Drive: FY/Quarter/Warehouse/External/
  // 5. Update TransactionLedger for all
}
```

### Single Invoice Generation (On Approval)

```javascript
function generateSingleInvoice(transactionId, formType) {
  // 1. Get transaction details from ledger
  // 2. Determine Invoice ID based on form type:
  //    - Field Trip: FLD-{DIV}-{MMDD}
  //    - Curriculum: CUR-{DEPT}-{MMDD}
  //    - Admin: ADM-{INITIALS}-{MMDD}
  // 3. Create PDF with single template
  // 4. Store in appropriate Drive folder
  // 5. Update TransactionLedger
}
```

---

## Triggers

| Trigger | Function | Schedule |
|---------|----------|----------|
| Amazon Batch | `runAmazonBatch` | Tuesday 6:00 AM, Friday 6:00 AM |
| Warehouse Batch | `runWarehouseBatch` | Wednesday 6:00 AM |
| Single Invoice | `generateSingleInvoice` | Called on approval (not scheduled) |

---

## Questions Resolved

1. ✅ Warehouse has internal (by division) + external (combined) invoices
2. ✅ Amazon is internal only (for audit trail)
3. ✅ Invoice ID format: Prefix-Division/ID-MMDD[-increment]
4. ✅ Increment starts at -02 (first has no suffix)
5. ✅ Admin uses initials (ADM-MJT-0211)
6. ✅ Curriculum shows division approver on invoice (per audit)
7. ✅ Batch days: Amazon Tue/Fri, Warehouse Wed

---

## Implementation Checklist

- [ ] Update Transaction ID generation (fiscal year reset)
- [ ] Create Invoice ID generator with increment logic
- [ ] Rewrite batch invoice template
- [ ] Rewrite single invoice template
- [ ] Create `runAmazonBatch()` function
- [ ] Create `runWarehouseBatch()` function
- [ ] Update `processApprovalDecision()` to trigger single invoices
- [ ] Update Admin form for auto-approve + immediate invoice
- [ ] Create batch triggers (Tue/Fri, Wed)
- [ ] Update Drive folder structure
- [ ] Test end-to-end flow
