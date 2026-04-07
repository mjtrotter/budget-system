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

function getDyn(key, defaultValue, type = "string") {
  if (
    !_SCRIPT_PROPS ||
    !Object.prototype.hasOwnProperty.call(_SCRIPT_PROPS, key)
  ) {
    return defaultValue;
  }
  const val = _SCRIPT_PROPS[key];
  if (val === undefined || val === null || val === "") return defaultValue;

  if (type === "int") return parseInt(val, 10);
  if (type === "float") return parseFloat(val);
  if (type === "bool") return val.toLowerCase() === "true";
  return val;
}

const CONFIG = {
  // Hub Spreadsheet IDs - OWNED by invoicing@keswickchristian.org
  BUDGET_HUB_ID: getDyn(
    "BUDGET_HUB_ID",
    "1GpCs2p3dra7xf68Ezz-FSsIScqtc7A62h95FIDc-mKY",
  ),
  AUTOMATED_HUB_ID: getDyn(
    "AUTOMATED_HUB_ID",
    "1nYl89UUBtk4U1CpcVtX0p3V6wZkCkKD8XtR1eWNza5E",
  ),
  MANUAL_HUB_ID: getDyn(
    "MANUAL_HUB_ID",
    "1MxYNCHZD1SsqcB2oeX5FEgddA6pFRyK-0foCT8SZjYw",
  ),

  // Form IDs - Forms OWNED by invoicing@keswickchristian.org (can modify email settings)
  // Original working forms - need manual branding update
  FORMS: {
    AMAZON: "1Ew8fgcI-wdJmRDftG2CHAIIay3dtF-RYt3ktuuSpV70",
    WAREHOUSE: "1FRD53cCHHkuVmLkbZ33BOU7bnZsIdT3IBxcInMZ1oy4",
    FIELD_TRIP: "1K1B9KLo-J4sO8J-RLOut9DIm5uMwdj14iaFJu4l4v8Y",
    CURRICULUM: "1v8I7re72IyU7NapXBpwsTaib8gY3DC1E56DWi5JCR-8",
    ADMIN: "1o9XqmZGm2aa7t2AREQyHWIsyaPOSDJWbuckUUyW3cbg",
  },

  // Approval Thresholds
  AUTO_APPROVAL_LIMIT: getDyn("AUTO_APPROVAL_LIMIT", 200, "int"),
  PRICE_VARIANCE_PERCENT: getDyn("PRICE_VARIANCE_PERCENT", 0.1, "float"),
  PRICE_VARIANCE_AMOUNT: getDyn("PRICE_VARIANCE_AMOUNT", 25, "int"),

  // Email Configuration
  SENDER_EMAIL: "invoicing@keswickchristian.org",
  BUSINESS_OFFICE_EMAIL: getDyn(
    "BUSINESS_OFFICE_EMAIL",
    "invoicing@keswickchristian.org",
  ),
  TEST_EMAIL: getDyn("TEST_EMAIL", "invoicing@keswickchristian.org"),
  ADMIN_EMAIL: "invoicing@keswickchristian.org", // Admin email for test mode redirects
  ESCALATION_EMAIL: "invoicing@keswickchristian.org",
  USE_VERIFIED_EMAILS: true,

  // Test Mode - Set to false for production
  TEST_MODE: getDyn("TEST_MODE", true, "bool"),
  TEST_EMAIL_RECIPIENT: "invoicing@keswickchristian.org",

  // UAT Whitelist - Only these users receive emails in TEST_MODE
  // All other org emails are redirected to TEST_EMAIL_RECIPIENT
  UAT_WHITELIST: [
    "nstratis@keswickchristian.org",
    "bendrulat@keswickchristian.org",
    "sneel@keswickchristian.org",
    "mtrotter@keswickchristian.org",
    "invoicing@keswickchristian.org",
  ],

  // SMTP Configuration - Using Office 365
  SMTP: {
    ENABLED: getDyn("SMTP_ENABLED", true, "bool"),
    PROVIDER: getDyn("SMTP_PROVIDER", "OFFICE365"), // SENDGRID, MAILGUN, OFFICE365, MSGRAPH
    API_KEY: getDyn("SMTP_API_KEY", ""),
    FROM_EMAIL: getDyn("SMTP_FROM_EMAIL", "invoicing@keswickchristian.org"),
  },

  // Web App URL (Updated to current deployment endpoint)
  // Re-keyed property to avoid fetching the stale cached URL from ScriptProperties
  WEBAPP_URL: getDyn(
    "ACTIVE_WEBAPP_URL",
    "https://script.google.com/a/keswickchristian.org/macros/s/AKfycbwUAhH2X8jnj53SQ4fZ-TqGMH_OE-r1ySbQIaKS9e1vu8Z5I3ib82mFGEZ_tdZl3iSmaA/exec",
  ),

  // Amazon Business B2B Configuration — credentials loaded from encrypted Script Properties
  AMAZON_B2B: {
    ENABLED: true,
    // Default TRUE (safe trial mode). Override via Script Properties: TRIAL_MODE_ENABLED=false
    // Only disable when BO explicitly authorizes live Amazon ordering.
    TRIAL_MODE_ENABLED: getDyn("TRIAL_MODE_ENABLED", true, "bool"),
    AUTH_URL: "https://api.amazon.com/auth/o2/token",
    ORDER_API_URL:
      "https://na.business-api.amazon.com/ordering/2022-10-30/orders",
    USER_AGENT: "KCSProcurement/1.0 (Language=GAS;Platform=Google)",
  },

  // Price Tolerance Configuration (3-tier model)
  PRICE_TOLERANCE: {
    PCT: getDyn("PRICE_TOLERANCE_PCT", 0.05, "float"), // 5% — within this OR $AMT = pass
    AMT: getDyn("PRICE_TOLERANCE_AMT", 5.0, "float"), // $5.00 — within this OR %PCT = pass
    HARD_CAP: getDyn("PRICE_HARD_CAP", 50.0, "float"), // $50 — above this = mandatory reapproval
  },

  // Shipping / Postal
  KCS_SHIPPING_POSTAL: getDyn("KCS_SHIPPING_POSTAL", "33708"),

  // Amazon user email for x-amz-user-email header
  AMZ_USER_EMAIL: getDyn("AMZ_USER_EMAIL", "mtrotter@keswickchristian.org"),

  ASIN_PATTERNS: [
    /\/dp\/([A-Z0-9]{10})/i,
    /\/gp\/product\/([A-Z0-9]{10})/i,
    /\/product\/([A-Z0-9]{10})/i,
    /[?&]asin=([A-Z0-9]{10})/i,
    /\/([A-Z0-9]{10})(?:[/?#]|$)/i,
  ],

  // Request Rate Limiting
  REQUEST_DELAY_MIN_MS: 10000, // 10 seconds minimum
  REQUEST_DELAY_MAX_MS: 20000, // 20 seconds maximum

  // ==========================================================================
  // PEX CARD CONFIGURATION
  // ==========================================================================
  PEX: {
    ENABLED: getDyn("PEX_ENABLED", true, "bool"),
    // School ID isn't strictly needed for the simplified bridge but useful for context
    SCHOOL_ID: "keswickchristian",
    // Credentials must be set in Script Properties: PEX_APP_ID, PEX_APP_SECRET, PEX_ADMIN_TOKEN
  },

  // Fiscal Year Configuration
  FISCAL_YEAR_START_MONTH: 7, // July
  FISCAL_YEAR_START_DAY: 1,
  FISCAL_YEAR_ROLLOVER_DAYS: 3, // Processing hiatus

  // Approval Workflow
  APPROVAL_REMINDER_HOURS: 72, // 3 days
  APPROVAL_ESCALATION_DAYS: 7, // 1 week

  // Batch Processing
  MAX_BATCH_SIZE: 20, // Max items per invoice/batch
  MAX_CONCURRENT_REQUESTS: 5,

  // Holiday Blackouts (month is 1-based)
  HOLIDAY_BLACKOUTS: [
    { name: "Independence Day", month: 7, day: 4 },
    { name: "Labor Day", monthWeek: { month: 9, week: 1, day: 1 } }, // First Monday of September
    { name: "Veterans Day", month: 11, day: 11 },
    {
      name: "Thanksgiving Week",
      monthWeek: { month: 11, week: 4, day: 4, duration: 7 },
    }, // 4th Thursday + week
    {
      name: "Christmas Week",
      dateRange: { month: 12, startDay: 22, endDay: 29 },
    },
    { name: "New Years Day", month: 1, day: 1 },
    { name: "MLK Day", monthWeek: { month: 1, week: 3, day: 1 } }, // Third Monday of January
    { name: "Presidents Day", monthWeek: { month: 2, week: 3, day: 1 } }, // Third Monday of February
    { name: "Good Friday", easter: -2 }, // 2 days before Easter (requires calculation)
    { name: "Memorial Day", monthWeek: { month: 5, week: -1, day: 1 } }, // Last Monday of May
  ],
};
