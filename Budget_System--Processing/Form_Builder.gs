/**
 * ============================================================================
 * FORM BUILDER - Creates all budget system forms
 * ============================================================================
 * Run this script from the invoicing@keswickchristian.org account to create
 * forms owned by that account.
 *
 * After running, update CONFIG.gs with the new form IDs.
 */

// Keswick branding colors
const KESWICK_GREEN = '#006633';
// Logo hosted in the project's Drive - must be publicly accessible
const KESWICK_LOGO_URL = 'https://www.keswickchristian.org/wp-content/uploads/2023/01/KCS-Logo-Green.png';

/**
 * Log branding instructions for a form
 * NOTE: Google Forms API does NOT support setting header images or theme colors.
 * This must be done manually through the Forms UI.
 * @param {string} formId - The form ID to brand
 */
function applyKeswickBranding(formId) {
  console.log(`\n🎨 BRANDING REQUIRED for form ${formId}:`);
  console.log(`   Edit URL: https://docs.google.com/forms/d/${formId}/edit`);
  return formId;
}

/**
 * Print branding instructions for ALL forms
 * NOTE: Google Forms API does NOT support setting themes/logos programmatically.
 * This function provides manual instructions.
 */
function applyBrandingToAllForms() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║           🎨 MANUAL BRANDING REQUIRED FOR ALL FORMS              ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('\n⚠️  Google Forms API does NOT support setting header images or colors.');
  console.log('    You must brand each form manually using these steps:\n');

  console.log('📝 BRANDING STEPS (repeat for each form):');
  console.log('────────────────────────────────────────────');
  console.log('1. Open the form edit link below');
  console.log('2. Click the 🎨 PALETTE ICON (top right, "Customize theme")');
  console.log('3. HEADER IMAGE:');
  console.log('   • Click "Choose image"');
  console.log('   • Select "Upload" tab');
  console.log('   • Upload the Keswick logo PNG');
  console.log('4. THEME COLOR:');
  console.log('   • Click the color dropdown');
  console.log('   • Click "Add custom color" (+)');
  console.log(`   • Enter: ${KESWICK_GREEN}`);
  console.log('5. BACKGROUND: Keep white (#FFFFFF)');
  console.log('6. Click anywhere outside to close the panel\n');

  const forms = [
    { name: 'Amazon', id: CONFIG.FORMS.AMAZON },
    { name: 'Warehouse', id: CONFIG.FORMS.WAREHOUSE },
    { name: 'Field Trip', id: CONFIG.FORMS.FIELD_TRIP },
    { name: 'Curriculum', id: CONFIG.FORMS.CURRICULUM },
    { name: 'Admin', id: CONFIG.FORMS.ADMIN }
  ];

  console.log('🔗 FORM EDIT LINKS (click each to brand):');
  console.log('────────────────────────────────────────────');
  forms.forEach(f => {
    console.log(`${f.name.padEnd(12)} https://docs.google.com/forms/d/${f.id}/edit`);
  });

  console.log('\n💡 TIP: Open all links in separate tabs to brand them quickly.\n');

  return forms;
}

/**
 * Master function to create all forms
 */
