/**
 * ============================================================================
 * SETUP & CONFIGURATION UTILITY
 * ============================================================================
 * Run 'setupEnvironment' once after deployment to initialize Script Properties.
 */

function setupEnvironment() {
  const props = PropertiesService.getScriptProperties();
  const ui = SpreadsheetApp.getActiveSpreadsheet() ? SpreadsheetApp.getUi() : null;
  
  console.log('🛠️ Configuring Environment...');

  // 1. Define Standard Configuration
  const config = {
    'ORDER_PROCESSING_HOUR': '10',
    'AUTO_APPROVAL_LIMIT': '200',
    'TEST_MODE': 'true',
    'RAPIDAPI_KEY': '689004de57msh37754ed53610ed4p13f831jsn2e4fda873de1' // Key provided by user
  };
  
  // 2. RapidAPI Key Check (Preserve existing if present, but we have a user provided key now)
  // We will force update with the new key if it's in the config above
  const currentKey = props.getProperty('RAPIDAPI_KEY');
  if (currentKey) {
     console.log('ℹ️ Replacing existing RAPIDAPI_KEY with user provided key');
  }

  // 3. Apply Configuration (Merge)
  props.setProperties(config, false); 
  
  console.log('✅ Environment Keys Updated:');
  console.log(`   TEST_MODE: ${config.TEST_MODE}`);
  console.log(`   AUTO_APPROVAL_LIMIT: ${config.AUTO_APPROVAL_LIMIT}`);
  console.log(`   ORDER_PROCESSING_HOUR: ${config.ORDER_PROCESSING_HOUR}`);
  
  console.log('✨ Setup Complete. Next Steps:');
  console.log('1. Run testRapidAPISetup() to verify connectivity');
  console.log('2. Run setupAllTriggers() to wire the system');
}
