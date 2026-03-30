# APPS SCRIPT DEPLOYMENT INSTRUCTIONS
# ========================================

## Overview
This Main file is now complete and ready for deployment in Google Apps Script. The system integrates all phases (1-5) of your invoicing system into a single, comprehensive solution with proper template integration.

## Files Required in Apps Script Project
You'll need to upload these files to your Apps Script project:

### 1. Main Script File
- Upload the `Main` file as a `.gs` file (rename to `Main.gs`)

### 2. HTML Template Files  
Upload these three template files as HTML files in Apps Script:
- `single_internal_template.html` - For individual transaction invoices
- `batch_internal_template.html` - For batched transaction invoices  
- `warehouse_external_template.html` - For external purchase orders

### 3. Configuration Updates Required
Before running, update the CONFIG object in Main.gs with your actual IDs:

```javascript
const CONFIG = {
  // Replace these with your actual spreadsheet IDs
  BUDGET_HUB_ID: 'your_budget_hub_spreadsheet_id',
  AUTOMATED_HUB_ID: 'your_automated_hub_spreadsheet_id', 
  MANUAL_HUB_ID: 'your_manual_hub_spreadsheet_id',
  
  // Replace with your Drive folder ID for storing invoices
  INVOICE_ROOT_FOLDER_ID: 'your_invoice_folder_id',
  
  // Replace with your school logo file ID
  SCHOOL_LOGO_FILE_ID: 'your_logo_file_id',
  
  // Update email addresses
  ERROR_NOTIFICATION_EMAIL: 'your_admin@keswick.edu',
  HEALTH_CHECK_EMAIL: 'your_admin@keswick.edu',
  
  // Update signature file IDs for each division
  DIVISION_SIGNATURES: {
    'Upper School': { 
      name: 'Principal Name', 
      title: 'Principal', 
      signatureFileId: 'signature_file_id' 
    },
    // ... update others
  }
};
```

## Apps Script Project Setup Steps

### Step 1: Create New Apps Script Project
1. Go to script.google.com
2. Create a new project
3. Name it "Keswick Invoice System" or similar

### Step 2: Upload Files
1. Delete the default `Code.gs` file
2. Add new script file and paste the Main file content, name it `Main.gs`
3. Add the three HTML template files as HTML files

### Step 3: Enable Required Services
In Apps Script editor:
1. Go to Libraries/Services
2. Enable these services:
   - Google Sheets API
   - Google Drive API  
   - Gmail API

### Step 4: Set Permissions
1. Run the `initializeInvoiceSystem()` function once
2. Grant all required permissions when prompted
3. This will validate your configuration

### Step 5: Test the System
1. Run `quickTest()` to verify everything works
2. Check that test invoice generates successfully
3. Verify template rendering works correctly

### Step 6: Setup Automation
1. Run `setupOvernightTrigger()` to enable daily processing
2. The system will run automatically at 3 AM daily

## Key Features of the Completed System

### Comprehensive Invoice Generation
- ✅ Handles all form types (Amazon, Warehouse, Admin, Field Trip, Curriculum)
- ✅ Intelligent batching for related transactions
- ✅ Line item retrieval and enrichment
- ✅ Proper PDF generation with templates

### Template Integration
- ✅ Apps Script template engine integration
- ✅ Fallback templates for reliability
- ✅ Professional invoice layouts
- ✅ School branding and signatures

### Data Flow Management
- ✅ Complete transaction tracing from form to invoice
- ✅ Multi-hub data integration
- ✅ Proper error handling and logging
- ✅ Budget tracking integration

### Automation Features
- ✅ Overnight processing triggers
- ✅ Health check email notifications
- ✅ Comprehensive error reporting
- ✅ Manual processing capabilities

## Main Functions Available

### Core Functions
- `generateInvoices()` - Main processing function (runs automatically)
- `main()` - Manual invoice generation entry point
- `quickTest()` - System testing function

### Setup Functions  
- `initializeInvoiceSystem()` - One-time setup and validation
- `setupOvernightTrigger()` - Configure automated processing
- `removeAllTriggers()` - Clean up automation

### Testing Functions
- `testInvoiceGeneration()` - Comprehensive system test
- `testLineItemRetrieval(transactionId)` - Test specific transaction

## Important Notes

### Template Files in Apps Script
The HTML template files must be uploaded to Apps Script as HTML files, not script files. They use Google Apps Script template syntax:
- `<?= data.property ?>` for simple output
- `<? if (condition) { ?>...content...<? } ?>` for conditionals
- `<? array.forEach(function(item) { ?>...content...<? }); ?>` for loops

### Error Handling
The system includes comprehensive error handling:
- Template processing fallbacks
- Graceful failure recovery
- Detailed logging to console and SystemLog sheet
- Email notifications for critical errors

### Performance Optimization
- Caching for frequently accessed data
- Batch processing for efficiency
- Optimized spreadsheet operations
- Memory management for large datasets

## Troubleshooting

### Common Issues
1. **Permission Errors**: Ensure all required services are enabled
2. **Template Not Found**: Verify HTML files are uploaded correctly  
3. **Configuration Errors**: Check all IDs in CONFIG object
4. **Spreadsheet Access**: Verify script has access to all hubs

### Debug Functions
Use these for troubleshooting:
- `validateConfiguration()` - Check config settings
- `testHubConnections()` - Verify spreadsheet access
- `verifyTemplates()` - Check template availability

## Support
For issues or questions, check:
1. Apps Script execution transcript for detailed error messages
2. SystemLog sheet in Budget Hub for operation history
3. Email notifications for critical system alerts

The system is now complete and production-ready for your Apps Script environment!