function createAllBudgetForms() {
  console.log('🚀 === CREATING ALL BUDGET FORMS ===');

  const results = {
    amazon: null,
    warehouse: null,
    fieldTrip: null,
    curriculum: null,
    admin: null
  };

  try {
    results.amazon = createAmazonForm();
    console.log(`✅ Amazon Form: ${results.amazon}`);
  } catch (e) {
    console.error('❌ Amazon Form failed:', e);
  }

  try {
    results.warehouse = createWarehouseForm();
    console.log(`✅ Warehouse Form: ${results.warehouse}`);
  } catch (e) {
    console.error('❌ Warehouse Form failed:', e);
  }

  try {
    results.fieldTrip = createFieldTripForm();
    console.log(`✅ Field Trip Form: ${results.fieldTrip}`);
  } catch (e) {
    console.error('❌ Field Trip Form failed:', e);
  }

  try {
    results.curriculum = createCurriculumForm();
    console.log(`✅ Curriculum Form: ${results.curriculum}`);
  } catch (e) {
    console.error('❌ Curriculum Form failed:', e);
  }

  try {
    results.admin = createAdminForm();
    console.log(`✅ Admin Form: ${results.admin}`);
  } catch (e) {
    console.error('❌ Admin Form failed:', e);
  }

  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                    📋 FORM IDS FOR CONFIG.gs                      ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log(`\nFORMS: {`);
  console.log(`  AMAZON: '${results.amazon}',`);
  console.log(`  WAREHOUSE: '${results.warehouse}',`);
  console.log(`  FIELD_TRIP: '${results.fieldTrip}',`);
  console.log(`  CURRICULUM: '${results.curriculum}',`);
  console.log(`  ADMIN: '${results.admin}'`);
  console.log(`}\n`);

  console.log('🔗 FORM LINKS (for testing):');
  console.log('────────────────────────────────────────────');
  console.log(`Amazon:      https://docs.google.com/forms/d/${results.amazon}/viewform`);
  console.log(`Warehouse:   https://docs.google.com/forms/d/${results.warehouse}/viewform`);
  console.log(`Field Trip:  https://docs.google.com/forms/d/${results.fieldTrip}/viewform`);
  console.log(`Curriculum:  https://docs.google.com/forms/d/${results.curriculum}/viewform`);
  console.log(`Admin:       https://docs.google.com/forms/d/${results.admin}/viewform`);

  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║         ⚠️  NEXT STEP: MANUAL BRANDING REQUIRED                   ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('\n🎨 Run applyBrandingToAllForms() for detailed branding instructions.');
  console.log('   Google Forms API cannot set header images or colors automatically.\n');

  return results;
}

/**
 * Creates the Amazon Purchase Request Form
 * FIXED: Proper page branching logic - create all pages first, then set navigation
 */
function createAmazonForm() {
  const form = FormApp.create('Amazon Purchase Request Form');

  // Settings
  form.setDescription('Submit Amazon purchase requests for automated ordering on Tuesday and Friday.');
  form.setCollectEmail(true);
  form.setRequireLogin(true); // Verified email collection
  form.setLimitOneResponsePerUser(false);
  form.setAllowResponseEdits(false);
  form.setProgressBar(true);

  // STEP 1: Create ALL page breaks FIRST
  // Page 1 (Item 1) is implicit - it's the first page
  const page2 = form.addPageBreakItem().setTitle('Item 2');
  const page3 = form.addPageBreakItem().setTitle('Item 3');
  const page4 = form.addPageBreakItem().setTitle('Item 4');
  const page5 = form.addPageBreakItem().setTitle('Item 5');
  const submitPage = form.addPageBreakItem().setTitle('Review & Submit');

  // Get all items to reorganize them
  const allItems = form.getItems();

  // STEP 2: Delete all items (we'll recreate in proper order)
  allItems.forEach(item => form.deleteItem(item));

  // STEP 3: Build form in correct order with proper navigation

  // === PAGE 1: Item 1 (no page break needed - first page) ===
  addItemFields(form, 1, true);
  const addMore1 = form.addMultipleChoiceItem()
    .setTitle('Add another item?')
    .setRequired(true);

  // === PAGE 2: Item 2 ===
  const p2 = form.addPageBreakItem().setTitle('Item 2');
  addItemFields(form, 2, false);
  const addMore2 = form.addMultipleChoiceItem()
    .setTitle('Add another item?')
    .setRequired(true);

  // === PAGE 3: Item 3 ===
  const p3 = form.addPageBreakItem().setTitle('Item 3');
  addItemFields(form, 3, false);
  const addMore3 = form.addMultipleChoiceItem()
    .setTitle('Add another item?')
    .setRequired(true);

  // === PAGE 4: Item 4 ===
  const p4 = form.addPageBreakItem().setTitle('Item 4');
  addItemFields(form, 4, false);
  const addMore4 = form.addMultipleChoiceItem()
    .setTitle('Add another item?')
    .setRequired(true);

  // === PAGE 5: Item 5 ===
  const p5 = form.addPageBreakItem().setTitle('Item 5');
  addItemFields(form, 5, false);

  // === SUBMIT PAGE ===
  const pSubmit = form.addPageBreakItem().setTitle('Review & Submit');
  form.addSectionHeaderItem()
    .setTitle('Ready to Submit')
    .setHelpText('Review your items above, then click Submit.');

  // STEP 4: Set up navigation choices
  addMore1.setChoices([
    addMore1.createChoice('Yes', p2),
    addMore1.createChoice('No', pSubmit)
  ]);

  addMore2.setChoices([
    addMore2.createChoice('Yes', p3),
    addMore2.createChoice('No', pSubmit)
  ]);

  addMore3.setChoices([
    addMore3.createChoice('Yes', p4),
    addMore3.createChoice('No', pSubmit)
  ]);

  addMore4.setChoices([
    addMore4.createChoice('Yes', p5),
    addMore4.createChoice('No', pSubmit)
  ]);

  // Link to Automated Hub
  form.setDestination(FormApp.DestinationType.SPREADSHEET, CONFIG.AUTOMATED_HUB_ID);

  console.log(`Amazon Form created: ${form.getId()}`);
  console.log(`URL: ${form.getPublishedUrl()}`);

  // Apply branding
  applyKeswickBranding(form.getId());

  return form.getId();
}

