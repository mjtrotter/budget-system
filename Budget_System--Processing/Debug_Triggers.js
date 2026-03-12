/**
 * ============================================================================
 * SYSTEM DIAGNOSTICS - Run this to verify system is ready for testing
 * ============================================================================
 *
 * HOW TO USE:
 * 1. Open this script in the Google Apps Script editor
 * 2. Run: runFullDiagnostics()
 * 3. Check the Execution Log for results
 *
 * If issues are found, run the suggested fix functions.
 */

/**
 * QUICK FIX: Update WEBAPP_URL to correct Workspace format
 * Run this once to fix approval link URLs
 */
function fixWebAppURL() {
  const newUrl = 'https://script.google.com/a/keswickchristian.org/macros/s/AKfycbzeQ3Zr3sNjktVzQiqUGM0MoFX0-dND3aoxNdc5h3fGpqicCnJAa_inMlxHCKWqmRDSCg/exec';
  const props = PropertiesService.getScriptProperties();
  const oldUrl = props.getProperty('WEBAPP_URL');
  props.setProperty('WEBAPP_URL', newUrl);
  console.log('✅ WEBAPP_URL Updated!');
  console.log('   Old: ' + oldUrl);
  console.log('   New: ' + newUrl);
  return { success: true, old: oldUrl, new: newUrl };
}

/**
 * MAIN DIAGNOSTIC FUNCTION - Run this first!
 * Checks triggers, email config, and sends a test email.
 */
function runFullDiagnostics() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  KESWICK BUDGET SYSTEM - FULL DIAGNOSTICS');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Run Time: ${new Date().toLocaleString()}`);
  console.log(`  Run By: ${Session.getActiveUser().getEmail()}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  const results = {
    triggers: checkTriggers(),
    email: checkEmailConfig(),
    scriptProperties: checkScriptProperties(),
    spreadsheets: checkSpreadsheetAccess()
  };

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  DIAGNOSTIC SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');

  const allPassed = Object.values(results).every(r => r.passed);

  if (allPassed) {
    console.log('✅ ALL CHECKS PASSED - System is ready for testing!');
    console.log('\n📧 Sending test email to verify email delivery...');
    sendDiagnosticTestEmail();
  } else {
    console.log('❌ SOME CHECKS FAILED - See details above');
    console.log('\n🔧 SUGGESTED FIXES:');

    if (!results.triggers.passed) {
      console.log('   → Run: setupAllTriggers()');
    }
    if (!results.email.passed) {
      console.log('   → Run: setupOffice365Email()');
    }
    if (!results.scriptProperties.passed) {
      console.log('   → Run: setupEnvironment()');
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════\n');

  return results;
}

/**
 * Check if all required form triggers are installed
 */
function checkTriggers() {
  console.log('\n📋 CHECKING TRIGGERS...');

  const triggers = ScriptApp.getProjectTriggers();
  const report = triggers.map(t => ({
    handler: t.getHandlerFunction(),
    type: t.getEventType().toString(),
    source: t.getTriggerSource().toString()
  }));

  // These are the ACTUAL function names from Main.gs setupAllTriggers()
  const requiredFormTriggers = [
    'processAmazonFormSubmission',
    'processWarehouseFormSubmission',
    'processFieldTripFormSubmission',
    'processCurriculumFormSubmission',
    'processAdminFormSubmission'
  ];

  const presentHandlers = report.map(r => r.handler);
  const missingTriggers = requiredFormTriggers.filter(r => !presentHandlers.includes(r));

  console.log(`   Total triggers found: ${triggers.length}`);

  // Show form triggers
  const formTriggers = report.filter(r => requiredFormTriggers.includes(r.handler));
  formTriggers.forEach(t => {
    console.log(`   ✓ ${t.handler}`);
  });

  if (missingTriggers.length > 0) {
    console.log(`   ❌ MISSING FORM TRIGGERS:`);
    missingTriggers.forEach(t => console.log(`      - ${t}`));
    console.log(`   → Fix: Run setupAllTriggers()`);
    return { passed: false, missing: missingTriggers };
  }

  console.log('   ✅ All form triggers are installed');
  return { passed: true, triggers: report };
}

/**
 * Check email configuration
 */
function checkEmailConfig() {
  console.log('\n📧 CHECKING EMAIL CONFIGURATION...');

  const props = PropertiesService.getScriptProperties();
  const o365Email = props.getProperty('O365_EMAIL');
  const o365Password = props.getProperty('O365_PASSWORD');
  const smtpEnabled = props.getProperty('SMTP_ENABLED');

  console.log(`   SMTP_ENABLED: ${smtpEnabled || 'not set (defaults to true)'}`);
  console.log(`   SMTP_PROVIDER: ${CONFIG.SMTP?.PROVIDER || 'OFFICE365'}`);
  console.log(`   O365_EMAIL: ${o365Email ? '✓ configured' : '❌ NOT SET'}`);
  console.log(`   O365_PASSWORD: ${o365Password ? '✓ configured' : '❌ NOT SET'}`);

  if (!o365Email || !o365Password) {
    console.log(`   ❌ Office 365 credentials missing`);
    console.log(`   → Fix: Run setupOffice365Email()`);
    return { passed: false, reason: 'Missing O365 credentials' };
  }

  console.log('   ✅ Email configuration looks good');
  return { passed: true };
}

/**
 * Check critical script properties
 */
function checkScriptProperties() {
  console.log('\n⚙️ CHECKING SCRIPT PROPERTIES...');

  const props = PropertiesService.getScriptProperties().getProperties();

  const criticalProps = [
    'TEST_MODE',
    'AUTO_APPROVAL_LIMIT'
  ];

  let allPresent = true;
  criticalProps.forEach(prop => {
    const value = props[prop];
    if (value !== undefined) {
      console.log(`   ✓ ${prop}: ${value}`);
    } else {
      console.log(`   ⚠ ${prop}: not set (using default)`);
    }
  });

  // Show TEST_MODE status prominently
  const testMode = props['TEST_MODE'] === 'true' || CONFIG.TEST_MODE === true;
  console.log(`\n   🧪 TEST MODE: ${testMode ? 'ENABLED' : 'DISABLED'}`);
  if (testMode) {
    console.log(`      → Emails will go to actual @keswickchristian.org recipients`);
    console.log(`      → Non-org emails redirect to ${CONFIG.ADMIN_EMAIL}`);
  }

  console.log('   ✅ Script properties configured');
  return { passed: true, testMode };
}

/**
 * Check spreadsheet access
 */
function checkSpreadsheetAccess() {
  console.log('\n📊 CHECKING SPREADSHEET ACCESS...');

  const hubs = [
    { name: 'Budget Hub', id: CONFIG.BUDGET_HUB_ID },
    { name: 'Automated Hub', id: CONFIG.AUTOMATED_HUB_ID },
    { name: 'Manual Hub', id: CONFIG.MANUAL_HUB_ID }
  ];

  let allAccessible = true;

  hubs.forEach(hub => {
    try {
      const ss = SpreadsheetApp.openById(hub.id);
      console.log(`   ✓ ${hub.name}: ${ss.getName()}`);
    } catch (error) {
      console.log(`   ❌ ${hub.name}: ACCESS DENIED or not found`);
      allAccessible = false;
    }
  });

  if (!allAccessible) {
    return { passed: false, reason: 'Cannot access one or more spreadsheets' };
  }

  console.log('   ✅ All spreadsheets accessible');
  return { passed: true };
}

/**
 * Send a test email to verify email delivery
 */
function sendDiagnosticTestEmail() {
  const userEmail = Session.getActiveUser().getEmail();

  console.log(`\n📬 Sending test email to: ${userEmail}`);

  try {
    const result = sendSystemEmail({
      to: userEmail,
      subject: `[DIAGNOSTIC] Budget System Email Test - ${new Date().toLocaleTimeString()}`,
      htmlBody: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #2e7d32; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">Budget System - Email Test</h2>
          </div>
          <div style="background: white; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 8px 8px;">
            <div style="background: #e8f5e9; padding: 20px; border-radius: 6px; text-align: center;">
              <h3 style="color: #2e7d32; margin: 0;">✅ Email delivery is working!</h3>
            </div>

            <div style="margin-top: 20px;">
              <h4>System Status:</h4>
              <ul>
                <li><strong>Test Mode:</strong> ${CONFIG.TEST_MODE ? 'ENABLED' : 'DISABLED'}</li>
                <li><strong>SMTP Provider:</strong> ${CONFIG.SMTP?.PROVIDER || 'OFFICE365'}</li>
                <li><strong>Sent To:</strong> ${userEmail}</li>
                <li><strong>Timestamp:</strong> ${new Date().toLocaleString()}</li>
              </ul>
            </div>

            <div style="background: #fff3cd; padding: 15px; border-radius: 6px; margin-top: 20px;">
              <strong>Next Steps:</strong>
              <ol>
                <li>Submit a test form (Amazon, Warehouse, etc.)</li>
                <li>Check your inbox for the approval email</li>
                <li>Click approve/reject to test the workflow</li>
              </ol>
            </div>
          </div>
        </div>
      `
    });

    if (result) {
      console.log('   ✅ Test email sent successfully!');
      console.log(`   📥 Check inbox: ${userEmail}`);
    } else {
      console.log('   ❌ sendSystemEmail returned false');
    }

  } catch (error) {
    console.error('   ❌ Email send failed:', error.message);
    console.log('\n   Troubleshooting:');
    console.log('   1. Run setupOffice365Email() to configure credentials');
    console.log('   2. Check that invoicing@keswickchristian.org password is correct');
    console.log('   3. Verify O365 allows ROPC authentication');
  }
}

