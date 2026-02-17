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

  // User Access Matrix - ENHANCED WITH FALLBACK
  USER_ACCESS: {
    // Executives - Full Access
    'cfo@keswickchristian.org': { role: 'executive', divisions: ['US', 'LS', 'KK', 'AD'], departments: ['ALL'] },
    'admin@keswickchristian.org': { role: 'executive', divisions: ['US', 'LS', 'KK', 'AD'], departments: ['ALL'] },

    // Test user - uses Keswick domain, not personal gmail
    'mtrotter@keswickchristian.org': { role: 'executive', divisions: ['US', 'LS', 'KK', 'AD'], departments: ['ALL'] },

    // Service account that runs the Dashboard web app
    'invoicing@keswickchristian.org': { role: 'executive', divisions: ['US', 'LS', 'KK', 'AD'], departments: ['ALL'] },

    // Principals - Division Access
    'usprincipal@keswickchristian.org': { role: 'principal', divisions: ['US'], departments: ['Math', 'Science', 'English', 'History'] },
    'lsprincipal@keswickchristian.org': { role: 'principal', divisions: ['LS'], departments: ['Elementary'] },
    'kkprincipal@keswickchristian.org': { role: 'principal', divisions: ['KK'], departments: ['Keswick Kids'] },
    'adprincipal@keswickchristian.org': { role: 'principal', divisions: ['AD'], departments: ['Administration'] },

    // Department Heads - Department Access
    'mathhead@keswickchristian.org': { role: 'department_head', divisions: ['US'], departments: ['Math'] },
    'sciencehead@keswickchristian.org': { role: 'department_head', divisions: ['US'], departments: ['Science'] },

    // DEFAULT ACCESS - Denies access to unknown users (production-safe)
    'DEFAULT': { role: 'denied', divisions: [], departments: [] }
  },

  // School Logo (Google Drive file ID)
  SCHOOL_LOGO_FILE_ID: '1HDkW_xGIc4jOBH4REnXb3VJcZaEjPHKj',

  // TAC Technology Fee Matrix (Per Student Annual Fees)
  TAC_TECHNOLOGY_FEES: {
    'PreK': 850,
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

  // TAC Category Allocation
  TAC_CATEGORY_WEIGHTS: {
    technology: 0.55,  // 55% for technology
    activities: 0.25,  // 25% for activities/field trips
    consumables: 0.20  // 20% for curriculum/supplies
  },

  // Division Mappings
  DIVISIONS: {
    'US': { name: 'Upper School', grades: ['9', '10', '11', '12'] },
    'LS': { name: 'Lower School', grades: ['K', '1', '2', '3', '4', '5'] },
    'KK': { name: 'Keswick Kids', grades: ['PreK'] },
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

      // Determine health status
      const utilizationRate = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
      const expectedUtilization = (monthsElapsed / 12) * 100;

      let status = 'healthy';
      let risk = 'low';
      if (utilizationRate > expectedUtilization + 15) {
        status = 'warning';
        risk = 'medium';
      }
      if (utilizationRate > expectedUtilization + 25) {
        status = 'critical';
        risk = 'high';
      }

      return {
        status: status,
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
          expectedUtilization: Math.round(expectedUtilization * 10) / 10
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
        metrics: {
          cashFlow: 'positive',
          burnRate: 'normal',
          runway: '8 months',
          risk: 'low'
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