/**
 * Helper: Add the 4 fields for an Amazon item
 */
function addItemFields(form, itemNum, isRequired) {
  form.addTextItem()
    .setTitle(`Item ${itemNum} - Description`)
    .setRequired(isRequired)
    .setHelpText('Brief description of the item');

  form.addTextItem()
    .setTitle(`Item ${itemNum} - Amazon URL`)
    .setRequired(isRequired)
    .setHelpText('Full Amazon product URL');

  form.addTextItem()
    .setTitle(`Item ${itemNum} - Quantity`)
    .setRequired(isRequired)
    .setHelpText('Number of items needed');

  form.addTextItem()
    .setTitle(`Item ${itemNum} - Unit Price ($)`)
    .setRequired(isRequired)
    .setHelpText('Price per unit (do not include $ symbol)');
}

/**
 * Creates a simplified Amazon Form (linear, no branching)
 */
function createAmazonFormSimple() {
  const form = FormApp.create('Amazon Purchase Request Form');

  // Settings
  form.setDescription('Submit Amazon purchase requests for automated ordering on Tuesday and Friday.');
  form.setCollectEmail(true);
  form.setRequireLogin(true);
  form.setLimitOneResponsePerUser(false);
  form.setProgressBar(true);

  // Create 5 item groups (no page breaks)
  for (let i = 1; i <= 5; i++) {
    // Section header
    form.addSectionHeaderItem()
      .setTitle(`Item ${i}`)
      .setHelpText(i === 1 ? 'Required - Enter your first item' : 'Optional - Leave blank if not needed');

    // Item Description
    form.addTextItem()
      .setTitle(`Item ${i} - Description`)
      .setRequired(i === 1);

    // Amazon URL
    form.addTextItem()
      .setTitle(`Item ${i} - Amazon URL`)
      .setRequired(i === 1);

    // Quantity
    form.addTextItem()
      .setTitle(`Item ${i} - Quantity`)
      .setRequired(i === 1);

    // Unit Price
    form.addTextItem()
      .setTitle(`Item ${i} - Unit Price ($)`)
      .setRequired(i === 1);
  }

  // Total field (calculated by user or auto in sheet)
  form.addSectionHeaderItem()
    .setTitle('Order Total')
    .setHelpText('The total will be calculated automatically');

  form.addTextItem()
    .setTitle('Estimated Total ($)')
    .setRequired(true)
    .setHelpText('Sum of all items (quantity x unit price)');

  // Link to Automated Hub
  form.setDestination(FormApp.DestinationType.SPREADSHEET, CONFIG.AUTOMATED_HUB_ID);

  console.log(`Amazon Form created: ${form.getId()}`);
  return form.getId();
}

/**
 * Creates the Warehouse Supply Request Form
 */
function createWarehouseForm() {
  const form = FormApp.create('Warehouse Supply Request Form');

  form.setDescription('Request "at cost" items from the Pinellas County Warehouse.');
  form.setCollectEmail(true);
  form.setRequireLogin(true);
  form.setLimitOneResponsePerUser(false);
  form.setProgressBar(true);

  // Create 5 item groups
  for (let i = 1; i <= 5; i++) {
    form.addSectionHeaderItem()
      .setTitle(`Item ${i}`)
      .setHelpText(i === 1 ? 'Required' : 'Optional');

    // Item ID (catalog number)
    form.addTextItem()
      .setTitle(`Item ${i} - Catalog ID`)
      .setRequired(i === 1)
      .setHelpText('Enter the warehouse catalog item number');

    // Quantity
    form.addTextItem()
      .setTitle(`Item ${i} - Quantity`)
      .setRequired(i === 1);
  }

  // Total section
  form.addSectionHeaderItem()
    .setTitle('Order Total');

  form.addTextItem()
    .setTitle('Estimated Total ($)')
    .setRequired(true)
    .setHelpText('Total cost will be verified against catalog prices');

  // Link to Automated Hub
  form.setDestination(FormApp.DestinationType.SPREADSHEET, CONFIG.AUTOMATED_HUB_ID);

  console.log(`Warehouse Form created: ${form.getId()}`);

  // Apply branding
  applyKeswickBranding(form.getId());

  return form.getId();
}

