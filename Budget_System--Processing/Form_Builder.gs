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
const KESWICK_LOGO_URL = 'https://www.keswickchristian.org/wp-content/uploads/2023/01/KCS-Logo-Green.png';

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

  console.log('\n📋 === FORM IDS FOR CONFIG.gs ===');
  console.log(`FORMS: {`);
  console.log(`  AMAZON: '${results.amazon}',`);
  console.log(`  WAREHOUSE: '${results.warehouse}',`);
  console.log(`  FIELD_TRIP: '${results.fieldTrip}',`);
  console.log(`  CURRICULUM: '${results.curriculum}',`);
  console.log(`  ADMIN: '${results.admin}'`);
  console.log(`}`);

  return results;
}

/**
 * Creates the Amazon Purchase Request Form
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

  // Section 1 - Header (title section, email auto-collected)

  // Create 5 item sections
  for (let i = 1; i <= 5; i++) {
    if (i > 1) {
      form.addPageBreakItem().setTitle(`Item ${i}`);
    }

    // Item Description
    form.addTextItem()
      .setTitle(`Item ${i} - Description`)
      .setRequired(i === 1)
      .setHelpText('Brief description of the item');

    // Amazon URL
    form.addTextItem()
      .setTitle(`Item ${i} - Amazon URL`)
      .setRequired(i === 1)
      .setHelpText('Full Amazon product URL');

    // Quantity
    form.addTextItem()
      .setTitle(`Item ${i} - Quantity`)
      .setRequired(i === 1)
      .setHelpText('Number of items needed');

    // Unit Price
    form.addTextItem()
      .setTitle(`Item ${i} - Unit Price ($)`)
      .setRequired(i === 1)
      .setHelpText('Price per unit (do not include $ symbol)');

    // Add another item question (except for last item)
    if (i < 5) {
      const addMore = form.addMultipleChoiceItem()
        .setTitle('Add another item?')
        .setChoiceValues(['Yes', 'No'])
        .setRequired(true);

      // Set up page navigation
      const nextSection = form.addPageBreakItem().setTitle(`Item ${i + 1}`);
      const submitSection = form.addPageBreakItem().setTitle('Review & Submit');

      addMore.setChoices([
        addMore.createChoice('Yes', nextSection),
        addMore.createChoice('No', submitSection)
      ]);
    }
  }

  // Link to Automated Hub
  form.setDestination(FormApp.DestinationType.SPREADSHEET, CONFIG.AUTOMATED_HUB_ID);

  console.log(`Amazon Form created: ${form.getId()}`);
  console.log(`URL: ${form.getPublishedUrl()}`);

  return form.getId();
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
  return form.getId();
}

/**
 * Creates the Curriculum Materials Request Form
 */
function createCurriculumForm() {
  const form = FormApp.create('Curriculum Materials Request Form');

  form.setDescription('Request curriculum materials and educational resources.');
  form.setCollectEmail(true);
  form.setRequireLogin(true);
  form.setLimitOneResponsePerUser(false);

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

  // Total Cost
  form.addTextItem()
    .setTitle('Total Cost ($)')
    .setRequired(true);

  // Supporting Documentation (link instead of file upload)
  form.addTextItem()
    .setTitle('Quote/Documentation Link (Optional)')
    .setHelpText('Paste a Google Drive link to vendor quote or product information')
    .setRequired(false);

  // Justification
  form.addParagraphTextItem()
    .setTitle('Justification')
    .setRequired(true)
    .setHelpText('Why is this resource needed?');

  // Link to Manual Hub
  form.setDestination(FormApp.DestinationType.SPREADSHEET, CONFIG.MANUAL_HUB_ID);

  console.log(`Curriculum Form created: ${form.getId()}`);
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
