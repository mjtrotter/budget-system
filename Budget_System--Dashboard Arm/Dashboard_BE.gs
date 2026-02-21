// ============================================================================
// KESWICK BUDGET DASHBOARD - CORE SERVICE (MONITORING ONLY)
// ============================================================================
// Production-ready Google Apps Script backend for budget monitoring dashboard
// Supports Executive, Principal, and Department Head views with TAC calculator
// ============================================================================

// ============================================================================
// CONFIGURATION
// ============================================================================
const CONFIG = {
  // ========== DEMO MODE TOGGLE ==========
  // Set to true to show demo/mock data, false for live spreadsheet data
  // Toggle this when presenting to stakeholders vs production use
  DEMO_MODE: false,

  // Hub Spreadsheet IDs - invoicing@keswickchristian.org account
  BUDGET_HUB_ID: '1wbv44RU18vJXlImWwxf4VRX932LgWCTBEn6JNws9HhQ',
  AUTOMATED_HUB_ID: '1mGcKhEehd4OwqUy1_zN40SWJ7O_aL5ax-6B_oZDddfM',
  MANUAL_HUB_ID: '1-t7YnyVvk0vxqbKGNteNHOQ92XOJNme4eJPjxVRVI5M',

  // Authentication
  ORGANIZATION_DOMAIN: 'keswickchristian.org',

  // User Access Matrix - Authorized Demo Users Only
  USER_ACCESS: {
    // Authorized Users - Full Executive Access
    'invoicing@keswickchristian.org': { role: 'executive', divisions: ['US', 'LS', 'KK', 'AD'], departments: ['ALL'] },
    'nstratis@keswickchristian.org': { role: 'executive', divisions: ['US', 'LS', 'KK', 'AD'], departments: ['ALL'] },
    'mtrotter@keswickchristian.org': { role: 'executive', divisions: ['US', 'LS', 'KK', 'AD'], departments: ['ALL'] },
    'bendrulat@keswickchristian.org': { role: 'executive', divisions: ['US', 'LS', 'KK', 'AD'], departments: ['ALL'] },
    'sneel@keswickchristian.org': { role: 'executive', divisions: ['US', 'LS', 'KK', 'AD'], departments: ['ALL'] },

    // DEFAULT ACCESS - Denies access to all other users
    'DEFAULT': { role: 'denied', divisions: [], departments: [] }
  },

  // School Logo (Google Drive file ID) - wide KCS text logo
  SCHOOL_LOGO_FILE_ID: '1HDkW_xGIc4jOBH4REnXb3VJcZaEjPHKj',

  // Brand Assets - uses same sources as invoicing system
  BRAND_ASSETS: {
    'school-name.png': '1HDkW_xGIc4jOBH4REnXb3VJcZaEjPHKj',  // KCS wide text logo
    'crest.png': null  // Will look in Budget_System_Signatures/seal.jpg
  },

  // Signatures folder name (for seal/crest)
  SIGNATURES_FOLDER: 'Budget_System_Signatures',

  // TAC Technology Fee Matrix (Per Student Annual Fees)
  // 17 grade levels: Infants through Grade 12
  TAC_TECHNOLOGY_FEES: {
    'Infants': 850,
    'PK2': 850,
    'PK3': 850,
    'PK4': 850,
    'K': 950,
    '1': 1000,
    '2': 1000,
    '3': 1050,
    '4': 1050,
    '5': 1100,
    '6': 1150,
    '7': 1200,
    '8': 1200,
    '9': 1250,
    '10': 1250,
    '11': 1300,
    '12': 1300
  },

  // Grade level ordering for display
  TAC_GRADE_ORDER: ['Infants', 'PK2', 'PK3', 'PK4', 'K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],

  // Step Up for Students (FL Scholarship) - configurable rates per grade
  // Average ~$8,000/student annually, varies by program type
  STEP_UP_RATES: {
    'Infants': 0,      // No Step Up for infants
    'PK2': 0,          // No Step Up for PK2
    'PK3': 0,          // No Step Up for PK3
    'PK4': 7500,       // FTC/FES-EO eligible
    'K': 8000,
    '1': 8000,
    '2': 8000,
    '3': 8000,
    '4': 8000,
    '5': 8000,
    '6': 8200,
    '7': 8200,
    '8': 8200,
    '9': 8500,
    '10': 8500,
    '11': 8500,
    '12': 8500
  },

  // TAC Category Allocation
  TAC_CATEGORY_WEIGHTS: {
    technology: 0.55,  // 55% for technology
    activities: 0.25,  // 25% for activities/field trips
    consumables: 0.20  // 20% for curriculum/supplies
  },

  // Division Mappings
  DIVISIONS: {
    'US': { name: 'Upper School', grades: ['9', '10', '11', '12'] },
    'MS': { name: 'Middle School', grades: ['6', '7', '8'] },
    'LS': { name: 'Lower School', grades: ['K', '1', '2', '3', '4', '5'] },
    'KK': { name: 'Keswick Kids', grades: ['Infants', 'PK2', 'PK3', 'PK4'] },
    'AD': { name: 'Administration', grades: [] }
  },

  // Cache Settings
  CACHE_DURATION: 300, // 5 minutes
  KPI_CACHE_DURATION: 600, // 10 minutes
  TAC_CACHE_DURATION: 1800, // 30 minutes

  // Performance Settings
  MAX_TRANSACTIONS_DISPLAY: 1000,
  BATCH_SIZE: 500,

  // Alert Thresholds
  ALERT_THRESHOLDS: {
    budget_critical: 90,    // 90% budget utilization
    budget_warning: 75,     // 75% budget utilization
    approval_delay: 72,     // 72 hours for approval
    large_transaction: 1000 // $1000+ transactions
  },

  // Budget Pacing - Expected cumulative spending % by fiscal month
  // Accounts for front-loaded annual expenses (curriculum, licenses, etc.)
  // Fiscal months: 0=Jul, 1=Aug, 2=Sep, 3=Oct, 4=Nov, 5=Dec, 6=Jan, 7=Feb, 8=Mar, 9=Apr, 10=May, 11=Jun
  BUDGET_PACING: {
    milestones: {
      0: 5,    // Jul: 5% (minimal summer spending)
      1: 30,   // Aug: 30% (school start - major purchases)
      2: 45,   // Sep: 45% (settling in)
      3: 52,   // Oct: 52%
      4: 58,   // Nov: 58%
      5: 65,   // Dec: 65%
      6: 72,   // Jan: 72%
      7: 78,   // Feb: 78%
      8: 84,   // Mar: 84%
      9: 90,   // Apr: 90%
      10: 95,  // May: 95%
      11: 100  // Jun: 100%
    },
    tolerance: 12  // +/- percentage points for "on track" status
  }
};

// ============================================================================
// MAIN DASHBOARD SERVICE CLASS
// ============================================================================
class KeswickDashboardService {

  constructor() {
    this.cache = CacheService.getScriptCache();
    this.lock = LockService.getScriptLock();

    try {
      // Initialize hub connections with error handling
      this.hubs = {
        budget: SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID),
        automated: SpreadsheetApp.openById(CONFIG.AUTOMATED_HUB_ID),
        manual: SpreadsheetApp.openById(CONFIG.MANUAL_HUB_ID)
      };

      // Get sheet references with error handling
      this.sheets = {
        userDirectory: this.getSheetSafely('budget', 'UserDirectory'),
        organizationBudgets: this.getSheetSafely('budget', 'OrganizationBudgets'),
        transactionLedger: this.getSheetSafely('budget', 'TransactionLedger'),
        transactionArchive: this.getSheetSafely('budget', 'TransactionArchive'),
        systemLog: this.getSheetSafely('budget', 'SystemLog'),
        manualQueue: this.getSheetSafely('manual', 'ManualQueue'),
        automatedQueue: this.getSheetSafely('automated', 'AutomatedQueue')
      };

      // Column mappings
      this.initializeColumnMappings();

    } catch (error) {
      console.error('Service initialization error:', error);
      // Continue with limited functionality
      this.sheets = {};
    }
  }

  // Safe sheet retrieval
  getSheetSafely(hubName, sheetName) {
    try {
      return this.hubs[hubName].getSheetByName(sheetName);
    } catch (error) {
      console.error(`Failed to get sheet ${sheetName} from ${hubName}:`, error);
      return null;
    }
  }

  // Initialize column mappings based on headers file
  initializeColumnMappings() {
    this.columns = {
      UserDirectory: {
        Email: 0,         // A: Email
        FirstName: 1,     // B: FirstName
        LastName: 2,      // C: LastName
        Role: 3,          // D: Role
        Department: 4,    // E: Department
        Division: 5,      // F: Division
        Approver: 6,      // G: Approver
        BudgetAllocated: 7, // H: BudgetAllocated
        BudgetSpent: 8,   // I: BudgetSpent
        BudgetEncumbered: 9, // J: BudgetEncumbered
        BudgetRemaining: 10, // K: BudgetRemaining
        UtilizationRate: 11, // L: UtilizationRate
        Active: 12,       // M: Active
        LastModified: 13  // N: LastModified
      },
      OrganizationBudgets: {
        Organization: 0,   // A: Organization
        BudgetAllocated: 1, // B: BudgetAllocated
        BudgetSpent: 2,   // C: BudgetSpent
        BudgetEncumbered: 3, // D: BudgetEncumbered
        BudgetAvailable: 4, // E: BudgetAvailable
        Approver: 5,      // F: Approver
        Active: 6,        // G: Active
        LastModified: 7   // H: LastModified
      },
      TransactionLedger: {
        TransactionID: 0, // A: TransactionID
        OrderID: 1,       // B: OrderID
        ProcessedOn: 2,   // C: ProcessedOn
        Requestor: 3,     // D: Requestor
        Approver: 4,      // E: Approver
        Organization: 5,  // F: Organization
        Form: 6,          // G: Form
        Amount: 7,        // H: Amount
        Description: 8,   // I: Description
        FiscalQuarter: 9, // J: FiscalQuarter
        InvoiceGenerated: 10, // K: InvoiceGenerated
        InvoiceID: 11,    // L: InvoiceID
        InvoiceURL: 12    // M: InvoiceURL
      },
      TransactionArchive: {
        TransactionID: 0, // A: TransactionID
        OrderID: 1,       // B: OrderID
        ProcessedOn: 2,   // C: ProcessedOn
        Requestor: 3,     // D: Requestor
        Approver: 4,      // E: Approver
        Organization: 5,  // F: Organization
        Form: 6,          // G: Form
        Amount: 7,        // H: Amount
        Description: 8,   // I: Description
        FiscalQuarter: 9, // J: FiscalQuarter
        InvoiceGenerated: 10, // K: InvoiceGenerated
        InvoiceID: 11,    // L: InvoiceID
        InvoiceURL: 12    // M: InvoiceURL
      },
      ManualQueue: {
        TransactionID: 0, // A: TransactionID
        Requestor: 1,     // B: Requestor
        RequestType: 2,   // C: RequestType
        Department: 3,    // D: Department
        Division: 4,      // E: Division
        Amount: 5,        // F: Amount
        Description: 6,   // G: Description
        Status: 7,        // H: Status
        Requested: 8,     // I: Requested
        Approved: 9       // J: Approved
      },
      AutomatedQueue: {
        TransactionID: 0, // A: TransactionID
        Requestor: 1,     // B: Requestor
        RequestType: 2,   // C: RequestType
        Department: 3,    // D: Department
        Division: 4,      // E: Division
        Amount: 5,        // F: Amount
        Description: 6,   // G: Description
        Status: 7,        // H: Status
        Requested: 8,     // I: Requested
        Approved: 9,      // J: Approved
        Processed: 10,    // K: Processed
        ResponseID: 11    // L: ResponseID
      }
    };
  }

  // ============================================================================
  // AUTHENTICATION & USER MANAGEMENT
  // ============================================================================

  authenticateUser() {
    try {
      // Try getActiveUser first, fall back to getEffectiveUser if empty
      let email = Session.getActiveUser().getEmail();
      if (!email || email === '') {
        email = Session.getEffectiveUser().getEmail();
        console.log('Using effective user (fallback):', email);
      }
      console.log('Authenticating user:', email);

      // Check if user exists in config
      let userConfig = CONFIG.USER_ACCESS[email];

      // CRITICAL SECURITY FIX: Removed testing fallback
      // Unauthorized users will now be denied access
      if (!userConfig) {
        console.warn(`Unauthorized access attempt: ${email}`);
        return {
          email: email,
          authenticated: false,
          error: 'ACCESS_DENIED'
        };
      }

      if (!userConfig) {
        console.error('No user config found');
        return null;
      }

      // Try to get user info from directory
      const userInfo = this.getUserFromDirectory(email) || {
        firstName: 'Test',
        lastName: 'User',
        department: 'All',
        division: 'All'
      };

      const authenticatedUser = {
        email: email,
        firstName: userInfo.firstName || 'User',
        lastName: userInfo.lastName || '',
        role: userConfig.role,
        divisions: userConfig.divisions,
        departments: userConfig.departments,
        budgetInfo: {
          allocated: userInfo.budgetAllocated || 0,
          spent: userInfo.budgetSpent || 0,
          remaining: userInfo.budgetRemaining || 0
        },
        isExecutive: userConfig.role === 'executive',
        permissions: this.buildPermissions(userConfig),
        authenticated: true,
        loginTime: new Date()
      };

      this.logAccess(email, 'AUTH_SUCCESS', `${userConfig.role} login`);
      return authenticatedUser;

    } catch (error) {
      console.error('Authentication error:', error);
      // Return minimal user for demo purposes
      return {
        email: 'demo@keswickchristian.org',
        firstName: 'Demo',
        lastName: 'User',
        role: 'executive',
        divisions: ['US', 'LS', 'KK', 'AD'],
        departments: ['ALL'],
        authenticated: true
      };
    }
  }

  buildPermissions(userConfig) {
    return {
      canViewAllDivisions: userConfig.role === 'executive',
      canViewDivisions: userConfig.divisions,
      canViewDepartments: userConfig.departments,
      canExportReports: true,
      canViewTAC: true,
      canModifyData: false // MONITORING ONLY
    };
  }

  getUserFromDirectory(email) {
    try {
      if (!this.sheets.userDirectory) return null;

      const cacheKey = `user_${email}`;
      const cached = this.cache.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const data = this.sheets.userDirectory.getDataRange().getValues();
      const cols = this.columns.UserDirectory;

      for (let i = 1; i < data.length; i++) {
        if (data[i][cols.Email] === email) {
          const userInfo = {
            firstName: data[i][cols.FirstName],
            lastName: data[i][cols.LastName],
            role: data[i][cols.Role],
            department: data[i][cols.Department],
            division: data[i][cols.Division],
            approver: data[i][cols.Approver],
            budgetAllocated: data[i][cols.BudgetAllocated] || 0,
            budgetSpent: data[i][cols.BudgetSpent] || 0,
            budgetEncumbered: data[i][cols.BudgetEncumbered] || 0,
            budgetRemaining: data[i][cols.BudgetRemaining] || 0,
            utilizationRate: data[i][cols.UtilizationRate] || 0,
            active: data[i][cols.Active],
            lastModified: data[i][cols.LastModified]
          };

          this.cache.put(cacheKey, JSON.stringify(userInfo), CONFIG.CACHE_DURATION);
          return userInfo;
        }
      }

      return null;
    } catch (error) {
      console.error('Error getting user from directory:', error);
      return null;
    }
  }

  // ============================================================================
  // DASHBOARD DATA PROVIDERS
  // ============================================================================

  getExecutiveDashboard(filters = {}) {
    try {
      const user = this.authenticateUser();
      if (!user || user.role !== 'executive') {
        throw new Error('Executive access required');
      }

      // Try to get real data with fallback to mock
      const data = {
        user: user,
        kpis: this.calculateExecutiveKPIs(filters),
        divisionSummary: this.getDivisionSummary(filters),
        financialHealth: this.getFinancialHealthMetrics(filters),
        systemHealth: this.getSystemHealthMetrics(filters),
        tacSummary: this.getTACSummary(filters),
        transactions: this.getRecentTransactions(filters, 100),
        alerts: this.getSystemAlerts(),
        trends: this.getSpendingTrends(filters)
      };

      this.logAccess(user.email, 'EXEC_DASHBOARD', 'Executive dashboard accessed');
      return data;

    } catch (error) {
      console.error('Executive dashboard error:', error);
      // Return mock data for demo
      return this.getMockExecutiveDashboard();
    }
  }

  getPrincipalDashboard(filters = {}) {
    try {
      const user = this.authenticateUser();
      if (!user || user.role !== 'principal') {
        throw new Error('Principal access required');
      }

      // Return mock data as fallback
      return {
        user: user,
        kpis: this.getMockPrincipalKPIs(),
        departments: this.getMockDepartmentSummary(user.divisions),
        transactions: this.getMockTransactions(50),
        tacAnalysis: this.getMockTACAnalysis(user.divisions),
        budgetStatus: this.getMockBudgetStatus(user.divisions),
        approvalQueue: this.getMockApprovalQueue(user.divisions),
        alerts: this.getMockDivisionAlerts(user.divisions)
      };

    } catch (error) {
      console.error('Principal dashboard error:', error);
      return this.getMockPrincipalDashboard();
    }
  }

  getDepartmentDashboard(filters = {}) {
    try {
      const user = this.authenticateUser();
      if (!user || user.role !== 'department_head') {
        throw new Error('Department head access required');
      }

      // Return mock data as fallback
      return {
        user: user,
        kpis: this.getMockDepartmentKPIs(),
        budget: this.getMockDepartmentBudget(user.departments[0]),
        transactions: this.getMockTransactions(30),
        tacBreakdown: this.getMockTACBreakdown(user.departments),
        spending: this.getMockDepartmentSpending(user.departments),
        comparison: this.getMockDepartmentComparison(user.departments[0])
      };

    } catch (error) {
      console.error('Department dashboard error:', error);
      return this.getMockDepartmentDashboard();
    }
  }

  // ============================================================================
  // DATA CALCULATION METHODS
  // ============================================================================

  calculateExecutiveKPIs(filters) {
    try {
      const cacheKey = `exec_kpis_${JSON.stringify(filters)}`;
      const cached = this.cache.get(cacheKey);
      if (cached) return JSON.parse(cached);

      // Try to calculate from real data
      if (this.sheets.organizationBudgets) {
        const realKPIs = this.calculateRealExecutiveKPIs(filters);
        this.cache.put(cacheKey, JSON.stringify(realKPIs), CONFIG.KPI_CACHE_DURATION);
        return realKPIs;
      }

      // Fallback to mock KPIs
      return this.getMockExecutiveDashboard().kpis;

    } catch (error) {
      console.error('KPI calculation error:', error);
      return this.getMockExecutiveDashboard().kpis;
    }
  }

  calculateRealExecutiveKPIs(filters = {}) {
    try {
      const budgets = this.getOrganizationBudgets();
      const transactions = this.getTransactionData();

      if (budgets.length === 0) {
        return this.getMockExecutiveDashboard().kpis;
      }

      const totalAllocated = budgets.reduce((sum, b) => sum + (b.allocated || 0), 0);
      const totalSpent = budgets.reduce((sum, b) => sum + (b.spent || 0), 0);
      const utilization = totalAllocated > 0 ? Math.round((totalSpent / totalAllocated) * 100) : 0;

      const pendingApprovals = transactions.filter(t => !t.approver || t.approver === '').length;

      return [
        {
          id: 'total_budget',
          label: 'Total Annual Budget',
          value: totalAllocated,
          format: 'currency',
          trend: 'stable',
          description: 'FY 2024-25 allocated budget'
        },
        {
          id: 'ytd_spending',
          label: 'YTD Spending',
          value: totalSpent,
          format: 'currency',
          trend: 'up',
          trendValue: utilization > 50 ? 5.2 : -2.1,
          description: `${utilization}% of annual budget`
        },
        {
          id: 'budget_utilization',
          label: 'Budget Utilization',
          value: utilization,
          format: 'percentage',
          trend: utilization > 75 ? 'up' : 'stable',
          description: utilization > 75 ? 'Monitor closely' : 'On track for fiscal year'
        },
        {
          id: 'pending_approvals',
          label: 'Pending Approvals',
          value: pendingApprovals,
          format: 'number',
          urgent: pendingApprovals > 10,
          description: pendingApprovals > 10 ? 'Requires attention' : 'Normal queue'
        }
      ];
    } catch (error) {
      console.error('Error calculating real KPIs:', error);
      return this.getMockExecutiveDashboard().kpis;
    }
  }

  getOrganizationBudgets() {
    try {
      if (!this.sheets.organizationBudgets) return [];

      const data = this.sheets.organizationBudgets.getDataRange().getValues();
      const cols = this.columns.OrganizationBudgets;
      const budgets = [];

      for (let i = 1; i < data.length; i++) {
        if (data[i][cols.Organization]) {
          budgets.push({
            organization: data[i][cols.Organization],
            allocated: data[i][cols.BudgetAllocated] || 0,
            spent: data[i][cols.BudgetSpent] || 0,
            encumbered: data[i][cols.BudgetEncumbered] || 0,
            available: data[i][cols.BudgetAvailable] || 0,
            approver: data[i][cols.Approver],
            active: data[i][cols.Active],
            lastModified: data[i][cols.LastModified]
          });
        }
      }

      return budgets;
    } catch (error) {
      console.error('Error getting organization budgets:', error);
      return [];
    }
  }

  getTransactionData(limit = 1000) {
    try {
      if (!this.sheets.transactionLedger) return [];

      const data = this.sheets.transactionLedger.getDataRange().getValues();
      const cols = this.columns.TransactionLedger;
      const transactions = [];

      for (let i = 1; i < data.length && transactions.length < limit; i++) {
        if (data[i][cols.TransactionID]) {
          transactions.push({
            transactionId: data[i][cols.TransactionID],
            orderId: data[i][cols.OrderID],
            processedOn: data[i][cols.ProcessedOn],
            requestor: data[i][cols.Requestor],
            approver: data[i][cols.Approver],
            organization: data[i][cols.Organization],
            form: data[i][cols.Form],
            amount: data[i][cols.Amount] || 0,
            description: data[i][cols.Description],
            fiscalQuarter: data[i][cols.FiscalQuarter],
            invoiceGenerated: data[i][cols.InvoiceGenerated],
            invoiceId: data[i][cols.InvoiceID],
            invoiceUrl: data[i][cols.InvoiceURL]
          });
        }
      }

      return transactions;
    } catch (error) {
      console.error('Error getting transaction data:', error);
      return [];
    }
  }

  getDivisionSummary(filters) {
    try {
      if (this.sheets.organizationBudgets) {
        return this.getRealDivisionSummary(filters);
      }
      return this.getMockExecutiveDashboard().divisionSummary;
    } catch (error) {
      console.error('Division summary error:', error);
      return this.getMockExecutiveDashboard().divisionSummary;
    }
  }

  getRealDivisionSummary(filters = {}) {
    try {
      const budgets = this.getOrganizationBudgets();

      if (budgets.length === 0) {
        console.log('No budgets found, returning mock summary');
        return this.getMockExecutiveDashboard().divisionSummary;
      }

      const divisionMap = {};

      budgets.forEach(budget => {
        if (!budget.organization) return;
        
        const orgCode = this.mapOrganizationToDivision(budget.organization);
        
        if (!divisionMap[orgCode]) {
          divisionMap[orgCode] = {
            division: orgCode,
            name: CONFIG.DIVISIONS[orgCode]?.name || budget.organization,
            allocated: 0,
            spent: 0,
            encumbered: 0,
            available: 0,
            utilization: 0,
            trend: 'stable'
          };
        }

        divisionMap[orgCode].allocated += Number(budget.allocated) || 0;
        divisionMap[orgCode].spent += Number(budget.spent) || 0;
        divisionMap[orgCode].encumbered += Number(budget.encumbered) || 0;
        divisionMap[orgCode].available += Number(budget.available) || 0;
      });

      // Calculate derived metrics
      Object.values(divisionMap).forEach(division => {
        if (division.allocated > 0) {
          division.utilization = Math.round((division.spent / division.allocated) * 100);
          division.trend = division.utilization > 75 ? 'up' : 'stable';
        }
      });
      
      // Ensure we convert to array
      const result = Object.values(divisionMap);
      console.log(`Generated summary for ${result.length} divisions`);
      return result;

    } catch (error) {
      console.error('Error getting real division summary:', error);
      return this.getMockExecutiveDashboard().divisionSummary;
    }
  }

  mapOrganizationToDivision(organization) {
    // Handle null, undefined, or non-string values
    if (!organization || typeof organization !== 'string') {
      console.warn('Invalid organization value:', organization);
      return 'AD'; // Default to Admin
    }

    const orgLower = organization.toLowerCase();
    if (orgLower.includes('upper') || orgLower.includes('us')) return 'US';
    if (orgLower.includes('lower') || orgLower.includes('ls')) return 'LS';
    if (orgLower.includes('keswick kids') || orgLower.includes('kk')) return 'KK';
    if (orgLower.includes('admin') || orgLower.includes('ad')) return 'AD';
    return organization.toUpperCase().substring(0, 3);
  }

  getFinancialHealthMetrics(filters) {
    // Demo mode check
    if (CONFIG.DEMO_MODE) {
      return this.getMockExecutiveDashboard().financialHealth;
    }

    try {
      // Calculate live financial health from actual data
      const orgData = this.getOrganizationBudgetData();
      const transactions = this.sheets.transactionLedger ?
        this.sheets.transactionLedger.getDataRange().getValues().slice(1) : [];

      // Calculate totals
      let totalBudget = 0, totalSpent = 0, totalEncumbered = 0;
      orgData.forEach(org => {
        totalBudget += org.allocated || 0;
        totalSpent += org.spent || 0;
        totalEncumbered += org.encumbered || 0;
      });

      // Calculate burn rate (monthly average spending)
      const monthsElapsed = this.getMonthsElapsedInFiscalYear();
      const monthlyBurnRate = monthsElapsed > 0 ? totalSpent / monthsElapsed : 0;
      const budgetRemaining = totalBudget - totalSpent - totalEncumbered;
      const runwayMonths = monthlyBurnRate > 0 ? Math.floor(budgetRemaining / monthlyBurnRate) : 12;

      // Determine health status using configurable budget pacing
      const utilizationRate = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
      const fiscalMonth = this.getCurrentFiscalMonth();
      const expectedUtilization = CONFIG.BUDGET_PACING.milestones[fiscalMonth] || (monthsElapsed / 12) * 100;
      const tolerance = CONFIG.BUDGET_PACING.tolerance || 10;

      let status = 'healthy';
      let risk = 'low';
      let paceStatus = 'on_track';

      if (utilizationRate > expectedUtilization + tolerance) {
        status = 'warning';
        risk = 'medium';
        paceStatus = 'over_pace';
      }
      if (utilizationRate > expectedUtilization + tolerance * 2) {
        status = 'critical';
        risk = 'high';
        paceStatus = 'over_pace';
      }
      if (utilizationRate < expectedUtilization - tolerance) {
        paceStatus = 'under_pace';
      }

      return {
        status: status,
        paceStatus: paceStatus,  // on_track, over_pace, under_pace
        metrics: {
          cashFlow: budgetRemaining > totalBudget * 0.3 ? 'positive' : 'constrained',
          burnRate: monthlyBurnRate > (totalBudget / 12) * 1.1 ? 'elevated' : 'normal',
          runway: `${runwayMonths} months`,
          risk: risk
        },
        details: {
          totalBudget: totalBudget,
          totalSpent: totalSpent,
          totalEncumbered: totalEncumbered,
          utilizationRate: Math.round(utilizationRate * 10) / 10,
          monthlyBurnRate: Math.round(monthlyBurnRate),
          expectedUtilization: Math.round(expectedUtilization * 10) / 10,
          fiscalMonth: fiscalMonth,
          tolerance: tolerance
        }
      };
    } catch (error) {
      console.error('Financial health calculation error:', error);
      return this.getMockExecutiveDashboard().financialHealth;
    }
  }

  getSystemHealthMetrics(filters) {
    return this.getMockExecutiveDashboard().systemHealth;
  }

  getTACSummary(filters) {
    // Demo mode check
    if (CONFIG.DEMO_MODE) {
      return this.getMockExecutiveDashboard().tacSummary;
    }

    try {
      if (!this.sheets.transactionLedger) {
        console.warn('TransactionLedger not available, using mock TAC data');
        return this.getMockExecutiveDashboard().tacSummary;
      }

      const transactions = this.sheets.transactionLedger.getDataRange().getValues();
      const headers = transactions[0];
      const data = transactions.slice(1);

      const cols = this.columns.TransactionLedger;

      // TAC categories are identified by Organization field containing TAC keywords
      // or by Form type indicating TAC expense
      const tacKeywords = ['TAC', 'Technology', 'Activities', 'Curriculum', 'Field Trip', 'Supplies'];

      let tacTransactions = data.filter(row => {
        const org = String(row[cols.Organization] || '').toLowerCase();
        const desc = String(row[cols.Description] || '').toLowerCase();
        const form = String(row[cols.Form] || '').toLowerCase();
        return tacKeywords.some(kw =>
          org.includes(kw.toLowerCase()) ||
          desc.includes(kw.toLowerCase()) ||
          form.includes(kw.toLowerCase())
        );
      });

      // Categorize TAC expenses
      let techSpent = 0, activitiesSpent = 0, curriculumSpent = 0;

      tacTransactions.forEach(row => {
        const amount = parseFloat(row[cols.Amount]) || 0;
        const org = String(row[cols.Organization] || '').toLowerCase();
        const desc = String(row[cols.Description] || '').toLowerCase();

        if (org.includes('tech') || desc.includes('tech') || desc.includes('computer') || desc.includes('software')) {
          techSpent += amount;
        } else if (org.includes('activit') || desc.includes('field trip') || desc.includes('activit')) {
          activitiesSpent += amount;
        } else {
          curriculumSpent += amount; // Default to curriculum/supplies
        }
      });

      const totalSpent = techSpent + activitiesSpent + curriculumSpent;

      // Get TAC collected from OrganizationBudgets (look for TAC-related orgs)
      const orgData = this.getOrganizationBudgetData();
      let totalCollected = 0;
      orgData.forEach(org => {
        if (String(org.name || '').toLowerCase().includes('tac')) {
          totalCollected += org.allocated || 0;
        }
      });

      // If no TAC org found, estimate from student count * avg fee
      if (totalCollected === 0) {
        const estimatedStudents = 750; // Approximate enrollment
        const avgFee = 1100; // Average TAC fee
        totalCollected = estimatedStudents * avgFee;
      }

      // Apply category weights for allocation
      const techAllocated = Math.round(totalCollected * CONFIG.TAC_CATEGORY_WEIGHTS.technology);
      const activitiesAllocated = Math.round(totalCollected * CONFIG.TAC_CATEGORY_WEIGHTS.activities);
      const curriculumAllocated = Math.round(totalCollected * CONFIG.TAC_CATEGORY_WEIGHTS.consumables);

      return {
        totalCollected: totalCollected,
        totalAllocated: totalCollected, // All collected is allocated
        totalSpent: Math.round(totalSpent),
        totalAvailable: Math.round(totalCollected - totalSpent),
        byCategory: {
          technology: {
            allocated: techAllocated,
            spent: Math.round(techSpent),
            available: techAllocated - Math.round(techSpent)
          },
          activities: {
            allocated: activitiesAllocated,
            spent: Math.round(activitiesSpent),
            available: activitiesAllocated - Math.round(activitiesSpent)
          },
          consumables: {
            allocated: curriculumAllocated,
            spent: Math.round(curriculumSpent),
            available: curriculumAllocated - Math.round(curriculumSpent)
          }
        },
        transactionCount: tacTransactions.length,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('TAC summary calculation error:', error);
      return this.getMockExecutiveDashboard().tacSummary;
    }
  }

  /**
   * Get TAC tracking data by individual grade level
   * Returns enrollment, fees, spending, and variance for each of the 17 grades
   */
  getTACByGrade(filters) {
    const enrollment = this.getEnrollmentData();
    const grades = CONFIG.TAC_GRADE_ORDER;
    const tacFees = CONFIG.TAC_TECHNOLOGY_FEES;
    const stepUpRates = CONFIG.STEP_UP_RATES;

    // Get spending data by grade from transactions
    let spendingByGrade = {};
    grades.forEach(grade => {
      spendingByGrade[grade] = { curricular: 0, fieldTrip: 0, techCost: 0, total: 0 };
    });

    // Query TransactionLedger for grade-tagged transactions
    if (!CONFIG.DEMO_MODE && this.sheets.transactionLedger) {
      try {
        const transactions = this.sheets.transactionLedger.getDataRange().getValues();
        const cols = this.columns.TransactionLedger;
        const data = transactions.slice(1);

        data.forEach(row => {
          const amount = parseFloat(row[cols.Amount]) || 0;
          const org = String(row[cols.Organization] || '').toLowerCase();
          const desc = String(row[cols.Description] || '').toLowerCase();
          const form = String(row[cols.Form] || '').toLowerCase();
          const dept = String(row[cols.Department] || '');

          // Try to identify grade from department or description
          let matchedGrade = null;
          grades.forEach(grade => {
            const gradePattern = new RegExp(`\\b${grade}\\b|grade\\s*${grade}|gr\\.?\\s*${grade}`, 'i');
            if (gradePattern.test(dept) || gradePattern.test(desc)) {
              matchedGrade = grade;
            }
          });

          if (matchedGrade && spendingByGrade[matchedGrade]) {
            // Categorize by expense type
            if (form.includes('curriculum') || desc.includes('textbook') || desc.includes('workbook')) {
              spendingByGrade[matchedGrade].curricular += amount;
            } else if (form.includes('field trip') || desc.includes('field trip') || desc.includes('excursion')) {
              spendingByGrade[matchedGrade].fieldTrip += amount;
            } else if (desc.includes('tech') || desc.includes('device') || desc.includes('chromebook')) {
              spendingByGrade[matchedGrade].techCost += amount;
            } else {
              spendingByGrade[matchedGrade].curricular += amount; // Default to curricular
            }
            spendingByGrade[matchedGrade].total += amount;
          }
        });
      } catch (error) {
        console.error('Error fetching grade spending data:', error);
      }
    }

    // Build grade-level TAC data
    const gradeData = grades.map(grade => {
      const enrollmentCount = enrollment[grade] || 0;
      const tacFee = tacFees[grade] || 0;
      const tacBudgeted = enrollmentCount * tacFee;
      const spending = spendingByGrade[grade] || { curricular: 0, fieldTrip: 0, techCost: 0, total: 0 };
      const tacSpent = spending.total;
      const variance = tacBudgeted - tacSpent;
      const variancePercent = tacBudgeted > 0 ? ((variance / tacBudgeted) * 100) : 0;

      // Step Up calculations (quarterly payment = annual / 4)
      const stepUpRate = stepUpRates[grade] || 0;
      const stepUpExpectedAnnual = enrollmentCount * stepUpRate;
      const stepUpExpectedQuarterly = Math.round(stepUpExpectedAnnual / 4);

      // Determine status based on variance
      let status = 'on_track';
      if (variancePercent < -10) status = 'over_budget';
      else if (variancePercent < 0) status = 'warning';
      else if (variancePercent > 20) status = 'under_utilized';

      // Get division for this grade
      let division = 'AD';
      Object.keys(CONFIG.DIVISIONS).forEach(div => {
        if (CONFIG.DIVISIONS[div].grades.includes(grade)) {
          division = div;
        }
      });

      return {
        grade: grade,
        division: division,
        enrollment: enrollmentCount,
        tacFee: tacFee,
        tacBudgeted: tacBudgeted,
        tacSpent: Math.round(tacSpent),
        variance: Math.round(variance),
        variancePercent: Math.round(variancePercent * 10) / 10,
        curricular: Math.round(spending.curricular),
        fieldTrip: Math.round(spending.fieldTrip),
        techCost: Math.round(spending.techCost),
        stepUpExpectedQuarterly: stepUpExpectedQuarterly,
        stepUpRate: stepUpRate,
        status: status
      };
    });

    // Calculate totals
    const totals = {
      enrollment: gradeData.reduce((sum, g) => sum + g.enrollment, 0),
      tacBudgeted: gradeData.reduce((sum, g) => sum + g.tacBudgeted, 0),
      tacSpent: gradeData.reduce((sum, g) => sum + g.tacSpent, 0),
      variance: gradeData.reduce((sum, g) => sum + g.variance, 0),
      curricular: gradeData.reduce((sum, g) => sum + g.curricular, 0),
      fieldTrip: gradeData.reduce((sum, g) => sum + g.fieldTrip, 0),
      techCost: gradeData.reduce((sum, g) => sum + g.techCost, 0),
      stepUpExpectedQuarterly: gradeData.reduce((sum, g) => sum + g.stepUpExpectedQuarterly, 0)
    };

    return {
      grades: gradeData,
      totals: totals,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Get enrollment data from Script Properties
   */
  getEnrollmentData() {
    try {
      const props = PropertiesService.getScriptProperties();
      const enrollmentJson = props.getProperty('TAC_ENROLLMENT');
      if (enrollmentJson) {
        return JSON.parse(enrollmentJson);
      }
    } catch (error) {
      console.error('Error reading enrollment data:', error);
    }

    // Return default/empty enrollment
    const defaultEnrollment = {};
    CONFIG.TAC_GRADE_ORDER.forEach(grade => {
      defaultEnrollment[grade] = 0;
    });
    return defaultEnrollment;
  }

  /**
   * Save enrollment data to Script Properties
   */
  saveEnrollmentData(enrollmentByGrade) {
    try {
      const props = PropertiesService.getScriptProperties();
      props.setProperty('TAC_ENROLLMENT', JSON.stringify(enrollmentByGrade));
      return { success: true, message: 'Enrollment data saved successfully' };
    } catch (error) {
      console.error('Error saving enrollment data:', error);
      return { success: false, message: 'Failed to save enrollment data: ' + error.message };
    }
  }

  /**
   * Get spending variance by department
   * Returns departments with over/under budget status
   */
  getSpendingVarianceByDepartment() {
    if (CONFIG.DEMO_MODE) {
      return this.getMockDepartmentVariance();
    }

    try {
      const orgData = this.getOrganizationBudgetData();
      return orgData.map(org => {
        const variance = org.allocated - org.spent;
        const percentVariance = org.allocated > 0 ? ((variance / org.allocated) * 100) : 0;
        let status = 'on_track';
        if (percentVariance < -10) status = 'over_budget';
        else if (percentVariance < 0) status = 'warning';
        else if (percentVariance > 30) status = 'under_utilized';

        return {
          department: org.name,
          division: org.division || 'AD',
          allocated: org.allocated,
          spent: org.spent,
          variance: Math.round(variance),
          percentVariance: Math.round(percentVariance * 10) / 10,
          status: status
        };
      }).sort((a, b) => a.variance - b.variance); // Sort by variance (worst first)
    } catch (error) {
      console.error('Error calculating department variance:', error);
      return this.getMockDepartmentVariance();
    }
  }

  getMockDepartmentVariance() {
    return [
      { department: 'Math', division: 'US', allocated: 25000, spent: 28500, variance: -3500, percentVariance: -14, status: 'over_budget' },
      { department: 'Science', division: 'US', allocated: 30000, spent: 31200, variance: -1200, percentVariance: -4, status: 'warning' },
      { department: 'English', division: 'US', allocated: 22000, spent: 19800, variance: 2200, percentVariance: 10, status: 'on_track' },
      { department: 'Grade 3', division: 'LS', allocated: 15000, spent: 12500, variance: 2500, percentVariance: 16.7, status: 'on_track' },
      { department: 'Grade 4', division: 'LS', allocated: 15000, spent: 8500, variance: 6500, percentVariance: 43.3, status: 'under_utilized' },
      { department: 'Admin', division: 'AD', allocated: 50000, spent: 42000, variance: 8000, percentVariance: 16, status: 'on_track' }
    ];
  }

  /**
   * Get approval turnaround metrics
   * Tracks how long approvals take on average
   */
  getApprovalTurnaroundMetrics() {
    if (CONFIG.DEMO_MODE) {
      return {
        avgHours: 18.5,
        medianHours: 12,
        maxHours: 96,
        pendingCount: 12,
        overdueCount: 3,
        overdueThreshold: CONFIG.ALERT_THRESHOLDS.approval_delay
      };
    }

    try {
      // Query AutomatedQueue for pending items with timestamps
      if (!this.sheets.automatedQueue) {
        return this.getApprovalTurnaroundMetrics(); // Return mock if no sheet
      }

      const data = this.sheets.automatedQueue.getDataRange().getValues();
      const headers = data[0];
      const rows = data.slice(1);

      const submittedIdx = headers.indexOf('SubmittedOn') !== -1 ? headers.indexOf('SubmittedOn') : headers.indexOf('Timestamp');
      const processedIdx = headers.indexOf('ProcessedOn') !== -1 ? headers.indexOf('ProcessedOn') : -1;
      const statusIdx = headers.indexOf('Status');

      let turnaroundTimes = [];
      let pendingCount = 0;
      let overdueCount = 0;
      const now = new Date();
      const overdueThreshold = CONFIG.ALERT_THRESHOLDS.approval_delay;

      rows.forEach(row => {
        const status = String(row[statusIdx] || '').toLowerCase();
        const submittedOn = row[submittedIdx] ? new Date(row[submittedIdx]) : null;
        const processedOn = processedIdx >= 0 && row[processedIdx] ? new Date(row[processedIdx]) : null;

        if (status === 'pending' || status === 'awaiting approval') {
          pendingCount++;
          if (submittedOn) {
            const hoursWaiting = (now - submittedOn) / (1000 * 60 * 60);
            if (hoursWaiting > overdueThreshold) {
              overdueCount++;
            }
          }
        }

        if (submittedOn && processedOn && processedOn > submittedOn) {
          const hours = (processedOn - submittedOn) / (1000 * 60 * 60);
          turnaroundTimes.push(hours);
        }
      });

      // Calculate statistics
      const avgHours = turnaroundTimes.length > 0
        ? turnaroundTimes.reduce((a, b) => a + b, 0) / turnaroundTimes.length
        : 0;
      const sortedTimes = [...turnaroundTimes].sort((a, b) => a - b);
      const medianHours = sortedTimes.length > 0
        ? sortedTimes[Math.floor(sortedTimes.length / 2)]
        : 0;
      const maxHours = sortedTimes.length > 0
        ? sortedTimes[sortedTimes.length - 1]
        : 0;

      return {
        avgHours: Math.round(avgHours * 10) / 10,
        medianHours: Math.round(medianHours * 10) / 10,
        maxHours: Math.round(maxHours),
        pendingCount: pendingCount,
        overdueCount: overdueCount,
        overdueThreshold: overdueThreshold
      };
    } catch (error) {
      console.error('Error calculating approval metrics:', error);
      return {
        avgHours: 0,
        medianHours: 0,
        maxHours: 0,
        pendingCount: 0,
        overdueCount: 0,
        overdueThreshold: CONFIG.ALERT_THRESHOLDS.approval_delay
      };
    }
  }

  /**
   * Get cost per student metrics
   * Uses enrollment data from TAC tracker
   */
  getCostPerStudentMetrics() {
    const enrollment = this.getEnrollmentData();
    const totalEnrollment = Object.values(enrollment).reduce((sum, count) => sum + count, 0);

    if (CONFIG.DEMO_MODE || totalEnrollment === 0) {
      return {
        overall: 2800,
        byDivision: [
          { division: 'US', costPerStudent: 3200, enrollment: 350, totalSpent: 1120000 },
          { division: 'MS', costPerStudent: 2900, enrollment: 200, totalSpent: 580000 },
          { division: 'LS', costPerStudent: 2600, enrollment: 300, totalSpent: 780000 },
          { division: 'KK', costPerStudent: 2200, enrollment: 100, totalSpent: 220000 }
        ],
        byCategory: [
          { category: 'Curriculum', costPerStudent: 850 },
          { category: 'Technology', costPerStudent: 650 },
          { category: 'Supplies', costPerStudent: 450 },
          { category: 'Field Trips', costPerStudent: 350 },
          { category: 'Other', costPerStudent: 500 }
        ]
      };
    }

    try {
      // Get total spending
      const budgetData = this.getKPIs({});
      const totalSpent = budgetData.find(k => k.id === 'ytd_spending')?.value || 0;
      const overall = totalEnrollment > 0 ? Math.round(totalSpent / totalEnrollment) : 0;

      // Calculate by division
      const byDivision = Object.keys(CONFIG.DIVISIONS).filter(d => d !== 'AD').map(div => {
        const divGrades = CONFIG.DIVISIONS[div].grades;
        const divEnrollment = divGrades.reduce((sum, g) => sum + (enrollment[g] || 0), 0);
        // Estimate division spending proportionally (would need actual data for accuracy)
        const divSpent = totalEnrollment > 0 ? Math.round(totalSpent * (divEnrollment / totalEnrollment)) : 0;
        return {
          division: div,
          costPerStudent: divEnrollment > 0 ? Math.round(divSpent / divEnrollment) : 0,
          enrollment: divEnrollment,
          totalSpent: divSpent
        };
      });

      return {
        overall: overall,
        byDivision: byDivision,
        byCategory: [] // Would need category breakdown from transactions
      };
    } catch (error) {
      console.error('Error calculating cost per student:', error);
      return { overall: 0, byDivision: [], byCategory: [] };
    }
  }

  /**
   * Get Step Up payment status
   * Calculates expected quarterly payments based on enrollment and Step Up rates
   */
  getStepUpPaymentStatus() {
    const enrollment = this.getEnrollmentData();
    const grades = CONFIG.TAC_GRADE_ORDER;
    const stepUpRates = CONFIG.STEP_UP_RATES;

    // Calculate expected annual and quarterly payments
    let totalAnnual = 0;
    grades.forEach(grade => {
      const count = enrollment[grade] || 0;
      const rate = stepUpRates[grade] || 0;
      totalAnnual += count * rate;
    });

    const quarterlyExpected = Math.round(totalAnnual / 4);

    // Current fiscal quarter (July = Q1)
    const now = new Date();
    const month = now.getMonth();
    let currentQuarter = 1;
    if (month >= 9) currentQuarter = 2;      // Oct-Dec
    else if (month >= 0 && month < 3) currentQuarter = 3;  // Jan-Mar
    else if (month >= 3 && month < 6) currentQuarter = 4;  // Apr-Jun
    // Jul-Sep is Q1

    // Demo data for received amounts (would come from actual tracking)
    const received = {
      q1: currentQuarter >= 1 ? quarterlyExpected : 0,
      q2: currentQuarter >= 2 ? quarterlyExpected : 0,
      q3: currentQuarter >= 3 ? Math.round(quarterlyExpected * 0.85) : 0, // Slight variance
      q4: currentQuarter >= 4 ? 0 : 0
    };

    return {
      annualExpected: totalAnnual,
      quarterlyExpected: quarterlyExpected,
      currentQuarter: currentQuarter,
      quarters: {
        q1: { expected: quarterlyExpected, received: received.q1, variance: received.q1 - quarterlyExpected },
        q2: { expected: quarterlyExpected, received: received.q2, variance: received.q2 - quarterlyExpected },
        q3: { expected: quarterlyExpected, received: received.q3, variance: received.q3 - quarterlyExpected },
        q4: { expected: quarterlyExpected, received: received.q4, variance: received.q4 - quarterlyExpected }
      },
      ytdExpected: quarterlyExpected * currentQuarter,
      ytdReceived: received.q1 + received.q2 + received.q3 + received.q4
    };
  }

  getRecentTransactions(filters, limit) {
    // Demo mode check
    if (CONFIG.DEMO_MODE) {
      return this.getMockTransactions(limit);
    }

    try {
      if (this.sheets.transactionLedger) {
        return this.getTransactionData(limit);
      }
      return this.getMockTransactions(limit);
    } catch (error) {
      console.error('Transaction fetch error:', error);
      return this.getMockTransactions(limit);
    }
  }

  getSystemAlerts() {
    return this.getMockExecutiveDashboard().alerts;
  }

  getSpendingTrends(filters) {
    // Demo mode check
    if (CONFIG.DEMO_MODE) {
      return this.getMockExecutiveDashboard().trends;
    }

    try {
      if (!this.sheets.transactionLedger) {
        console.warn('TransactionLedger not available, using mock trends');
        return this.getMockExecutiveDashboard().trends;
      }

      const transactions = this.sheets.transactionLedger.getDataRange().getValues();
      const data = transactions.slice(1);
      const cols = this.columns.TransactionLedger;

      // Get monthly spending trends
      const monthlyData = {};
      const categoryData = {};
      const fiscalYearStart = this.getFiscalYearStart();

      data.forEach(row => {
        const processedDate = row[cols.ProcessedOn];
        const amount = parseFloat(row[cols.Amount]) || 0;
        const org = String(row[cols.Organization] || 'Other');

        if (processedDate && processedDate >= fiscalYearStart) {
          // Monthly aggregation
          const date = new Date(processedDate);
          const monthKey = date.toLocaleString('en-US', { month: 'short' });

          if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = { actual: 0, count: 0 };
          }
          monthlyData[monthKey].actual += amount;
          monthlyData[monthKey].count++;

          // Category aggregation (use Organization as category proxy)
          const category = this.categorizeTransaction(org, row[cols.Description]);
          if (!categoryData[category]) {
            categoryData[category] = 0;
          }
          categoryData[category] += amount;
        }
      });

      // Build monthly trend array
      const months = ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];
      const orgData = this.getOrganizationBudgetData();
      const totalBudget = orgData.reduce((sum, org) => sum + (org.allocated || 0), 0);
      const monthlyBudget = Math.round(totalBudget / 12);

      const monthly = months.map(month => ({
        month: month,
        budget: monthlyBudget,
        actual: Math.round(monthlyData[month]?.actual || 0)
      })).filter(m => m.actual > 0 || months.indexOf(m.month) <= this.getCurrentFiscalMonth());

      // Build categorical breakdown
      const totalSpending = Object.values(categoryData).reduce((sum, amt) => sum + amt, 0);
      const categorical = Object.entries(categoryData)
        .map(([category, amount]) => ({
          category: category,
          amount: Math.round(amount),
          percentage: totalSpending > 0 ? Math.round((amount / totalSpending) * 1000) / 10 : 0
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 7); // Top 7 categories

      return {
        monthly: monthly.length > 0 ? monthly : this.getMockMonthlyTrend(),
        categorical: categorical.length > 0 ? categorical : this.getMockCategoricalSpending(),
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Spending trends calculation error:', error);
      return this.getMockExecutiveDashboard().trends;
    }
  }

  // Helper: Categorize transaction based on org/description
  categorizeTransaction(org, description) {
    const orgLower = String(org).toLowerCase();
    const descLower = String(description || '').toLowerCase();

    if (orgLower.includes('tech') || descLower.includes('computer') || descLower.includes('software')) {
      return 'Technology';
    }
    if (orgLower.includes('curriculum') || descLower.includes('textbook') || descLower.includes('book')) {
      return 'Curriculum';
    }
    if (orgLower.includes('supply') || orgLower.includes('supplies') || descLower.includes('supply')) {
      return 'Supplies';
    }
    if (descLower.includes('training') || descLower.includes('conference') || descLower.includes('workshop')) {
      return 'Prof. Dev.';
    }
    if (orgLower.includes('facilit') || descLower.includes('maintenance') || descLower.includes('repair')) {
      return 'Facilities';
    }
    if (orgLower.includes('activit') || descLower.includes('field trip') || descLower.includes('event')) {
      return 'Activities';
    }
    return 'Other';
  }

  // Helper: Get fiscal year start date
  getFiscalYearStart() {
    const now = new Date();
    const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
    return new Date(year, 6, 1); // July 1
  }

  // Helper: Get months elapsed in fiscal year
  getMonthsElapsedInFiscalYear() {
    const now = new Date();
    const fyStart = this.getFiscalYearStart();
    const monthsDiff = (now.getFullYear() - fyStart.getFullYear()) * 12 +
                       (now.getMonth() - fyStart.getMonth());
    return Math.max(1, monthsDiff);
  }

  // Helper: Get current fiscal month index (0 = July, 6 = Jan, etc.)
  getCurrentFiscalMonth() {
    const now = new Date();
    const month = now.getMonth();
    // Fiscal year starts in July (index 6)
    return month >= 6 ? month - 6 : month + 6;
  }

  // Helper: Get organization budget data
  getOrganizationBudgetData() {
    try {
      if (!this.sheets.organizationBudgets) return [];

      const data = this.sheets.organizationBudgets.getDataRange().getValues();
      const cols = this.columns.OrganizationBudgets;

      return data.slice(1).map(row => ({
        name: row[cols.Organization],
        allocated: parseFloat(row[cols.BudgetAllocated]) || 0,
        spent: parseFloat(row[cols.BudgetSpent]) || 0,
        encumbered: parseFloat(row[cols.BudgetEncumbered]) || 0,
        available: parseFloat(row[cols.BudgetAvailable]) || 0
      })).filter(org => org.name && org.allocated > 0);
    } catch (error) {
      console.error('Organization budget fetch error:', error);
      return [];
    }
  }

  logAccess(email, action, details) {
    try {
      if (this.sheets.systemLog) {
        // Log to actual system log
        const timestamp = new Date();
        const logEntry = [timestamp, action, email, '', details, '', '', 'SUCCESS'];
        this.sheets.systemLog.appendRow(logEntry);
      }
      console.log(`Access logged: ${email} - ${action} - ${details}`);
    } catch (error) {
      console.error('Logging error:', error);
    }
  }

  // ============================================================================
  // REPORT GENERATION FUNCTIONS
  // ============================================================================

  /**
   * Get Admin Expenses Report
   * Filters transactions where Division = 'AD' or Organization contains 'Admin'
   */
  getAdminExpensesReport(filters) {
    const transactions = this.getTransactionDataForReports(filters);

    const adminTransactions = transactions.filter(t => {
      const div = String(t.division || '').toUpperCase();
      const org = String(t.organization || '').toLowerCase();
      return div === 'AD' || org.includes('admin');
    });

    // Group by department within admin
    const byDepartment = {};
    adminTransactions.forEach(t => {
      const dept = t.department || 'General Admin';
      if (!byDepartment[dept]) {
        byDepartment[dept] = { department: dept, transactions: [], totalAmount: 0 };
      }
      byDepartment[dept].transactions.push(t);
      byDepartment[dept].totalAmount += t.amount || 0;
    });

    return {
      reportType: 'Admin Expenses',
      generatedAt: new Date().toISOString(),
      totalTransactions: adminTransactions.length,
      totalAmount: adminTransactions.reduce((sum, t) => sum + (t.amount || 0), 0),
      byDepartment: Object.values(byDepartment).sort((a, b) => b.totalAmount - a.totalAmount),
      transactions: adminTransactions
    };
  }

  /**
   * Get Curriculum Report by Department
   * For US: groups by subject (Math, Science, English, etc.)
   * For LS: groups by grade level (K, 1, 2, 3, 4, 5)
   */
  getCurriculumReport(filters) {
    const transactions = this.getTransactionDataForReports(filters);

    const curriculumTransactions = transactions.filter(t => {
      const form = String(t.form || '').toLowerCase();
      const org = String(t.organization || '').toLowerCase();
      return form.includes('curriculum') || org.includes('curriculum') ||
             org.includes('textbook') || org.includes('workbook');
    });

    // Group by department/subject
    const byDepartment = {};
    curriculumTransactions.forEach(t => {
      const dept = t.department || 'General Curriculum';
      const division = t.division || 'AD';
      const key = `${division}-${dept}`;

      if (!byDepartment[key]) {
        byDepartment[key] = {
          department: dept,
          division: division,
          transactions: [],
          totalAmount: 0
        };
      }
      byDepartment[key].transactions.push(t);
      byDepartment[key].totalAmount += t.amount || 0;
    });

    return {
      reportType: 'Curriculum by Department',
      generatedAt: new Date().toISOString(),
      totalTransactions: curriculumTransactions.length,
      totalAmount: curriculumTransactions.reduce((sum, t) => sum + (t.amount || 0), 0),
      byDepartment: Object.values(byDepartment).sort((a, b) => b.totalAmount - a.totalAmount),
      transactions: curriculumTransactions
    };
  }

  /**
   * Get Field Trip Report by Division
   * Groups field trip expenses by division with destination and student count
   */
  getFieldTripReport(filters) {
    const transactions = this.getTransactionDataForReports(filters);

    const fieldTripTransactions = transactions.filter(t => {
      const form = String(t.form || '').toLowerCase();
      const desc = String(t.description || '').toLowerCase();
      return form.includes('field trip') || desc.includes('field trip') ||
             desc.includes('excursion') || desc.includes('admission');
    });

    // Group by division
    const byDivision = {};
    fieldTripTransactions.forEach(t => {
      const division = t.division || 'AD';

      if (!byDivision[division]) {
        byDivision[division] = {
          division: division,
          divisionName: CONFIG.DIVISIONS[division]?.name || division,
          trips: [],
          totalAmount: 0,
          tripCount: 0
        };
      }
      byDivision[division].trips.push({
        date: t.date,
        description: t.description,
        vendor: t.vendor,
        amount: t.amount,
        requestor: t.requestor,
        status: t.status
      });
      byDivision[division].totalAmount += t.amount || 0;
      byDivision[division].tripCount++;
    });

    return {
      reportType: 'Field Trips by Division',
      generatedAt: new Date().toISOString(),
      totalTrips: fieldTripTransactions.length,
      totalAmount: fieldTripTransactions.reduce((sum, t) => sum + (t.amount || 0), 0),
      byDivision: Object.values(byDivision).sort((a, b) => b.totalAmount - a.totalAmount),
      transactions: fieldTripTransactions
    };
  }

  /**
   * Get Supply Report (Amazon/Warehouse) by Teacher
   * Aggregatable to department and division levels
   */
  getSupplyReport(filters, aggregateLevel = 'teacher') {
    const transactions = this.getTransactionDataForReports(filters);

    const supplyTransactions = transactions.filter(t => {
      const form = String(t.form || '').toLowerCase();
      return form.includes('amazon') || form.includes('warehouse') ||
             form.includes('supply') || form.includes('supplies');
    });

    // Group by teacher (requestor)
    const byTeacher = {};
    supplyTransactions.forEach(t => {
      const teacher = t.requestor || 'Unknown';
      const dept = t.department || 'General';
      const division = t.division || 'AD';

      if (!byTeacher[teacher]) {
        byTeacher[teacher] = {
          teacher: teacher,
          department: dept,
          division: division,
          items: [],
          totalAmount: 0,
          amazonCount: 0,
          warehouseCount: 0
        };
      }
      byTeacher[teacher].items.push({
        date: t.date,
        description: t.description,
        vendor: t.vendor,
        form: t.form,
        amount: t.amount,
        status: t.status
      });
      byTeacher[teacher].totalAmount += t.amount || 0;
      if (String(t.form || '').toLowerCase().includes('amazon')) {
        byTeacher[teacher].amazonCount++;
      } else {
        byTeacher[teacher].warehouseCount++;
      }
    });

    // Aggregate to department level if requested
    let byDepartment = {};
    if (aggregateLevel === 'department' || aggregateLevel === 'division') {
      Object.values(byTeacher).forEach(teacher => {
        const key = teacher.department;
        if (!byDepartment[key]) {
          byDepartment[key] = {
            department: key,
            division: teacher.division,
            teachers: [],
            totalAmount: 0,
            amazonCount: 0,
            warehouseCount: 0
          };
        }
        byDepartment[key].teachers.push(teacher.teacher);
        byDepartment[key].totalAmount += teacher.totalAmount;
        byDepartment[key].amazonCount += teacher.amazonCount;
        byDepartment[key].warehouseCount += teacher.warehouseCount;
      });
    }

    // Aggregate to division level if requested
    let byDivision = {};
    if (aggregateLevel === 'division') {
      Object.values(byDepartment).forEach(dept => {
        const key = dept.division;
        if (!byDivision[key]) {
          byDivision[key] = {
            division: key,
            divisionName: CONFIG.DIVISIONS[key]?.name || key,
            departments: [],
            totalAmount: 0,
            amazonCount: 0,
            warehouseCount: 0
          };
        }
        byDivision[key].departments.push(dept.department);
        byDivision[key].totalAmount += dept.totalAmount;
        byDivision[key].amazonCount += dept.amazonCount;
        byDivision[key].warehouseCount += dept.warehouseCount;
      });
    }

    return {
      reportType: 'Amazon/Warehouse Supplies',
      aggregateLevel: aggregateLevel,
      generatedAt: new Date().toISOString(),
      totalOrders: supplyTransactions.length,
      totalAmount: supplyTransactions.reduce((sum, t) => sum + (t.amount || 0), 0),
      byTeacher: aggregateLevel === 'teacher' ? Object.values(byTeacher).sort((a, b) => b.totalAmount - a.totalAmount) : null,
      byDepartment: aggregateLevel === 'department' ? Object.values(byDepartment).sort((a, b) => b.totalAmount - a.totalAmount) : null,
      byDivision: aggregateLevel === 'division' ? Object.values(byDivision).sort((a, b) => b.totalAmount - a.totalAmount) : null,
      transactions: supplyTransactions
    };
  }

  /**
   * Helper: Get transaction data formatted for reports
   */
  getTransactionDataForReports(filters) {
    if (CONFIG.DEMO_MODE) {
      return this.getMockReportTransactions();
    }

    try {
      if (!this.sheets.transactionLedger) {
        return this.getMockReportTransactions();
      }

      const transactions = this.sheets.transactionLedger.getDataRange().getValues();
      const cols = this.columns.TransactionLedger;
      const data = transactions.slice(1);

      return data.map(row => ({
        transactionId: row[cols.TransactionID],
        date: row[cols.ProcessedOn] || row[cols.Timestamp],
        division: row[cols.Division],
        department: row[cols.Department],
        organization: row[cols.Organization],
        vendor: row[cols.Vendor],
        description: row[cols.Description],
        form: row[cols.Form],
        amount: parseFloat(row[cols.Amount]) || 0,
        status: row[cols.Status],
        requestor: row[cols.Email] || row[cols.Requestor]
      })).filter(t => {
        // Apply filters
        if (filters.division && filters.division !== 'ALL' && t.division !== filters.division) {
          return false;
        }
        if (filters.status && filters.status !== 'ALL' && t.status !== filters.status) {
          return false;
        }
        if (filters.dateFrom && t.date < new Date(filters.dateFrom)) {
          return false;
        }
        if (filters.dateTo && t.date > new Date(filters.dateTo)) {
          return false;
        }
        return true;
      });
    } catch (error) {
      console.error('Error fetching transaction data for reports:', error);
      return this.getMockReportTransactions();
    }
  }

  getMockReportTransactions() {
    return [
      { transactionId: 'CUR-001', date: new Date(), division: 'US', department: 'Math', organization: 'Curriculum', vendor: 'Pearson', description: 'Algebra II Textbooks', form: 'Curriculum', amount: 2500, status: 'Approved', requestor: 'jsmith@keswickchristian.org' },
      { transactionId: 'CUR-002', date: new Date(), division: 'US', department: 'Science', organization: 'Curriculum', vendor: 'McGraw Hill', description: 'Chemistry Lab Supplies', form: 'Curriculum', amount: 1800, status: 'Approved', requestor: 'mjones@keswickchristian.org' },
      { transactionId: 'FT-001', date: new Date(), division: 'LS', department: 'Grade 3', organization: 'Activities', vendor: 'Tampa Zoo', description: 'Field Trip - Zoo Visit', form: 'Field Trip', amount: 1200, status: 'Approved', requestor: 'kbrown@keswickchristian.org' },
      { transactionId: 'AMZ-001', date: new Date(), division: 'US', department: 'English', organization: 'Classroom', vendor: 'Amazon', description: 'Classroom Supplies', form: 'Amazon', amount: 150, status: 'Approved', requestor: 'lwhite@keswickchristian.org' },
      { transactionId: 'WH-001', date: new Date(), division: 'LS', department: 'Grade 4', organization: 'Classroom', vendor: 'County Warehouse', description: 'Paper and Markers', form: 'Warehouse', amount: 85, status: 'Approved', requestor: 'dgreen@keswickchristian.org' },
      { transactionId: 'ADM-001', date: new Date(), division: 'AD', department: 'Business Office', organization: 'Admin', vendor: 'Office Depot', description: 'Office Supplies', form: 'Admin', amount: 320, status: 'Approved', requestor: 'sneel@keswickchristian.org' }
    ];
  }

  // ============================================================================
  // MOCK DATA GENERATORS
  // ============================================================================

  getMockExecutiveDashboard() {
    return {
      user: {
        firstName: 'Demo',
        lastName: 'Executive',
        role: 'executive'
      },
      kpis: [
        {
          id: 'total_budget',
          label: 'Total Annual Budget',
          value: 5000000,
          format: 'currency',
          trend: 'stable',
          description: 'FY 2024-25 allocated budget'
        },
        {
          id: 'ytd_spending',
          label: 'YTD Spending',
          value: 2100000,
          format: 'currency',
          trend: 'up',
          trendValue: 5.2,
          description: '42% of annual budget'
        },
        {
          id: 'budget_utilization',
          label: 'Budget Utilization',
          value: 42,
          format: 'percentage',
          trend: 'stable',
          description: 'On track for fiscal year'
        },
        {
          id: 'pending_approvals',
          label: 'Pending Approvals',
          value: 12,
          format: 'number',
          urgent: true,
          description: 'Requires attention'
        }
      ],
      divisionSummary: [
        {
          division: 'US',
          name: 'Upper School',
          allocated: 2000000,
          spent: 840000,
          encumbered: 160000,
          available: 1000000,
          utilization: 42,
          trend: 'stable'
        },
        {
          division: 'LS',
          name: 'Lower School',
          allocated: 1800000,
          spent: 756000,
          encumbered: 144000,
          available: 900000,
          utilization: 42,
          trend: 'stable'
        },
        {
          division: 'KK',
          name: 'Keswick Kids',
          allocated: 800000,
          spent: 336000,
          encumbered: 64000,
          available: 400000,
          utilization: 42,
          trend: 'stable'
        },
        {
          division: 'AD',
          name: 'Administration',
          allocated: 400000,
          spent: 168000,
          encumbered: 32000,
          available: 200000,
          utilization: 42,
          trend: 'stable'
        }
      ],
      financialHealth: {
        status: 'healthy',
        paceStatus: 'on_track',  // on_track, over_pace, under_pace
        metrics: {
          cashFlow: 'positive',
          burnRate: 'normal',
          runway: '8 months',
          risk: 'low'
        },
        details: {
          totalBudget: 5000000,
          totalSpent: 2100000,
          totalEncumbered: 400000,
          utilizationRate: 42,
          monthlyBurnRate: 350000,
          expectedUtilization: 45,  // Based on current fiscal month pacing
          fiscalMonth: this.getCurrentFiscalMonth(),
          tolerance: CONFIG.BUDGET_PACING.tolerance
        }
      },
      systemHealth: {
        status: 'operational',
        lastUpdate: new Date().toISOString(),
        components: {
          database: 'healthy',
          integrations: 'healthy',
          processing: 'healthy'
        }
      },
      tacSummary: {
        totalCollected: 850000,
        totalAllocated: 800000,
        totalSpent: 340000,
        totalAvailable: 460000,
        byCategory: {
          technology: { allocated: 440000, spent: 187000 },
          activities: { allocated: 200000, spent: 85000 },
          consumables: { allocated: 160000, spent: 68000 }
        }
      },
      transactions: this.getMockTransactions(20),
      alerts: [
        {
          id: 1,
          type: 'warning',
          category: 'budget',
          message: 'Science department at 85% budget utilization',
          timestamp: new Date(),
          division: 'US',
          department: 'Science'
        },
        {
          id: 2,
          type: 'info',
          category: 'approval',
          message: '3 purchase orders pending approval > 72 hours',
          timestamp: new Date()
        }
      ],
      trends: {
        monthly: this.getMockMonthlyTrend(),
        categorical: this.getMockCategoricalSpending()
      }
    };
  }

  getMockTransactions(count) {
    const vendors = ['Amazon', 'Staples', 'Apple', 'Best Buy', 'Office Depot'];
    const statuses = ['Approved', 'Pending', 'Processing'];
    const divisions = ['US', 'LS', 'KK', 'AD'];
    const departments = ['Math', 'Science', 'English', 'Elementary', 'Administration'];

    return Array.from({ length: count }, (_, i) => ({
      transactionId: `TRX-2024-${(1000 + i).toString().padStart(4, '0')}`,
      date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      division: divisions[Math.floor(Math.random() * divisions.length)],
      department: departments[Math.floor(Math.random() * departments.length)],
      vendor: vendors[Math.floor(Math.random() * vendors.length)],
      description: `Purchase Order ${i + 1}`,
      amount: Math.round(Math.random() * 5000 + 100),
      tac: Math.round(Math.random() * 500),
      status: statuses[Math.floor(Math.random() * statuses.length)],
      submitter: `teacher${i + 1}@keswickchristian.org`
    }));
  }

  getMockMonthlyTrend() {
    const months = ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'];
    return months.map((month, i) => ({
      month: month,
      budget: 416667,
      actual: 350000 + Math.random() * 100000,
      forecast: 400000 + Math.random() * 50000
    }));
  }

  getMockCategoricalSpending() {
    return [
      { category: 'Technology', amount: 450000, percentage: 21.4 },
      { category: 'Curriculum', amount: 380000, percentage: 18.1 },
      { category: 'Supplies', amount: 320000, percentage: 15.2 },
      { category: 'Professional Development', amount: 280000, percentage: 13.3 },
      { category: 'Facilities', amount: 240000, percentage: 11.4 },
      { category: 'Activities', amount: 220000, percentage: 10.5 },
      { category: 'Other', amount: 210000, percentage: 10.0 }
    ];
  }

  getMockPrincipalKPIs() {
    return [
      { id: 'division_budget', label: 'Division Budget', value: 1800000, format: 'currency' },
      { id: 'division_spent', label: 'Spent to Date', value: 756000, format: 'currency' },
      { id: 'division_utilization', label: 'Utilization Rate', value: 42, format: 'percentage' },
      { id: 'pending_requests', label: 'Pending Requests', value: 8, format: 'number' }
    ];
  }

  getMockDepartmentKPIs() {
    return [
      { id: 'dept_budget', label: 'Department Budget', value: 250000, format: 'currency' },
      { id: 'dept_spent', label: 'Spent to Date', value: 105000, format: 'currency' },
      { id: 'dept_available', label: 'Available Budget', value: 145000, format: 'currency' },
      { id: 'dept_utilization', label: 'Utilization Rate', value: 42, format: 'percentage' }
    ];
  }

  getMockDepartmentSummary(divisions) {
    return [
      { department: 'Math', allocated: 250000, spent: 105000, available: 145000, utilization: 42 },
      { department: 'Science', allocated: 300000, spent: 126000, available: 174000, utilization: 42 },
      { department: 'English', allocated: 200000, spent: 84000, available: 116000, utilization: 42 },
      { department: 'History', allocated: 180000, spent: 75600, available: 104400, utilization: 42 }
    ];
  }

  getMockTACAnalysis(divisions) {
    return {
      total: 400000,
      allocated: 380000,
      spent: 160000,
      available: 220000,
      byGrade: [
        { grade: '9', students: 100, fee: 1250, total: 125000, allocated: 118750, spent: 50000 },
        { grade: '10', students: 95, fee: 1250, total: 118750, allocated: 112512, spent: 47250 },
        { grade: '11', students: 90, fee: 1300, total: 117000, allocated: 111150, spent: 46800 },
        { grade: '12', students: 85, fee: 1300, total: 110500, allocated: 104975, spent: 44200 }
      ]
    };
  }

  getMockBudgetStatus(divisions) {
    return divisions.map(div => ({
      division: div,
      status: 'on-track',
      projectedYearEnd: 1750000,
      variance: 50000,
      risk: 'low'
    }));
  }

  getMockApprovalQueue(divisions) {
    return Array.from({ length: 8 }, (_, i) => ({
      id: `APR-${1000 + i}`,
      date: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
      requester: `teacher${i + 1}@keswickchristian.org`,
      amount: Math.round(Math.random() * 2000 + 500),
      description: `Purchase Request ${i + 1}`,
      urgency: i < 3 ? 'high' : 'normal',
      daysWaiting: i + 1
    }));
  }

  getMockDivisionAlerts(divisions) {
    return [
      {
        type: 'warning',
        message: 'Math department approaching budget limit (85%)',
        division: divisions[0],
        timestamp: new Date()
      },
      {
        type: 'info',
        message: '2 purchase orders pending > 48 hours',
        division: divisions[0],
        timestamp: new Date()
      }
    ];
  }

  getMockDepartmentBudget(department) {
    return {
      department: department,
      fiscalYear: '2024-25',
      allocated: 250000,
      spent: 105000,
      encumbered: 20000,
      available: 125000,
      monthlyBurn: 21000,
      projectedYearEnd: 252000,
      variance: -2000
    };
  }

  getMockTACBreakdown(departments) {
    return {
      total: 50000,
      byCategory: {
        technology: { allocated: 27500, spent: 11550, available: 15950 },
        activities: { allocated: 12500, spent: 5250, available: 7250 },
        consumables: { allocated: 10000, spent: 4200, available: 5800 }
      }
    };
  }

  getMockDepartmentSpending(departments) {
    return {
      monthly: [
        { month: 'Aug', budget: 20833, actual: 18000 },
        { month: 'Sep', budget: 20833, actual: 22000 },
        { month: 'Oct', budget: 20833, actual: 21000 },
        { month: 'Nov', budget: 20833, actual: 19500 },
        { month: 'Dec', budget: 20833, actual: 24500 }
      ],
      byVendor: [
        { vendor: 'Amazon', amount: 35000, percentage: 33.3 },
        { vendor: 'Staples', amount: 25000, percentage: 23.8 },
        { vendor: 'Apple', amount: 20000, percentage: 19.0 },
        { vendor: 'Other', amount: 25000, percentage: 23.8 }
      ]
    };
  }

  getMockDepartmentComparison(department) {
    return {
      currentYear: {
        allocated: 250000,
        spent: 105000,
        utilization: 42
      },
      previousYear: {
        allocated: 240000,
        spent: 238000,
        utilization: 99.2
      },
      variance: {
        budget: 10000,
        spending: -133000,
        efficiency: 'improved'
      }
    };
  }

  getMockPrincipalDashboard() {
    return {
      user: {
        firstName: 'Demo',
        lastName: 'Principal',
        role: 'principal',
        divisions: ['US']
      },
      kpis: this.getMockPrincipalKPIs(),
      departments: this.getMockDepartmentSummary(['US']),
      transactions: this.getMockTransactions(50),
      tacAnalysis: this.getMockTACAnalysis(['US']),
      budgetStatus: this.getMockBudgetStatus(['US']),
      approvalQueue: this.getMockApprovalQueue(['US']),
      alerts: this.getMockDivisionAlerts(['US'])
    };
  }

  getMockDepartmentDashboard() {
    return {
      user: {
        firstName: 'Demo',
        lastName: 'Department Head',
        role: 'department_head',
        departments: ['Science']
      },
      kpis: this.getMockDepartmentKPIs(),
      budget: this.getMockDepartmentBudget('Science'),
      transactions: this.getMockTransactions(30),
      tacBreakdown: this.getMockTACBreakdown(['Science']),
      spending: this.getMockDepartmentSpending(['Science']),
      comparison: this.getMockDepartmentComparison('Science')
    };
  }

  // ============================================================================
  // TAC CALCULATOR
  // ============================================================================

  calculateTAC(params = {}) {
    try {
      return {
        summary: this.getMockExecutiveDashboard().tacSummary,
        details: {
          byDivision: Object.keys(CONFIG.DIVISIONS).map(div => ({
            division: div,
            name: CONFIG.DIVISIONS[div].name,
            students: 300,
            totalFees: 375000,
            allocated: 356250,
            spent: 150000,
            available: 206250
          })),
          byCategory: {
            technology: { percentage: 55, amount: 440000 },
            activities: { percentage: 25, amount: 200000 },
            consumables: { percentage: 20, amount: 160000 }
          }
        }
      };
    } catch (error) {
      console.error('TAC calculation error:', error);
      return {
        summary: {
          totalCollected: 0,
          totalAllocated: 0,
          totalSpent: 0,
          totalAvailable: 0
        },
        details: {
          byDivision: [],
          byCategory: {}
        }
      };
    }
  }
}