/**
 * Creates the Field Trip Budget Request Form
 */
function createFieldTripForm() {
  const form = FormApp.create('Field Trip Budget Request Form');

  form.setDescription('Submit field trip budget requests for approval.');
  form.setCollectEmail(true);
  form.setRequireLogin(true);
  form.setLimitOneResponsePerUser(false);

  // Destination
  form.addTextItem()
    .setTitle('Field Trip Destination')
    .setRequired(true)
    .setHelpText('Where is the field trip going?');

  // Date
  form.addDateItem()
    .setTitle('Trip Date')
    .setRequired(true);

  // Number of Students
  form.addTextItem()
    .setTitle('Number of Students')
    .setRequired(true)
    .setHelpText('Estimated number of students attending');

  // Transportation
  form.addMultipleChoiceItem()
    .setTitle('Transportation')
    .setChoiceValues(['School Bus', 'Charter Bus', 'Parent Drivers', 'Walking', 'Other'])
    .setRequired(true);

  // Total Cost
  form.addTextItem()
    .setTitle('Total Estimated Cost ($)')
    .setRequired(true)
    .setHelpText('Include transportation, admission, meals, etc.');

  // Supporting Documentation (link instead of file upload)
  form.addTextItem()
    .setTitle('Supporting Documentation Link (Optional)')
    .setHelpText('Paste a Google Drive link to quotes, itinerary, or other documents')
    .setRequired(false);

  // Link to Manual Hub
  form.setDestination(FormApp.DestinationType.SPREADSHEET, CONFIG.MANUAL_HUB_ID);

  console.log(`Field Trip Form created: ${form.getId()}`);

  // Apply branding
  applyKeswickBranding(form.getId());

  return form.getId();
}

/**
 * Creates the Curriculum Materials Request Form
 * FIXED: Proper branching - build pages in correct order
 */