/**
 * Quick fix - installs triggers AND sets up email in one go
 */
function quickFixAll() {
  console.log('🔧 RUNNING QUICK FIX...\n');

  // 1. Setup email credentials
  console.log('Step 1: Setting up Office 365 email...');
  setupOffice365Email();

  // 2. Setup triggers
  console.log('\nStep 2: Installing triggers...');
  setupAllTriggers();

  // 3. Run diagnostics to verify
  console.log('\nStep 3: Verifying...');
  runFullDiagnostics();
}

/**
 * List all triggers with details (for debugging)
 */
function listAllTriggers() {
  const triggers = ScriptApp.getProjectTriggers();

  console.log(`\n📋 ALL TRIGGERS (${triggers.length} total):\n`);

  triggers.forEach((t, i) => {
    console.log(`${i + 1}. ${t.getHandlerFunction()}`);
    console.log(`   Type: ${t.getEventType()}`);
    console.log(`   Source: ${t.getTriggerSource()}`);
    console.log(`   ID: ${t.getUniqueId()}`);
    console.log('');
  });
}

/**
 * Manually simulate a form submission for testing (doesn't actually submit)
 */
function testFormProcessingManually() {
  console.log('🧪 To manually test form processing:');
  console.log('');
  console.log('1. Open the Amazon form:');
  console.log(`   https://docs.google.com/forms/d/${CONFIG.FORMS.AMAZON}/viewform`);
  console.log('');
  console.log('2. Submit with your @keswickchristian.org email');
  console.log('');
  console.log('3. Check this script\'s Execution Log for processing output');
  console.log('');
  console.log('4. Check your email for the approval request');
}
