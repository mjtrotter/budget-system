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
  DEMO_MODE: (function() { 
    try { 
      let isDemo = PropertiesService.getScriptProperties().getProperty('DEMO_MODE') === 'true'; 
      if (isDemo) {
        let email = Session.getActiveUser().getEmail();
        if (!email) email = Session.getEffectiveUser().getEmail();
        const authorizedDemoUsers = [
          'nstratis@keswickchristian.org', 
          'bendrulat@keswickchristian.org', 
          'sneel@keswickchristian.org', 
          'mtrotter@keswickchristian.org',
          'invoicing@keswickchristian.org' // Including deploying admin
        ];
        if (email && !authorizedDemoUsers.includes(email.toLowerCase())) {
          return false; // Lock down demo mode for non-test users
        }
      }
      return isDemo;
    } catch(e) { return false; } 
  })(),

  // Hub Spreadsheet IDs - OWNED by invoicing@keswickchristian.org
  BUDGET_HUB_ID: '1GpCs2p3dra7xf68Ezz-FSsIScqtc7A62h95FIDc-mKY',
  AUTOMATED_HUB_ID: '1nYl89UUBtk4U1CpcVtX0p3V6wZkCkKD8XtR1eWNza5E',
  MANUAL_HUB_ID: '1MxYNCHZD1SsqcB2oeX5FEgddA6pFRyK-0foCT8SZjYw',

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
    'AD': { name: 'Admin', grades: [] }
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

      // Try to get user info from directory
      let userInfo = this.getUserFromDirectory(email);

      // If not in hardcoded config, evaluate directory role
      if (!userConfig) {
        if (!userInfo) {
          console.warn(`Unauthorized access attempt (Not in directory): ${email}`);
          return { email: email, authenticated: false, error: 'ACCESS_DENIED' };
        }

        const dirRole = (userInfo.role || '').toLowerCase();
        const rawDiv = userInfo.division || '';
        const rawDept = userInfo.department || '';
        
        // Map directory roles to dashboard roles
        if (dirRole.includes('exec') || dirRole.includes('cfo') || dirRole.includes('head of school')) {
          userConfig = { role: 'executive', divisions: ['US', 'LS', 'KK', 'AD'], departments: ['ALL'] };
        } else if (dirRole.includes('princip') || dirRole.includes('director')) {
          userConfig = { role: 'division', divisions: [rawDiv], departments: ['ALL'] };
        } else if (dirRole.includes('dept') || dirRole.includes('department')) {
          userConfig = { role: 'department', divisions: [rawDiv], departments: [rawDept] };
        } else {
          // Deny standard users/teachers access
          console.warn(`Unauthorized access attempt (Role ${dirRole} not allowed): ${email}`);
          return { email: email, authenticated: false, error: 'ACCESS_DENIED' };
        }
      }

      // Default userInfo if still null (for hardcoded users not in directory)
      if (!userInfo) {
        userInfo = {
          firstName: email.split('@')[0],
          lastName: '',
          department: 'ALL',
          division: 'ALL'
        };
      }

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
    // FY 2025-26: July 2025 - June 2026, ~8 months elapsed (through Feb 2026)
    // Total budget: $5M across 4 divisions
    // US $2.1M (58%), LS $1.7M (52%), KK $750K (45%), AD $450K (38%)
    const totalBudget = 5000000;
    const usSpent = 1218000;  // 58% of $2.1M
    const lsSpent = 884000;   // 52% of $1.7M
    const kkSpent = 337500;   // 45% of $750K
    const adSpent = 171000;   // 38% of $450K
    const totalSpent = usSpent + lsSpent + kkSpent + adSpent; // $2,610,500
    const totalEncumbered = 385000;
    const utilizationRate = 52.2; // totalSpent / totalBudget * 100

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
          value: totalBudget,
          format: 'currency',
          trend: 'stable',
          description: 'FY 2025-26 allocated budget'
        },
        {
          id: 'ytd_spending',
          label: 'YTD Spending',
          value: totalSpent,
          format: 'currency',
          trend: 'up',
          trendValue: 3.8,
          description: '52.2% of annual budget'
        },
        {
          id: 'budget_utilization',
          label: 'Budget Utilization',
          value: utilizationRate,
          format: 'percentage',
          trend: 'stable',
          description: 'On track for fiscal year (8 of 12 months elapsed)'
        },
        {
          id: 'pending_approvals',
          label: 'Pending Approvals',
          value: 9,
          format: 'number',
          urgent: true,
          description: '3 pending > 72 hours'
        }
      ],
      divisionSummary: [
        {
          division: 'US',
          name: 'Upper School',
          allocated: 2100000,
          spent: usSpent,
          encumbered: 189000,
          available: 2100000 - usSpent - 189000,
          utilization: 58,
          trend: 'up'
        },
        {
          division: 'LS',
          name: 'Lower School',
          allocated: 1700000,
          spent: lsSpent,
          encumbered: 119000,
          available: 1700000 - lsSpent - 119000,
          utilization: 52,
          trend: 'stable'
        },
        {
          division: 'KK',
          name: 'Keswick Kids',
          allocated: 750000,
          spent: kkSpent,
          encumbered: 48500,
          available: 750000 - kkSpent - 48500,
          utilization: 45,
          trend: 'stable'
        },
        {
          division: 'AD',
          name: 'Admin',
          allocated: 450000,
          spent: adSpent,
          encumbered: 28500,
          available: 450000 - adSpent - 28500,
          utilization: 38,
          trend: 'down'
        }
      ],
      financialHealth: {
        status: 'healthy',
        paceStatus: 'on_track',
        metrics: {
          cashFlow: 'positive',
          burnRate: 'normal',
          runway: '4 months',
          risk: 'low'
        },
        details: {
          totalBudget: totalBudget,
          totalSpent: totalSpent,
          totalEncumbered: totalEncumbered,
          utilizationRate: utilizationRate,
          monthlyBurnRate: 326312,
          expectedUtilization: 55,
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
        totalCollected: 825000,
        totalAllocated: 783750,
        totalSpent: 412800,
        totalAvailable: 370950,
        byCategory: {
          technology: { allocated: 430000, spent: 228500 },
          activities: { allocated: 196000, spent: 102300 },
          consumables: { allocated: 157750, spent: 82000 }
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
        },
        {
          id: 3,
          type: 'info',
          category: 'processing',
          message: 'Warehouse order processing delayed — expected 48hr turnaround',
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
    // Deterministic realistic transactions for Keswick Christian School
    const allTransactions = [
      { transactionId: 'AMZ-US-0115', date: new Date('2026-01-15'), division: 'US', department: 'Math', vendor: 'Amazon', description: 'Amazon - 30 TI-84 Plus CE Calculators', amount: 3450, tac: 3450, status: 'Approved', submitter: 'nstratis@keswickchristian.org' },
      { transactionId: 'CUR-US-0118', date: new Date('2026-01-18'), division: 'US', department: 'Math', vendor: 'Pearson', description: 'Curriculum - Pearson Algebra II Textbooks', amount: 4200, tac: 0, status: 'Approved', submitter: 'nstratis@keswickchristian.org' },
      { transactionId: 'AMZ-US-0122', date: new Date('2026-01-22'), division: 'US', department: 'Science', vendor: 'Amazon', description: 'Amazon - Chemistry Lab Goggles (class set of 30)', amount: 285, tac: 285, status: 'Approved', submitter: 'bendrulat@keswickchristian.org' },
      { transactionId: 'WHS-LS-0220', date: new Date('2026-02-20'), division: 'LS', department: 'Grade 3', vendor: 'County Warehouse', description: 'Warehouse - Copy Paper Case x12', amount: 156, tac: 0, status: 'Approved', submitter: 'sneel@keswickchristian.org' },
      { transactionId: 'AMZ-US-0205', date: new Date('2026-02-05'), division: 'US', department: 'Science', vendor: 'Amazon', description: 'Amazon - Dissection Kit Refills x15', amount: 675, tac: 675, status: 'Approved', submitter: 'bendrulat@keswickchristian.org' },
      { transactionId: 'FLD-LS-0305', date: new Date('2026-03-05'), division: 'LS', department: 'Grade 5', vendor: 'Kennedy Space Center', description: 'Field Trip - Kennedy Space Center (Grade 5)', amount: 2800, tac: 2800, status: 'Approved', submitter: 'sneel@keswickchristian.org' },
      { transactionId: 'ADM-AD-0210', date: new Date('2026-02-10'), division: 'AD', department: 'Business Office', vendor: 'FACTS Management', description: 'Admin - Annual FACTS License Renewal', amount: 8500, tac: 0, status: 'Approved', submitter: 'mtrotter@keswickchristian.org' },
      { transactionId: 'AMZ-US-0228', date: new Date('2026-02-28'), division: 'US', department: 'English', vendor: 'Amazon', description: 'Amazon - Novel Sets: "To Kill a Mockingbird" x35', amount: 315, tac: 0, status: 'Approved', submitter: 'nstratis@keswickchristian.org' },
      { transactionId: 'CUR-US-0302', date: new Date('2026-03-02'), division: 'US', department: 'History', vendor: 'National Geographic', description: 'Curriculum - AP US History Document Reader', amount: 1890, tac: 0, status: 'Approved', submitter: 'bendrulat@keswickchristian.org' },
      { transactionId: 'AMZ-US-0303', date: new Date('2026-03-03'), division: 'US', department: 'Art', vendor: 'Amazon', description: 'Amazon - Acrylic Paint Set (48 colors) x10', amount: 420, tac: 420, status: 'Pending', submitter: 'nstratis@keswickchristian.org' },
      { transactionId: 'WHS-LS-0304', date: new Date('2026-03-04'), division: 'LS', department: 'Grade 1', vendor: 'County Warehouse', description: 'Warehouse - Glue Sticks Bulk Pack x200', amount: 89, tac: 0, status: 'Processing', submitter: 'sneel@keswickchristian.org' },
      { transactionId: 'AMZ-KK-0225', date: new Date('2026-02-25'), division: 'KK', department: 'PreK4', vendor: 'Amazon', description: 'Amazon - Play-Doh Classroom Pack (24 tubs)', amount: 148, tac: 148, status: 'Approved', submitter: 'sneel@keswickchristian.org' },
      { transactionId: 'FLD-KK-0310', date: new Date('2026-03-10'), division: 'KK', department: 'Kindergarten', vendor: 'Tampa Zoo', description: 'Field Trip - Tampa Zoo (Kindergarten)', amount: 450, tac: 450, status: 'Pending', submitter: 'sneel@keswickchristian.org' },
      { transactionId: 'AMZ-US-0306', date: new Date('2026-03-06'), division: 'US', department: 'Music', vendor: 'Amazon', description: 'Amazon - Sheet Music: Spring Concert Collection', amount: 225, tac: 225, status: 'Pending', submitter: 'bendrulat@keswickchristian.org' },
      { transactionId: 'ADM-AD-0301', date: new Date('2026-03-01'), division: 'AD', department: 'IT', vendor: 'CDW', description: 'Admin - Replacement Chromebook Chargers x25', amount: 625, tac: 0, status: 'Approved', submitter: 'mtrotter@keswickchristian.org' },
      { transactionId: 'WHS-US-0307', date: new Date('2026-03-07'), division: 'US', department: 'PE', vendor: 'County Warehouse', description: 'Warehouse - Dodgeballs and Cones Set', amount: 210, tac: 210, status: 'Processing', submitter: 'nstratis@keswickchristian.org' },
      { transactionId: 'AMZ-LS-0308', date: new Date('2026-03-08'), division: 'LS', department: 'Specials', vendor: 'Amazon', description: 'Amazon - STEM Building Blocks Classroom Kit', amount: 389, tac: 389, status: 'Approved', submitter: 'sneel@keswickchristian.org' },
      { transactionId: 'CUR-US-0309', date: new Date('2026-03-09'), division: 'US', department: 'Bible', vendor: 'David C Cook', description: 'Curriculum - Bible Study Workbooks (Grade 10)', amount: 560, tac: 0, status: 'Approved', submitter: 'bendrulat@keswickchristian.org' },
      { transactionId: 'AMZ-US-0311', date: new Date('2026-03-11'), division: 'US', department: 'World Languages', vendor: 'Amazon', description: 'Amazon - Spanish-English Dictionaries x20', amount: 340, tac: 0, status: 'Pending', submitter: 'nstratis@keswickchristian.org' },
      { transactionId: 'ADM-AD-0312', date: new Date('2026-03-12'), division: 'AD', department: 'Facilities', vendor: 'Home Depot', description: 'Admin - Maintenance Supplies (HVAC Filters)', amount: 475, tac: 0, status: 'Processing', submitter: 'mtrotter@keswickchristian.org' },
      { transactionId: 'AMZ-US-0125', date: new Date('2026-01-25'), division: 'US', department: 'Media', vendor: 'Amazon', description: 'Amazon - Podcast Microphones x4', amount: 520, tac: 520, status: 'Approved', submitter: 'bendrulat@keswickchristian.org' },
      { transactionId: 'WHS-KK-0215', date: new Date('2026-02-15'), division: 'KK', department: 'Toddlers', vendor: 'County Warehouse', description: 'Warehouse - Finger Paint and Easel Paper', amount: 95, tac: 0, status: 'Approved', submitter: 'sneel@keswickchristian.org' },
      { transactionId: 'AMZ-KK-0130', date: new Date('2026-01-30'), division: 'KK', department: 'Infants', vendor: 'Amazon', description: 'Amazon - Sensory Play Mat (set of 6)', amount: 234, tac: 234, status: 'Approved', submitter: 'sneel@keswickchristian.org' },
      { transactionId: 'FLD-US-0218', date: new Date('2026-02-18'), division: 'US', department: 'History', vendor: 'Ybor City Museum', description: 'Field Trip - Ybor City Museum (AP History)', amount: 680, tac: 680, status: 'Approved', submitter: 'bendrulat@keswickchristian.org' },
      { transactionId: 'CUR-LS-0203', date: new Date('2026-02-03'), division: 'LS', department: 'Grade 2', vendor: 'Scholastic', description: 'Curriculum - Guided Reading Level J-M Book Set', amount: 1250, tac: 0, status: 'Approved', submitter: 'sneel@keswickchristian.org' },
      { transactionId: 'ADM-AD-0115', date: new Date('2026-01-15'), division: 'AD', department: 'Development', vendor: 'Constant Contact', description: 'Admin - Annual Email Marketing Platform License', amount: 1800, tac: 0, status: 'Approved', submitter: 'mtrotter@keswickchristian.org' },
      { transactionId: 'AMZ-LS-0208', date: new Date('2026-02-08'), division: 'LS', department: 'Grade 4', vendor: 'Amazon', description: 'Amazon - Fraction Manipulatives Kit x6', amount: 198, tac: 198, status: 'Approved', submitter: 'sneel@keswickchristian.org' },
      { transactionId: 'WHS-US-0212', date: new Date('2026-02-12'), division: 'US', department: 'Science', vendor: 'County Warehouse', description: 'Warehouse - Lab Notebooks x120', amount: 360, tac: 0, status: 'Approved', submitter: 'bendrulat@keswickchristian.org' },
      { transactionId: 'AMZ-KK-0305', date: new Date('2026-03-05'), division: 'KK', department: 'PreK3', vendor: 'Amazon', description: 'Amazon - Wooden Block Set (200 piece)', amount: 165, tac: 165, status: 'Approved', submitter: 'sneel@keswickchristian.org' },
      { transactionId: 'CUR-US-0128', date: new Date('2026-01-28'), division: 'US', department: 'Science', vendor: 'Carolina Biological', description: 'Curriculum - AP Biology Lab Kit (Semester 2)', amount: 2150, tac: 0, status: 'Approved', submitter: 'bendrulat@keswickchristian.org' },
      { transactionId: 'AMZ-US-0201', date: new Date('2026-02-01'), division: 'US', department: 'Math', vendor: 'Amazon', description: 'Amazon - Graphing Calculator Screen Protectors x30', amount: 90, tac: 90, status: 'Approved', submitter: 'nstratis@keswickchristian.org' },
      { transactionId: 'WHS-LS-0110', date: new Date('2026-01-10'), division: 'LS', department: 'Grade 1', vendor: 'County Warehouse', description: 'Warehouse - Construction Paper Bulk (20 colors)', amount: 124, tac: 0, status: 'Approved', submitter: 'sneel@keswickchristian.org' },
      { transactionId: 'AMZ-AD-0120', date: new Date('2026-01-20'), division: 'AD', department: 'IT', vendor: 'Amazon', description: 'Amazon - USB-C Hubs for Teacher Laptops x10', amount: 350, tac: 0, status: 'Approved', submitter: 'mtrotter@keswickchristian.org' },
      { transactionId: 'FLD-LS-0215', date: new Date('2026-02-15'), division: 'LS', department: 'Grade 3', vendor: 'MOSI', description: 'Field Trip - Museum of Science & Industry (Grade 3)', amount: 1650, tac: 1650, status: 'Approved', submitter: 'sneel@keswickchristian.org' },
      { transactionId: 'AMZ-US-0310', date: new Date('2026-03-10'), division: 'US', department: 'English', vendor: 'Amazon', description: 'Amazon - Composition Notebooks x100', amount: 275, tac: 0, status: 'Approved', submitter: 'nstratis@keswickchristian.org' },
      { transactionId: 'CUR-KK-0201', date: new Date('2026-02-01'), division: 'KK', department: 'Kindergarten', vendor: 'Scholastic', description: 'Curriculum - Sight Words Flash Card System', amount: 320, tac: 0, status: 'Approved', submitter: 'sneel@keswickchristian.org' },
      { transactionId: 'WHS-US-0120', date: new Date('2026-01-20'), division: 'US', department: 'Art', vendor: 'County Warehouse', description: 'Warehouse - Drawing Pencil Set (H-9B) x25', amount: 175, tac: 0, status: 'Approved', submitter: 'nstratis@keswickchristian.org' },
      { transactionId: 'AMZ-LS-0125', date: new Date('2026-01-25'), division: 'LS', department: 'Grade 5', vendor: 'Amazon', description: 'Amazon - Science Fair Display Boards x30', amount: 210, tac: 210, status: 'Approved', submitter: 'sneel@keswickchristian.org' },
      { transactionId: 'ADM-AD-0205', date: new Date('2026-02-05'), division: 'AD', department: 'Business Office', vendor: 'Staples', description: 'Admin - Office Supplies Quarterly Order', amount: 425, tac: 0, status: 'Approved', submitter: 'mtrotter@keswickchristian.org' },
      { transactionId: 'AMZ-US-0215', date: new Date('2026-02-15'), division: 'US', department: 'PE', vendor: 'Amazon', description: 'Amazon - Resistance Bands Set (class pack)', amount: 189, tac: 189, status: 'Approved', submitter: 'nstratis@keswickchristian.org' },
      { transactionId: 'CUR-US-0220', date: new Date('2026-02-20'), division: 'US', department: 'World Languages', vendor: 'Vista Higher Learning', description: 'Curriculum - AP Spanish Workbooks x25', amount: 1125, tac: 0, status: 'Approved', submitter: 'nstratis@keswickchristian.org' },
      { transactionId: 'WHS-KK-0310', date: new Date('2026-03-10'), division: 'KK', department: 'PreK4', vendor: 'County Warehouse', description: 'Warehouse - Sanitizing Wipes Bulk Case', amount: 68, tac: 0, status: 'Approved', submitter: 'sneel@keswickchristian.org' },
      { transactionId: 'AMZ-US-0105', date: new Date('2026-01-05'), division: 'US', department: 'Music', vendor: 'Amazon', description: 'Amazon - Ukulele Strings Replacement Set x20', amount: 140, tac: 140, status: 'Approved', submitter: 'bendrulat@keswickchristian.org' },
      { transactionId: 'FLD-US-0312', date: new Date('2026-03-12'), division: 'US', department: 'Science', vendor: 'Florida Aquarium', description: 'Field Trip - Florida Aquarium (Marine Bio)', amount: 1200, tac: 1200, status: 'Pending', submitter: 'bendrulat@keswickchristian.org' },
      { transactionId: 'AMZ-LS-0301', date: new Date('2026-03-01'), division: 'LS', department: 'Grade 2', vendor: 'Amazon', description: 'Amazon - Math Counting Bears Set x8', amount: 176, tac: 176, status: 'Approved', submitter: 'sneel@keswickchristian.org' },
      { transactionId: 'ADM-AD-0308', date: new Date('2026-03-08'), division: 'AD', department: 'Facilities', vendor: 'Grainger', description: 'Admin - Replacement Light Fixtures (LED) x12', amount: 960, tac: 0, status: 'Approved', submitter: 'mtrotter@keswickchristian.org' },
      { transactionId: 'CUR-LS-0310', date: new Date('2026-03-10'), division: 'LS', department: 'Grade 4', vendor: 'Houghton Mifflin', description: 'Curriculum - Social Studies Atlas Set x30', amount: 840, tac: 0, status: 'Approved', submitter: 'sneel@keswickchristian.org' },
      { transactionId: 'AMZ-US-0313', date: new Date('2026-03-13'), division: 'US', department: 'Bible', vendor: 'Amazon', description: 'Amazon - Devotional Journals x35', amount: 385, tac: 0, status: 'Processing', submitter: 'bendrulat@keswickchristian.org' },
      { transactionId: 'WHS-LS-0313', date: new Date('2026-03-13'), division: 'LS', department: 'Specials', vendor: 'County Warehouse', description: 'Warehouse - Laminating Film Rolls x6', amount: 132, tac: 0, status: 'Processing', submitter: 'sneel@keswickchristian.org' },
      { transactionId: 'AMZ-KK-0313', date: new Date('2026-03-13'), division: 'KK', department: 'Toddlers', vendor: 'Amazon', description: 'Amazon - Soft Stacking Rings (set of 12)', amount: 108, tac: 108, status: 'Pending', submitter: 'sneel@keswickchristian.org' }
    ];

    return allTransactions.slice(0, count);
  }

  getMockMonthlyTrend() {
    // FY 2025-26: Seasonal pattern — high Aug-Sep (back to school), dip Dec, uptick Jan-Feb
    return [
      { month: 'Jul',  budget: 416667, actual: 285000, forecast: 290000 },
      { month: 'Aug',  budget: 416667, actual: 520000, forecast: 510000 },
      { month: 'Sep',  budget: 416667, actual: 485000, forecast: 475000 },
      { month: 'Oct',  budget: 416667, actual: 365000, forecast: 370000 },
      { month: 'Nov',  budget: 416667, actual: 310000, forecast: 320000 },
      { month: 'Dec',  budget: 416667, actual: 195000, forecast: 210000 },
      { month: 'Jan',  budget: 416667, actual: 380000, forecast: 375000 },
      { month: 'Feb',  budget: 416667, actual: 345000, forecast: 350000 }
    ];
  }

  getMockCategoricalSpending() {
    // Total YTD spending ~$2.61M broken down by category
    return [
      { category: 'Technology',                amount: 542000, percentage: 20.8 },
      { category: 'Curriculum & Textbooks',    amount: 495000, percentage: 19.0 },
      { category: 'Classroom Supplies',        amount: 391500, percentage: 15.0 },
      { category: 'Professional Development',  amount: 313200, percentage: 12.0 },
      { category: 'Facilities & Maintenance',  amount: 287100, percentage: 11.0 },
      { category: 'Field Trips & Activities',  amount: 261000, percentage: 10.0 },
      { category: 'Administrative & Licensing', amount: 182700, percentage: 7.0 },
      { category: 'Other',                     amount: 138000, percentage: 5.3 }
    ];
  }

  getMockPrincipalKPIs() {
    // Default to Upper School view
    return [
      { id: 'division_budget', label: 'Division Budget', value: 2100000, format: 'currency' },
      { id: 'division_spent', label: 'Spent to Date', value: 1218000, format: 'currency' },
      { id: 'division_utilization', label: 'Utilization Rate', value: 58, format: 'percentage' },
      { id: 'pending_requests', label: 'Pending Requests', value: 5, format: 'number' }
    ];
  }

  getMockDepartmentKPIs() {
    // Default to Science department (highest utilization — alert state)
    return [
      { id: 'dept_budget', label: 'Department Budget', value: 310000, format: 'currency' },
      { id: 'dept_spent', label: 'Spent to Date', value: 263500, format: 'currency' },
      { id: 'dept_available', label: 'Available Budget', value: 46500, format: 'currency' },
      { id: 'dept_utilization', label: 'Utilization Rate', value: 85, format: 'percentage' }
    ];
  }

  getMockDepartmentSummary(divisions) {
    const deptData = {
      US: [
        { department: 'Science',          division: 'US', allocated: 310000, spent: 263500, available: 46500,  utilization: 85 },
        { department: 'Math',             division: 'US', allocated: 280000, spent: 173600, available: 106400, utilization: 62 },
        { department: 'English',          division: 'US', allocated: 240000, spent: 115200, available: 124800, utilization: 48 },
        { department: 'History',          division: 'US', allocated: 220000, spent: 121000, available: 99000,  utilization: 55 },
        { department: 'World Languages',  division: 'US', allocated: 180000, spent: 79200,  available: 100800, utilization: 44 },
        { department: 'Art',              division: 'US', allocated: 160000, spent: 56000,  available: 104000, utilization: 35 },
        { department: 'Music',            division: 'US', allocated: 175000, spent: 89250,  available: 85750,  utilization: 51 },
        { department: 'PE',               division: 'US', allocated: 145000, spent: 68150,  available: 76850,  utilization: 47 },
        { department: 'Media',            division: 'US', allocated: 195000, spent: 131625, available: 63375,  utilization: 67.5 },
        { department: 'Bible',            division: 'US', allocated: 195000, spent: 120900, available: 74100,  utilization: 62 }
      ],
      LS: [
        { department: 'Grade 1',  division: 'LS', allocated: 290000, spent: 156600, available: 133400, utilization: 54 },
        { department: 'Grade 2',  division: 'LS', allocated: 285000, spent: 145350, available: 139650, utilization: 51 },
        { department: 'Grade 3',  division: 'LS', allocated: 295000, spent: 162250, available: 132750, utilization: 55 },
        { department: 'Grade 4',  division: 'LS', allocated: 280000, spent: 137200, available: 142800, utilization: 49 },
        { department: 'Grade 5',  division: 'LS', allocated: 300000, spent: 162000, available: 138000, utilization: 54 },
        { department: 'Specials', division: 'LS', allocated: 250000, spent: 120000, available: 130000, utilization: 48 }
      ],
      KK: [
        { department: 'Infants',      division: 'KK', allocated: 120000, spent: 48000,  available: 72000,  utilization: 40 },
        { department: 'Toddlers',     division: 'KK', allocated: 130000, spent: 54600,  available: 75400,  utilization: 42 },
        { department: 'PreK3',        division: 'KK', allocated: 155000, spent: 72850,  available: 82150,  utilization: 47 },
        { department: 'PreK4',        division: 'KK', allocated: 170000, spent: 81600,  available: 88400,  utilization: 48 },
        { department: 'Kindergarten', division: 'KK', allocated: 175000, spent: 80500,  available: 94500,  utilization: 46 }
      ],
      AD: [
        { department: 'Business Office', division: 'AD', allocated: 125000, spent: 50000,  available: 75000,  utilization: 40 },
        { department: 'IT',              division: 'AD', allocated: 135000, spent: 54000,  available: 81000,  utilization: 40 },
        { department: 'Facilities',      division: 'AD', allocated: 115000, spent: 40250,  available: 74750,  utilization: 35 },
        { department: 'Development',     division: 'AD', allocated: 75000,  spent: 26250,  available: 48750,  utilization: 35 }
      ]
    };

    const result = [];
    (divisions || ['US']).forEach(function(div) {
      if (deptData[div]) {
        deptData[div].forEach(function(dept) { result.push(dept); });
      }
    });
    return result;
  }

  getMockTACAnalysis(divisions) {
    const tacData = {
      US: {
        total: 471250,
        allocated: 447688,
        spent: 236000,
        available: 211688,
        byGrade: [
          { grade: '9',  students: 105, fee: 1250, total: 131250, allocated: 124688, spent: 65800 },
          { grade: '10', students: 98,  fee: 1250, total: 122500, allocated: 116375, spent: 61400 },
          { grade: '11', students: 92,  fee: 1300, total: 119600, allocated: 113620, spent: 59900 },
          { grade: '12', students: 87,  fee: 1300, total: 113100, allocated: 107445, spent: 48900 }
        ]
      },
      LS: {
        total: 225000,
        allocated: 213750,
        spent: 112500,
        available: 101250,
        byGrade: [
          { grade: '1', students: 72, fee: 650, total: 46800, allocated: 44460, spent: 23400 },
          { grade: '2', students: 68, fee: 650, total: 44200, allocated: 41990, spent: 22100 },
          { grade: '3', students: 70, fee: 650, total: 45500, allocated: 43225, spent: 22750 },
          { grade: '4', students: 65, fee: 650, total: 42250, allocated: 40138, spent: 21125 },
          { grade: '5', students: 71, fee: 650, total: 46150, allocated: 43843, spent: 23075 }
        ]
      },
      KK: {
        total: 128750,
        allocated: 122312,
        spent: 64300,
        available: 58012,
        byGrade: [
          { grade: 'Infants',      students: 24, fee: 500, total: 12000, allocated: 11400, spent: 6000 },
          { grade: 'Toddlers',     students: 30, fee: 500, total: 15000, allocated: 14250, spent: 7500 },
          { grade: 'PreK3',        students: 45, fee: 550, total: 24750, allocated: 23512, spent: 12375 },
          { grade: 'PreK4',        students: 52, fee: 600, total: 31200, allocated: 29640, spent: 16400 },
          { grade: 'Kindergarten', students: 55, fee: 600, total: 33000, allocated: 31350, spent: 17400 }
        ]
      }
    };

    const combined = { total: 0, allocated: 0, spent: 0, available: 0, byGrade: [] };
    (divisions || ['US']).forEach(function(div) {
      if (tacData[div]) {
        combined.total += tacData[div].total;
        combined.allocated += tacData[div].allocated;
        combined.spent += tacData[div].spent;
        combined.available += tacData[div].available;
        tacData[div].byGrade.forEach(function(g) { combined.byGrade.push(g); });
      }
    });
    return combined;
  }

  getMockBudgetStatus(divisions) {
    const statusData = {
      US: { division: 'US', status: 'on-track',  projectedYearEnd: 1890000, variance: 210000, risk: 'low' },
      LS: { division: 'LS', status: 'on-track',  projectedYearEnd: 1530000, variance: 170000, risk: 'low' },
      KK: { division: 'KK', status: 'under',     projectedYearEnd: 620000,  variance: 130000, risk: 'low' },
      AD: { division: 'AD', status: 'under',      projectedYearEnd: 380000,  variance: 70000,  risk: 'low' }
    };

    return (divisions || ['US']).map(function(div) {
      return statusData[div] || { division: div, status: 'unknown', projectedYearEnd: 0, variance: 0, risk: 'unknown' };
    });
  }

  getMockApprovalQueue(divisions) {
    const allApprovals = [
      { id: 'APR-2026-1001', date: new Date('2026-03-08'), requester: 'bendrulat@keswickchristian.org', division: 'US', department: 'Science', amount: 1200, description: 'Field Trip - Florida Aquarium (Marine Bio)', urgency: 'high', daysWaiting: 5 },
      { id: 'APR-2026-1002', date: new Date('2026-03-09'), requester: 'nstratis@keswickchristian.org', division: 'US', department: 'Art', amount: 420, description: 'Amazon - Acrylic Paint Set (48 colors) x10', urgency: 'high', daysWaiting: 4 },
      { id: 'APR-2026-1003', date: new Date('2026-03-10'), requester: 'sneel@keswickchristian.org', division: 'KK', department: 'Kindergarten', amount: 450, description: 'Field Trip - Tampa Zoo (Kindergarten)', urgency: 'high', daysWaiting: 3 },
      { id: 'APR-2026-1004', date: new Date('2026-03-11'), requester: 'nstratis@keswickchristian.org', division: 'US', department: 'World Languages', amount: 340, description: 'Amazon - Spanish-English Dictionaries x20', urgency: 'normal', daysWaiting: 2 },
      { id: 'APR-2026-1005', date: new Date('2026-03-11'), requester: 'bendrulat@keswickchristian.org', division: 'US', department: 'Music', amount: 225, description: 'Amazon - Sheet Music: Spring Concert Collection', urgency: 'normal', daysWaiting: 2 },
      { id: 'APR-2026-1006', date: new Date('2026-03-12'), requester: 'sneel@keswickchristian.org', division: 'KK', department: 'Toddlers', amount: 108, description: 'Amazon - Soft Stacking Rings (set of 12)', urgency: 'normal', daysWaiting: 1 },
      { id: 'APR-2026-1007', date: new Date('2026-03-12'), requester: 'mtrotter@keswickchristian.org', division: 'AD', department: 'Facilities', amount: 475, description: 'Admin - Maintenance Supplies (HVAC Filters)', urgency: 'normal', daysWaiting: 1 },
      { id: 'APR-2026-1008', date: new Date('2026-03-13'), requester: 'nstratis@keswickchristian.org', division: 'US', department: 'PE', amount: 210, description: 'Warehouse - Dodgeballs and Cones Set', urgency: 'normal', daysWaiting: 0 },
      { id: 'APR-2026-1009', date: new Date('2026-03-13'), requester: 'bendrulat@keswickchristian.org', division: 'US', department: 'Bible', amount: 385, description: 'Amazon - Devotional Journals x35', urgency: 'normal', daysWaiting: 0 }
    ];

    if (!divisions || divisions.length === 0) return allApprovals;
    return allApprovals.filter(function(a) { return divisions.indexOf(a.division) !== -1; });
  }

  getMockDivisionAlerts(divisions) {
    const allAlerts = [
      {
        type: 'warning',
        message: 'Science department at 85% budget utilization — review remaining allocations',
        division: 'US',
        department: 'Science',
        timestamp: new Date('2026-03-13')
      },
      {
        type: 'info',
        message: '3 purchase orders pending approval > 72 hours',
        division: 'US',
        timestamp: new Date('2026-03-13')
      },
      {
        type: 'info',
        message: 'Warehouse order processing delayed — expected 48hr turnaround',
        division: 'LS',
        timestamp: new Date('2026-03-12')
      }
    ];

    if (!divisions || divisions.length === 0) return allAlerts;
    return allAlerts.filter(function(a) { return !a.division || divisions.indexOf(a.division) !== -1; });
  }

  getMockDepartmentBudget(department) {
    const budgets = {
      'Science':          { allocated: 310000, spent: 263500, encumbered: 18600, monthlyBurn: 32937 },
      'Math':             { allocated: 280000, spent: 173600, encumbered: 14000, monthlyBurn: 21700 },
      'English':          { allocated: 240000, spent: 115200, encumbered: 9600,  monthlyBurn: 14400 },
      'History':          { allocated: 220000, spent: 121000, encumbered: 11000, monthlyBurn: 15125 },
      'Art':              { allocated: 160000, spent: 56000,  encumbered: 6400,  monthlyBurn: 7000 },
      'Music':            { allocated: 175000, spent: 89250,  encumbered: 8750,  monthlyBurn: 11156 },
      'PE':               { allocated: 145000, spent: 68150,  encumbered: 5800,  monthlyBurn: 8519 },
      'Media':            { allocated: 195000, spent: 131625, encumbered: 11700, monthlyBurn: 16453 },
      'Bible':            { allocated: 195000, spent: 120900, encumbered: 9750,  monthlyBurn: 15112 },
      'World Languages':  { allocated: 180000, spent: 79200,  encumbered: 7200,  monthlyBurn: 9900 },
      'Grade 1':          { allocated: 290000, spent: 156600, encumbered: 11600, monthlyBurn: 19575 },
      'Grade 2':          { allocated: 285000, spent: 145350, encumbered: 11400, monthlyBurn: 18169 },
      'Grade 3':          { allocated: 295000, spent: 162250, encumbered: 14750, monthlyBurn: 20281 },
      'Grade 4':          { allocated: 280000, spent: 137200, encumbered: 11200, monthlyBurn: 17150 },
      'Grade 5':          { allocated: 300000, spent: 162000, encumbered: 15000, monthlyBurn: 20250 },
      'Specials':         { allocated: 250000, spent: 120000, encumbered: 10000, monthlyBurn: 15000 },
      'Infants':          { allocated: 120000, spent: 48000,  encumbered: 4800,  monthlyBurn: 6000 },
      'Toddlers':         { allocated: 130000, spent: 54600,  encumbered: 5200,  monthlyBurn: 6825 },
      'PreK3':            { allocated: 155000, spent: 72850,  encumbered: 6200,  monthlyBurn: 9106 },
      'PreK4':            { allocated: 170000, spent: 81600,  encumbered: 6800,  monthlyBurn: 10200 },
      'Kindergarten':     { allocated: 175000, spent: 80500,  encumbered: 7000,  monthlyBurn: 10062 },
      'Business Office':  { allocated: 125000, spent: 50000,  encumbered: 5000,  monthlyBurn: 6250 },
      'IT':               { allocated: 135000, spent: 54000,  encumbered: 5400,  monthlyBurn: 6750 },
      'Facilities':       { allocated: 115000, spent: 40250,  encumbered: 4600,  monthlyBurn: 5031 },
      'Development':      { allocated: 75000,  spent: 26250,  encumbered: 3000,  monthlyBurn: 3281 }
    };

    var data = budgets[department] || budgets['Science'];
    var projectedYearEnd = data.spent + (data.monthlyBurn * 4); // 4 months remaining
    return {
      department: department,
      fiscalYear: '2025-26',
      allocated: data.allocated,
      spent: data.spent,
      encumbered: data.encumbered,
      available: data.allocated - data.spent - data.encumbered,
      monthlyBurn: data.monthlyBurn,
      projectedYearEnd: projectedYearEnd,
      variance: data.allocated - projectedYearEnd
    };
  }

  getMockTACBreakdown(departments) {
    var breakdown = {
      technology: { allocated: 0, spent: 0, available: 0 },
      activities: { allocated: 0, spent: 0, available: 0 },
      consumables: { allocated: 0, spent: 0, available: 0 }
    };

    // TAC splits per department (deterministic lookup)
    var tacByDept = {
      'Science':     { technology: { a: 18000, s: 10800 }, activities: { a: 8000,  s: 4800  }, consumables: { a: 6500, s: 3900  } },
      'Math':        { technology: { a: 15000, s: 9000  }, activities: { a: 5000,  s: 3000  }, consumables: { a: 5000, s: 3000  } },
      'English':     { technology: { a: 8000,  s: 4000  }, activities: { a: 4000,  s: 2000  }, consumables: { a: 6000, s: 3600  } },
      'History':     { technology: { a: 7000,  s: 3500  }, activities: { a: 6000,  s: 3600  }, consumables: { a: 4000, s: 2400  } },
      'Art':         { technology: { a: 5000,  s: 1750  }, activities: { a: 3000,  s: 1050  }, consumables: { a: 8000, s: 2800  } },
      'Music':       { technology: { a: 9000,  s: 4590  }, activities: { a: 5000,  s: 2550  }, consumables: { a: 3000, s: 1530  } },
      'PE':          { technology: { a: 3000,  s: 1410  }, activities: { a: 7000,  s: 3290  }, consumables: { a: 4000, s: 1880  } },
      'Media':       { technology: { a: 16000, s: 10720 }, activities: { a: 3000,  s: 2010  }, consumables: { a: 2000, s: 1340  } },
      'Bible':       { technology: { a: 6000,  s: 3720  }, activities: { a: 4000,  s: 2480  }, consumables: { a: 3000, s: 1860  } },
      'World Languages': { technology: { a: 8000, s: 3520 }, activities: { a: 3000, s: 1320 }, consumables: { a: 3000, s: 1320 } }
    };
    // Default fallback for departments not listed
    var defaultTac = { technology: { a: 5000, s: 2500 }, activities: { a: 3000, s: 1500 }, consumables: { a: 2000, s: 1000 } };

    var total = 0;
    (departments || ['Science']).forEach(function(dept) {
      var d = tacByDept[dept] || defaultTac;
      breakdown.technology.allocated += d.technology.a;
      breakdown.technology.spent += d.technology.s;
      breakdown.activities.allocated += d.activities.a;
      breakdown.activities.spent += d.activities.s;
      breakdown.consumables.allocated += d.consumables.a;
      breakdown.consumables.spent += d.consumables.s;
      total += d.technology.a + d.activities.a + d.consumables.a;
    });

    breakdown.technology.available = breakdown.technology.allocated - breakdown.technology.spent;
    breakdown.activities.available = breakdown.activities.allocated - breakdown.activities.spent;
    breakdown.consumables.available = breakdown.consumables.allocated - breakdown.consumables.spent;

    return {
      total: total,
      byCategory: breakdown
    };
  }

  getMockDepartmentSpending(departments) {
    // Deterministic monthly spending with seasonal pattern
    return {
      monthly: [
        { month: 'Jul', budget: 20833, actual: 12500 },
        { month: 'Aug', budget: 20833, actual: 32800 },
        { month: 'Sep', budget: 20833, actual: 28500 },
        { month: 'Oct', budget: 20833, actual: 22100 },
        { month: 'Nov', budget: 20833, actual: 18900 },
        { month: 'Dec', budget: 20833, actual: 11200 },
        { month: 'Jan', budget: 20833, actual: 24600 },
        { month: 'Feb', budget: 20833, actual: 21400 }
      ],
      byVendor: [
        { vendor: 'Amazon',              amount: 42500, percentage: 30.2 },
        { vendor: 'Carolina Biological', amount: 28000, percentage: 19.9 },
        { vendor: 'Pearson',             amount: 22000, percentage: 15.6 },
        { vendor: 'County Warehouse',    amount: 18500, percentage: 13.1 },
        { vendor: 'CDW',                 amount: 15000, percentage: 10.6 },
        { vendor: 'Other',               amount: 14900, percentage: 10.6 }
      ]
    };
  }

  getMockDepartmentComparison(department) {
    var comparisons = {
      'Science': {
        currentYear:  { allocated: 310000, spent: 263500, utilization: 85 },
        previousYear: { allocated: 295000, spent: 278300, utilization: 94.3 },
        variance:     { budget: 15000, spending: -14800, efficiency: 'improved' }
      },
      'Math': {
        currentYear:  { allocated: 280000, spent: 173600, utilization: 62 },
        previousYear: { allocated: 265000, spent: 251750, utilization: 95.0 },
        variance:     { budget: 15000, spending: -78150, efficiency: 'improved' }
      },
      'English': {
        currentYear:  { allocated: 240000, spent: 115200, utilization: 48 },
        previousYear: { allocated: 230000, spent: 218500, utilization: 95.0 },
        variance:     { budget: 10000, spending: -103300, efficiency: 'improved' }
      }
    };

    var defaultComparison = {
      currentYear:  { allocated: 200000, spent: 104000, utilization: 52 },
      previousYear: { allocated: 190000, spent: 180500, utilization: 95.0 },
      variance:     { budget: 10000, spending: -76500, efficiency: 'improved' }
    };

    return comparisons[department] || defaultComparison;
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
          byDivision: [
            { division: 'US', name: 'Upper School',    students: 382, totalFees: 471250, allocated: 447688, spent: 236000, available: 211688 },
            { division: 'LS', name: 'Lower School',    students: 346, totalFees: 225000, allocated: 213750, spent: 112500, available: 101250 },
            { division: 'KK', name: 'Keswick Kids',    students: 206, totalFees: 128750, allocated: 122312, spent: 64300,  available: 58012 }
          ],
          byCategory: {
            technology: { percentage: 55, amount: 430000 },
            activities: { percentage: 25, amount: 196000 },
            consumables: { percentage: 20, amount: 157750 }
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