function createCurriculumForm() {
  const form = FormApp.create('Curriculum Materials Request Form');

  form.setDescription('Request curriculum materials and educational resources.');
  form.setCollectEmail(true);
  form.setRequireLogin(true);
  form.setLimitOneResponsePerUser(false);
  form.setProgressBar(true);

  // ===== PAGE 1: ENTRY METHOD CHOICE =====
  const entryMethodChoice = form.addMultipleChoiceItem()
    .setTitle('How would you like to provide item details?')
    .setRequired(true);

  // ===== PAGE 2: MANUAL ENTRY PATH =====
  const manualEntryPage = form.addPageBreakItem().setTitle('Item Details - Manual Entry');

  // Curriculum Type
  form.addMultipleChoiceItem()
    .setTitle('Type of Curriculum Request')
    .setChoiceValues([
      'Textbooks',
      'Workbooks/Consumables',
      'Digital Resources/Software',
      'Supplemental Materials',
      'Assessment Materials',
      'Other'
    ])
    .setRequired(true);

  // Subject Area
  form.addMultipleChoiceItem()
    .setTitle('Subject Area')
    .setChoiceValues([
      'Math',
      'English/Language Arts',
      'Science',
      'Social Studies',
      'Foreign Language',
      'Bible/Theology',
      'Fine Arts',
      'Physical Education',
      'Technology',
      'Other'
    ])
    .setRequired(true);

  // Resource Name
  form.addTextItem()
    .setTitle('Resource Name/Title')
    .setRequired(true)
    .setHelpText('Name of the curriculum resource');

  // Publisher/Vendor
  form.addTextItem()
    .setTitle('Publisher/Vendor')
    .setRequired(true);

  // Grade Level
  form.addCheckboxItem()
    .setTitle('Grade Level(s)')
    .setChoiceValues(['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'])
    .setRequired(true);

  // Quantity
  form.addTextItem()
    .setTitle('Quantity')
    .setRequired(true);

  // Unit Price
  form.addTextItem()
    .setTitle('Unit Price ($)')
    .setRequired(true)
    .setHelpText('Price per unit (do not include $ symbol)');

  // Supporting Documentation
  form.addTextItem()
    .setTitle('Quote/Documentation Link (Optional)')
    .setHelpText('Paste a Google Drive link to vendor quote or product information')
    .setRequired(false);

  // Justification
  form.addParagraphTextItem()
    .setTitle('Justification')
    .setRequired(true)
    .setHelpText('Why is this resource needed?');

  // ===== PAGE 3: PDF UPLOAD PATH =====
  const pdfUploadPage = form.addPageBreakItem().setTitle('PDF Upload');

  form.addSectionHeaderItem()
    .setTitle('Upload Curriculum Details')
    .setHelpText('Provide a link to a PDF document with the curriculum material details.');

  form.addTextItem()
    .setTitle('PDF Document Link')
    .setRequired(true)
    .setHelpText('Paste a Google Drive link to your PDF (include resource name, publisher, quantity, and unit price)');

  // ===== PAGE 4: SUBMIT PAGE =====
  const submitPage = form.addPageBreakItem().setTitle('Review & Submit');

  form.addSectionHeaderItem()
    .setTitle('Ready to Submit')
    .setHelpText('Click "Submit" to complete your curriculum materials request');

  // ===== SET UP NAVIGATION =====
  // Entry method choice navigates to correct page
  entryMethodChoice.setChoices([
    entryMethodChoice.createChoice('Manual entry', manualEntryPage),
    entryMethodChoice.createChoice('Upload PDF', pdfUploadPage)
  ]);

  // Manual entry page goes to submit (skips PDF page)
  manualEntryPage.setGoToPage(submitPage);

  // PDF page naturally flows to submit (next page)

  // Link to Manual Hub
  form.setDestination(FormApp.DestinationType.SPREADSHEET, CONFIG.MANUAL_HUB_ID);

  console.log(`Curriculum Form created: ${form.getId()}`);

  // Apply branding
  applyKeswickBranding(form.getId());

  return form.getId();
}

/**
 * Creates the Administrative Purchase Request Form
 */
function createAdminForm() {
  const form = FormApp.create('Administrative Purchase Request Form');

  form.setDescription('Submit administrative purchase requests (office supplies, equipment, services).');
  form.setCollectEmail(true);
  form.setRequireLogin(true);
  form.setLimitOneResponsePerUser(false);

  // Description
  form.addTextItem()
    .setTitle('Purchase Description')
    .setRequired(true)
    .setHelpText('Brief description of the purchase');

  // Amount
  form.addTextItem()
    .setTitle('Amount ($)')
    .setRequired(true);

  // Category
  form.addMultipleChoiceItem()
    .setTitle('Category')
    .setChoiceValues([
      'Office Supplies',
      'Equipment',
      'Technology',
      'Furniture',
      'Professional Services',
      'Maintenance/Repairs',
      'Events/Activities',
      'Other'
    ])
    .setRequired(true);

  // Supporting Documentation (link instead of file upload)
  form.addTextItem()
    .setTitle('Quote/Invoice Link (Optional)')
    .setHelpText('Paste a Google Drive link to supporting documentation')
    .setRequired(false);

  // Additional Notes
  form.addParagraphTextItem()
    .setTitle('Additional Notes')
    .setRequired(false);

  // Link to Manual Hub
  form.setDestination(FormApp.DestinationType.SPREADSHEET, CONFIG.MANUAL_HUB_ID);

  console.log(`Admin Form created: ${form.getId()}`);

  // Apply branding
  applyKeswickBranding(form.getId());

  return form.getId();
}

/**
 * Create only the remaining forms (Field Trip, Curriculum, Admin)
 * Use this after Amazon and Warehouse were created successfully
 */
