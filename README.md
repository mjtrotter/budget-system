# Budget System

> Automated invoice generation and budget tracking system for Keswick School

**Status:** Production
**Stack:** Google Apps Script, Google Sheets, Google Drive

---

## Overview

The Budget System is a comprehensive Google Apps Script-based solution for managing school budgets and automating invoice generation. It consists of three integrated components (arms) that work together to process transactions, generate invoices, and provide budget tracking dashboards.

### Key Features

- Automated invoice generation from Google Forms submissions
- Multi-hub data integration (Budget Hub, Automated Hub, Manual Hub)
- Intelligent transaction batching and line item retrieval
- Professional PDF invoice generation with customizable templates
- Budget tracking and division-level spending monitoring
- Overnight automated processing with email notifications
- Comprehensive error handling and system health checks

---

## System Architecture

### Three-Arm System

```
budget-system/
├── Budget_System--Dashboard Arm/     # Budget monitoring and reporting
│   ├── Dashboard_API              # API endpoints
│   ├── Dashboard_BE               # Backend logic
│   └── Dashboard_UI.html           # UI interface
├── Budget_System--Invoicing Arm/     # Invoice generation (CORE)
│   ├── Main                        # Main processing logic
│   ├── Phase 1-5                   # Processing phases
│   ├── QuickStartGuide.js          # Testing functions
│   ├── TestAndDiagnostic.js        # System validation
│   ├── appsscript.json             # Apps Script manifest
│   ├── single_internal_template.html
│   ├── batch_internal_template.html
│   └── warehouse_external_template.html
└── Budget_System--Processing/        # Backend processing engine
    ├── Main                        # Entry point
    ├── Amazon_Engine.js            # Amazon order processing
    ├── Communication.js            # Email/notification logic
    ├── Test_Suite.js               # Automated tests
    └── WebApp.html                 # Web interface
```

### Data Flow

1. **Form Submission** → Google Forms (Amazon, Warehouse, Admin, Field Trip, Curriculum)
2. **Data Collection** → Automated Hub / Manual Hub spreadsheets
3. **Processing** → Invoicing Arm retrieves transactions and line items
4. **Invoice Generation** → HTML templates → PDF invoices
5. **Storage** → Google Drive folder structure (organized by division/date)
6. **Tracking** → Budget Hub updates with spending data

---

## Prerequisites

