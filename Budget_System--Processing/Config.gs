/**
 * ============================================================================
 * CORE CONFIGURATION
 * ============================================================================
 * Shared configuration object for the Keswick Budget Automation System.
 * Accessible to all other script files in this project.
 * 
 * UPDATED: Loads overrides from Script Properties for dynamic tuning.
 */

// Load dynamic properties once at startup to minimize execution time
// This allows changing settings via Project Settings -> Script Properties
const _SCRIPT_PROPS = PropertiesService.getScriptProperties().getProperties();

function getDyn(key, defaultValue, type = 'string') {
  if (!_SCRIPT_PROPS || !Object.prototype.hasOwnProperty.call(_SCRIPT_PROPS, key)) {
    return defaultValue;
  }
  const val = _SCRIPT_PROPS[key];
  if (val === undefined || val === null || val === '') return defaultValue;
  
  if (type === 'int') return parseInt(val, 10);
  if (type === 'float') return parseFloat(val);
  if (type === 'bool') return val.toLowerCase() === 'true';
  return val;
}

const CONFIG = {
  // Hub Spreadsheet IDs - Original working spreadsheets (shared with invoicing@keswickchristian.org)
  BUDGET_HUB_ID: getDyn('BUDGET_HUB_ID', '1wbv44RU18vJXlImWwxf4VRX932LgWCTBEn6JNws9HhQ'),
  AUTOMATED_HUB_ID: getDyn('AUTOMATED_HUB_ID', '1CfktVXDNTY499U7zgkBVJ0DyBePH_BsYJeMtwyaxolM'),
  MANUAL_HUB_ID: getDyn('MANUAL_HUB_ID', '1-t7YnyVvk0vxqbKGNteNHOQ92XOJNme4eJPjxVRVI5M'),

  // Form IDs - Forms OWNED by invoicing@keswickchristian.org (can modify email settings)
  // Updated 2026-02-19 from listAllForms() output
  FORMS: {
    AMAZON: '1NqsPZeptLKTf8aKbRH9E6_pnB79DJnBs9tdUP0A2HKY',
    WAREHOUSE: '19G0wER7rh4sdswQD4vZbRxPnIc1DJpqw0j7dCLpn0YY',
    FIELD_TRIP: '1akolIQr412xmroEdChLkoO4frTCa8SitbP7-DlO-HrI',
    CURRICULUM: '1D2zRvTi2KZsGCHKGwnGFF2z0HWF-KGOcf6N2qKRIwmE',
    ADMIN: '1K4AMJU75COtJfub4BbrRaRJJUgfNPvCh6vszvxiKTtg'
  },


  // Approval Thresholds
  AUTO_APPROVAL_LIMIT: getDyn('AUTO_APPROVAL_LIMIT', 200, 'int'),
  PRICE_VARIANCE_PERCENT: getDyn('PRICE_VARIANCE_PERCENT', 0.10, 'float'),
  PRICE_VARIANCE_AMOUNT: getDyn('PRICE_VARIANCE_AMOUNT', 25, 'int'),

  // Email Configuration
  SENDER_EMAIL: 'invoicing@keswickchristian.org',
  BUSINESS_OFFICE_EMAIL: getDyn('BUSINESS_OFFICE_EMAIL', 'mtrotter@keswickchristian.org'),
  TEST_EMAIL: getDyn('TEST_EMAIL', 'invoicing@keswickchristian.org'),
  ADMIN_EMAIL: 'invoicing@keswickchristian.org',  // Admin email for test mode redirects
  ESCALATION_EMAIL: 'mtrotter@keswickchristian.org',
  USE_VERIFIED_EMAILS: false,
  
  // Test Mode - Set to false for production
  TEST_MODE: getDyn('TEST_MODE', true, 'bool'),
  TEST_EMAIL_RECIPIENT: 'invoicing@keswickchristian.org',

  // SMTP Configuration - Using Office 365
  SMTP: {
    ENABLED: getDyn('SMTP_ENABLED', true, 'bool'),
    PROVIDER: getDyn('SMTP_PROVIDER', 'OFFICE365'), // SENDGRID, MAILGUN, OFFICE365, MSGRAPH
    API_KEY: getDyn('SMTP_API_KEY', ''),
    FROM_EMAIL: getDyn('SMTP_FROM_EMAIL', 'invoicing@keswickchristian.org')
  },

  // Web App URL (will be updated after deployment)
  // NOTE: For Google Workspace domains, URL must include /a/<domain>/ prefix
  WEBAPP_URL: getDyn('WEBAPP_URL', 'https://script.google.com/a/keswickchristian.org/macros/s/AKfycbzVXg6bkg0Bx2Pcx3-kzt67CwMqdQBML2F4r-is8u4mAbnPNo-Q3qEdqYiqjP4RJ6TwXQ/exec'),


  // Amazon Cart Configuration
  CART_FETCH_DELAY_MS: 10000,
  REQUEST_DELAY_MS: 20000,
  APPROVAL_WINDOW_HOURS: getDyn('APPROVAL_WINDOW_HOURS', 2, 'int'),
  ORDER_PROCESSING_HOUR: getDyn('ORDER_PROCESSING_HOUR', 10, 'int'),

  // Cart page selectors
  CART_ITEM_SELECTORS: [
    '[data-name="Active Items"] [data-item-count]',
    '#sc-active-cart [data-asin]',
    '.sc-list-item[data-asin]',
    '[data-name="Active Items"] .sc-list-item'
  ],

  CART_PRICE_SELECTORS: [
    '.sc-price .a-offscreen',
    '.a-price .a-offscreen',
    '.sc-product-price .a-price .a-offscreen',
    '[data-feature-name="sc-product-price"] .a-offscreen',
    '.sc-price-sign + .sc-price-value',
    '.a-price-whole'
  ],

  // Enhanced user agents for better anti-detection
  USER_AGENTS: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15'
  ],

  ASIN_PATTERNS: [
    /\/dp\/([A-Z0-9]{10})/i,
    /\/gp\/product\/([A-Z0-9]{10})/i,
    /\/product\/([A-Z0-9]{10})/i,
    /[?&]asin=([A-Z0-9]{10})/i,
    /\/([A-Z0-9]{10})(?:[/?#]|$)/i
  ],

  // Request Rate Limiting
  REQUEST_DELAY_MIN_MS: 10000,  // 10 seconds minimum
  REQUEST_DELAY_MAX_MS: 20000,  // 20 seconds maximum

  // ==========================================================================
  // PEX CARD CONFIGURATION
  // ==========================================================================
  PEX: {
    ENABLED: getDyn('PEX_ENABLED', true, 'bool'),
    // School ID isn't strictly needed for the simplified bridge but useful for context
    SCHOOL_ID: 'keswickchristian', 
    // Credentials must be set in Script Properties: PEX_APP_ID, PEX_APP_SECRET, PEX_ADMIN_TOKEN
  },


  // Fiscal Year Configuration
  FISCAL_YEAR_START_MONTH: 7,  // July
  FISCAL_YEAR_START_DAY: 1,
  FISCAL_YEAR_ROLLOVER_DAYS: 3, // Processing hiatus

  // Approval Workflow
  APPROVAL_REMINDER_HOURS: 72,  // 3 days
  APPROVAL_ESCALATION_DAYS: 7,   // 1 week

  // Batch Processing
  MAX_BATCH_SIZE: 20,  // Max items per invoice/batch
  MAX_CONCURRENT_REQUESTS: 5,

  // Holiday Blackouts (month is 1-based)
  HOLIDAY_BLACKOUTS: [
    { name: 'Independence Day', month: 7, day: 4 },
    { name: 'Labor Day', monthWeek: { month: 9, week: 1, day: 1 } }, // First Monday of September
    { name: 'Veterans Day', month: 11, day: 11 },
    { name: 'Thanksgiving Week', monthWeek: { month: 11, week: 4, day: 4, duration: 7 } }, // 4th Thursday + week
    { name: 'Christmas Week', dateRange: { month: 12, startDay: 22, endDay: 29 } },
    { name: 'New Years Day', month: 1, day: 1 },
    { name: 'MLK Day', monthWeek: { month: 1, week: 3, day: 1 } }, // Third Monday of January
    { name: 'Presidents Day', monthWeek: { month: 2, week: 3, day: 1 } }, // Third Monday of February
    { name: 'Good Friday', easter: -2 }, // 2 days before Easter (requires calculation)
    { name: 'Memorial Day', monthWeek: { month: 5, week: -1, day: 1 } } // Last Monday of May
  ]
};