function createRemainingForms() {
  console.log('🚀 === CREATING REMAINING FORMS ===');

  const results = {
    fieldTrip: null,
    curriculum: null,
    admin: null
  };

  try {
    results.fieldTrip = createFieldTripForm();
    console.log(`✅ Field Trip Form: ${results.fieldTrip}`);
  } catch (e) {
    console.error('❌ Field Trip Form failed:', e);
  }

  try {
    results.curriculum = createCurriculumForm();
    console.log(`✅ Curriculum Form: ${results.curriculum}`);
  } catch (e) {
    console.error('❌ Curriculum Form failed:', e);
  }

  try {
    results.admin = createAdminForm();
    console.log(`✅ Admin Form: ${results.admin}`);
  } catch (e) {
    console.error('❌ Admin Form failed:', e);
  }

  console.log('\n📋 === NEW FORM IDS ===');
  console.log(`FIELD_TRIP: '${results.fieldTrip}',`);
  console.log(`CURRICULUM: '${results.curriculum}',`);
  console.log(`ADMIN: '${results.admin}'`);

  return results;
}

/**
 * Lists all forms and their IDs
 */
function listAllForms() {
  const files = DriveApp.getFilesByType(MimeType.GOOGLE_FORMS);
  console.log('=== FORMS OWNED BY THIS ACCOUNT ===');

  while (files.hasNext()) {
    const file = files.next();
    console.log(`${file.getName()}: ${file.getId()}`);
  }
}

/**
 * Deletes a form by ID (use carefully!)
 */
function deleteForm(formId) {
  try {
    const file = DriveApp.getFileById(formId);
    file.setTrashed(true);
    console.log(`Form ${formId} moved to trash`);
  } catch (e) {
    console.error(`Failed to delete form ${formId}:`, e);
  }
}

/**
 * Updates all forms to use verified email collection (auto-capture, no checkbox)
 * Run this to fix forms that show the email checkbox instead of auto-capturing
 */
function updateAllFormsEmailSettings() {
  console.log('🔄 === UPDATING FORM EMAIL SETTINGS ===');

  const formIds = [
    { name: 'Amazon', id: CONFIG.FORMS.AMAZON },
    { name: 'Warehouse', id: CONFIG.FORMS.WAREHOUSE },
    { name: 'Field Trip', id: CONFIG.FORMS.FIELD_TRIP },
    { name: 'Curriculum', id: CONFIG.FORMS.CURRICULUM },
    { name: 'Admin', id: CONFIG.FORMS.ADMIN }
  ];

  const results = [];

  for (const formConfig of formIds) {
    try {
      const form = FormApp.openById(formConfig.id);

      // Set to collect email addresses
      form.setCollectEmail(true);

      // Require login - this makes email "Verified" (auto-captured from Google account)
      form.setRequireLogin(true);

      console.log(`✅ ${formConfig.name}: Updated email settings`);
      results.push({ name: formConfig.name, success: true });
    } catch (e) {
      console.error(`❌ ${formConfig.name} (${formConfig.id}): ${e.message}`);
      results.push({ name: formConfig.name, success: false, error: e.message });
    }
  }

  console.log('\n📋 Results:', JSON.stringify(results, null, 2));
  return results;
}

/**
 * Check all form destinations - diagnostic function
 * Run this to verify forms are properly linked to spreadsheets
 */
function checkFormDestinations() {
  console.log('🔍 === CHECKING FORM DESTINATIONS ===\n');

  const formConfigs = [
    { name: 'Amazon', id: CONFIG.FORMS.AMAZON, expectedHub: CONFIG.AUTOMATED_HUB_ID },
    { name: 'Warehouse', id: CONFIG.FORMS.WAREHOUSE, expectedHub: CONFIG.AUTOMATED_HUB_ID },
    { name: 'Field Trip', id: CONFIG.FORMS.FIELD_TRIP, expectedHub: CONFIG.MANUAL_HUB_ID },
    { name: 'Curriculum', id: CONFIG.FORMS.CURRICULUM, expectedHub: CONFIG.MANUAL_HUB_ID },
    { name: 'Admin', id: CONFIG.FORMS.ADMIN, expectedHub: CONFIG.MANUAL_HUB_ID }
  ];

  const results = [];

  for (const config of formConfigs) {
    try {
      const form = FormApp.openById(config.id);
      const destId = form.getDestinationId();
      const destType = form.getDestinationType();

      const hasDestination = destId && destId !== '';
      const correctHub = destId === config.expectedHub;

      console.log(`📋 ${config.name}:`);
      console.log(`   Form ID: ${config.id}`);
      console.log(`   Destination ID: ${destId || 'NONE'}`);
      console.log(`   Expected Hub: ${config.expectedHub}`);
      console.log(`   Status: ${hasDestination ? (correctHub ? '✅ CORRECT' : '⚠️ WRONG HUB') : '❌ NO DESTINATION'}`);

      results.push({
        name: config.name,
        formId: config.id,
        destinationId: destId,
        expectedHub: config.expectedHub,
        hasDestination: hasDestination,
        correctHub: correctHub
      });
    } catch (e) {
      console.error(`❌ ${config.name}: ${e.message}`);
      results.push({ name: config.name, error: e.message });
    }
  }

  console.log('\n📊 SUMMARY:');
  const correct = results.filter(r => r.correctHub).length;
  const missing = results.filter(r => !r.hasDestination && !r.error).length;
  const wrong = results.filter(r => r.hasDestination && !r.correctHub).length;
  console.log(`   ✅ Correct: ${correct}`);
  console.log(`   ❌ Missing: ${missing}`);
  console.log(`   ⚠️ Wrong: ${wrong}`);

  return results;
}