- Google Account with access to Keswick School Drive
- Access to Budget Hub, Automated Hub, and Manual Hub spreadsheets
- [clasp CLI](https://github.com/google/clasp) (optional, for local development)
- Node.js 18+ (optional, for clasp)

---

## Installation

### Option 1: Web IDE Deployment (Recommended)

#### 1. Open Google Apps Script

Visit [script.google.com](https://script.google.com) and create a new project named "Keswick Invoice System"

#### 2. Upload Core Files

**For Invoicing Arm:**
- Navigate to `Budget_System--Invoicing Arm/`
- Upload `Main` as `Main.gs`
- Upload `Phase 1` through `Phase 5` as separate `.gs` files
- Upload `QuickStartGuide.js` and `TestAndDiagnostic.js`
- Upload 3 HTML template files as HTML files (not script files):
  - `single_internal_template.html`
  - `batch_internal_template.html`
  - `warehouse_external_template.html`
- Upload `appsscript.json` to replace default manifest

**For Processing Arm:**
- Create separate Apps Script project for backend processing
- Upload files from `Budget_System--Processing/`

**For Dashboard Arm:**
- Create separate Apps Script project for dashboard
- Upload files from `Budget_System--Dashboard Arm/`

#### 3. Configure System

Open `Main.gs` in Invoicing Arm and update the `CONFIG` object:

```javascript
const CONFIG = {
  // Spreadsheet IDs
  BUDGET_HUB_ID: 'your_budget_hub_spreadsheet_id',
  AUTOMATED_HUB_ID: 'your_automated_hub_spreadsheet_id',
  MANUAL_HUB_ID: 'your_manual_hub_spreadsheet_id',

  // Drive folder for invoices
  INVOICE_ROOT_FOLDER_ID: 'your_invoice_folder_id',

  // School branding
  SCHOOL_LOGO_FILE_ID: 'your_logo_file_id',

  // Notification emails
  ERROR_NOTIFICATION_EMAIL: 'admin@keswick.edu',
  HEALTH_CHECK_EMAIL: 'admin@keswick.edu',

  // Division signatures
  DIVISION_SIGNATURES: {
    'Upper School': {
      name: 'Principal Name',
      title: 'Principal',
      signatureFileId: 'signature_file_id'
    },
    'Middle School': { /* ... */ },
    'Lower School': { /* ... */ },
    // ... add all divisions
  }
};
```

#### 4. Enable Required Services

In Apps Script editor:
1. Click **Libraries/Services**
2. Enable:
   - Google Sheets API
   - Google Drive API
   - Gmail API

#### 5. Initialize System

```javascript
// Run once to validate configuration
initializeInvoiceSystem();

// Grant permissions when prompted
```

#### 6. Test System

```javascript
// Run comprehensive test
quickTest();

// Or use step-by-step guide
step1_CheckBudgetStructure();
step2_TestDivisionBudget();
step3_TestHealthCheck();
step4_TestPDFGeneration();
step5_TestTemplateProcessing();
```

#### 7. Setup Automation

```javascript
// Enable overnight processing at 3 AM
setupOvernightTrigger();
```

### Option 2: Local Development with clasp (Advanced)

#### 1. Install clasp

```bash
npm install -g @google/clasp
clasp login
```

#### 2. Navigate to Component

```bash
cd apps/business/budget-system/Budget_System--Invoicing\ Arm
```

#### 3. Create or Clone Project

**New project:**
```bash
clasp create --type standalone --title "Keswick Invoice System"
```

**Existing project:**
```bash
clasp clone [SCRIPT_ID]
# Find SCRIPT_ID in: File > Project Properties > Script ID
```

#### 4. Push Files

```bash
clasp push
```

#### 5. Open in Web Editor

```bash
clasp open
```

Complete steps 3-7 from Option 1 above.

---

## Usage

### Automated Processing

Once `setupOvernightTrigger()` is configured, the system runs automatically at 3 AM daily:
1. Retrieves new transactions from hubs
2. Processes line items and enriches data
3. Generates invoices (individual or batched)
4. Stores PDFs in Drive
5. Updates Budget Hub
6. Sends health check email notification

### Manual Processing

```javascript
// Generate invoices for pending transactions
main();

// OR use core function directly
generateInvoices();
```

### Testing Individual Transactions

```javascript
// Test specific transaction by ID
testLineItemRetrieval('TRANS-20250101-001');

// Test invoice generation for transaction
testInvoiceGeneration();
```

### System Maintenance

```javascript
// Run health checks
performSystemHealthChecks();

// Validate configuration
validateConfiguration();

// Test hub connections
testHubConnections();

// Verify templates loaded
verifyTemplates();

// Clean up triggers
removeAllTriggers();
```

---

## Invoice Types

### 1. Single Internal Invoice
**Template:** `single_internal_template.html`
**Use:** Individual transactions (Admin, Field Trip, Curriculum forms)

### 2. Batch Internal Invoice
**Template:** `batch_internal_template.html`
**Use:** Multiple related transactions batched together

### 3. Warehouse External Invoice
**Template:** `warehouse_external_template.html`
**Use:** External purchase orders from warehouse suppliers

---

## Configuration

### Required Spreadsheet IDs

Find spreadsheet IDs in the URL:
```
https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
```

- **Budget Hub:** Central budget tracking and system log
- **Automated Hub:** Google Forms responses (Amazon, Warehouse)
- **Manual Hub:** Manually entered transactions

### Drive Folder Structure

```
Invoice Root Folder/
├── Upper School/
│   ├── 2025-01/
│   │   ├── INVOICE-20250115-001.pdf
│   │   └── INVOICE-20250116-002.pdf
│   └── 2025-02/
├── Middle School/
└── Lower School/
```

### Email Notifications

System sends emails for:
- Daily health check summaries (3 AM)
- Critical errors (immediate)
- Invoice generation confirmations (optional)

---

## Troubleshooting

### Common Issues

**1. Permission Errors**
- Ensure all required services are enabled in Apps Script
- Run `initializeInvoiceSystem()` to grant permissions
- Check that script has access to all spreadsheets and Drive folders

**2. Template Not Found Errors**
- Verify HTML template files are uploaded as **HTML files**, not script files
- Check template names match exactly: `single_internal_template.html`, etc.
- Run `verifyTemplates()` to check template availability

**3. Configuration Errors**
- Validate all IDs in CONFIG object are correct
- Run `validateConfiguration()` to check settings
- Ensure spreadsheet IDs don't have extra characters or spaces

**4. Invoice Generation Failures**
- Check Apps Script execution transcript for detailed errors
- Review SystemLog sheet in Budget Hub for operation history
- Test specific transaction with `testLineItemRetrieval(transactionId)`

### Debug Functions

```javascript
// Comprehensive system validation
testInvoiceGeneration();

// Check budget structure
checkOrganizationBudgetsStructure();

// Test division budget lookup
testDivisionBudgetInfo();

// Test PDF generation
quickPDFTest();

// Test template processing
testTemplateProcessingFixed();
```

### Execution Logs

View detailed logs in Apps Script:
1. Click "Executions" (play icon with clock)
2. Select execution to view transcript
3. Review errors, warnings, and console output

---

## Development

### Key Functions

**Core Processing:**
- `generateInvoices()` - Main automated processing
- `main()` - Manual invoice generation entry point
- `processTransaction(transaction)` - Single transaction handler

**Setup & Configuration:**
- `initializeInvoiceSystem()` - One-time setup
- `setupOvernightTrigger()` - Configure automation
- `validateConfiguration()` - Config validation

**Testing:**
- `quickTest()` - Quick system test
- `testInvoiceGeneration()` - Comprehensive test
- `step1_CheckBudgetStructure()` through `step6_TestInvoiceGeneration()` - Step-by-step validation

**Maintenance:**
- `performSystemHealthChecks()` - Health status
- `removeAllTriggers()` - Clean up automation
- `testHubConnections()` - Verify spreadsheet access

### Code Organization

**Phase-Based Processing:**
- **Phase 1:** Transaction retrieval
- **Phase 2:** Line item enrichment
- **Phase 3:** Data validation
- **Phase 4:** Template processing
- **Phase 5:** PDF generation and storage

### Template Syntax

Templates use Google Apps Script template engine:

```html
<!-- Simple output -->
<?= data.invoiceNumber ?>

<!-- Conditionals -->
<? if (data.hasLineItems) { ?>
  <table>...</table>
<? } ?>

<!-- Loops -->
<? data.lineItems.forEach(function(item) { ?>
  <tr>
    <td><?= item.description ?></td>
    <td><?= item.price ?></td>
  </tr>
<? }); ?>
```

---

## System Features

### Intelligent Batching
- Automatically groups related transactions
- Optimizes invoice count
- Maintains clear audit trail

### Error Recovery
- Template processing fallbacks
- Graceful failure handling
- Detailed error logging
- Email notifications for critical issues

### Performance Optimization
- Data caching for frequently accessed info
- Batch spreadsheet operations
- Optimized Drive API usage
- Memory management for large datasets

### Audit Trail
- Complete transaction history in Budget Hub
- SystemLog sheet tracks all operations
- Invoice metadata stored with PDFs
- Email confirmations for processing

---

## Security

- Runs with your Google account permissions
- Restricted access to school spreadsheets and Drive
- Audit logging of all operations
- No external API dependencies

---

## Deployment Checklist

- [ ] All three components deployed to separate Apps Script projects
- [ ] CONFIG object updated with correct IDs
- [ ] Google Services enabled (Sheets, Drive, Gmail)
- [ ] Permissions granted via `initializeInvoiceSystem()`
- [ ] System tested with `quickTest()`
- [ ] Templates verified with `verifyTemplates()`
- [ ] Automation configured with `setupOvernightTrigger()`
- [ ] Health check emails working
- [ ] Invoice folder structure created in Drive
- [ ] All division signatures uploaded and configured

---

## Support & Documentation

**Additional Documentation:**
- [APPS_SCRIPT_SETUP.md](Budget_System--Invoicing%20Arm/APPS_SCRIPT_SETUP.md) - Detailed deployment guide
- QuickStartGuide.js - Step-by-step testing functions
- TestAndDiagnostic.js - System validation tools

**For Issues:**
1. Check Apps Script execution transcript
2. Review SystemLog sheet in Budget Hub
3. Check email notifications for errors
4. Run diagnostic functions listed above

---

**Created:** November 23, 2025
**Last Updated:** November 23, 2025