/**
 * Link all forms to their correct destination spreadsheets
 * Run this if checkFormDestinations shows missing or wrong destinations
 */
function linkAllFormDestinations() {
  console.log('🔗 === LINKING FORM DESTINATIONS ===\n');

  const formConfigs = [
    { name: 'Amazon', id: CONFIG.FORMS.AMAZON, hubId: CONFIG.AUTOMATED_HUB_ID },
    { name: 'Warehouse', id: CONFIG.FORMS.WAREHOUSE, hubId: CONFIG.AUTOMATED_HUB_ID },
    { name: 'Field Trip', id: CONFIG.FORMS.FIELD_TRIP, hubId: CONFIG.MANUAL_HUB_ID },
    { name: 'Curriculum', id: CONFIG.FORMS.CURRICULUM, hubId: CONFIG.MANUAL_HUB_ID },
    { name: 'Admin', id: CONFIG.FORMS.ADMIN, hubId: CONFIG.MANUAL_HUB_ID }
  ];

  const results = [];

  for (const config of formConfigs) {
    try {
      const form = FormApp.openById(config.id);

      // Remove existing destination first (if any)
      try {
        form.removeDestination();
        console.log(`   Removed existing destination for ${config.name}`);
      } catch (e) {
        // No destination to remove
      }

      // Set new destination
      form.setDestination(FormApp.DestinationType.SPREADSHEET, config.hubId);

      // Verify
      const newDestId = form.getDestinationId();
      const success = newDestId === config.hubId;

      console.log(`${success ? '✅' : '❌'} ${config.name}: Linked to ${config.hubId}`);
      results.push({ name: config.name, success: success, destinationId: newDestId });
    } catch (e) {
      console.error(`❌ ${config.name}: ${e.message}`);
      results.push({ name: config.name, success: false, error: e.message });
    }
  }

  console.log('\n📊 Run checkFormDestinations() to verify.');
  return results;
}

/**
 * Setup form triggers after creation
 */
function setupFormTriggers() {
  // Delete existing form triggers first
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getEventType() === ScriptApp.EventType.ON_FORM_SUBMIT) {
      ScriptApp.deleteTrigger(trigger);
      console.log(`Deleted trigger: ${trigger.getHandlerFunction()}`);
    }
  });

  // Create new triggers
  const formConfigs = [
    { id: CONFIG.FORMS.AMAZON, handler: 'processAmazonFormSubmission' },
    { id: CONFIG.FORMS.WAREHOUSE, handler: 'processWarehouseFormSubmission' },
    { id: CONFIG.FORMS.FIELD_TRIP, handler: 'processFieldTripFormSubmission' },
    { id: CONFIG.FORMS.CURRICULUM, handler: 'processCurriculumFormSubmission' },
    { id: CONFIG.FORMS.ADMIN, handler: 'processAdminFormSubmission' }
  ];

  formConfigs.forEach(config => {
    try {
      const form = FormApp.openById(config.id);
      ScriptApp.newTrigger(config.handler)
        .forForm(form)
        .onFormSubmit()
        .create();
      console.log(`✅ Created trigger for ${config.handler}`);
    } catch (e) {
      console.error(`❌ Failed to create trigger for ${config.handler}:`, e);
    }
  });
}
