// ============================================================================
// KESWICK BUDGET DASHBOARD - API HANDLERS (COMPLETE VERSION)
// ============================================================================
// Web app API endpoints for dashboard frontend communication
// Handles doGet/doPost requests with proper error handling and routing
// ============================================================================

// ============================================================================
// WEB APP ENTRY POINTS
// ============================================================================

/**
 * Handle GET requests - Serve the dashboard HTML interface
 * This is the main entry point when users access the web app URL
 */
function doGet(e) {
  try {
    console.log('doGet called with parameters:', e.parameter);
    
    const action = e.parameter.action;
    
    // Route API calls vs page serving
    if (action) {
      return handleAPIRequest('GET', action, e.parameter);
    }
    
    // Serve dashboard HTML page
    try {
      const htmlTemplate = HtmlService.createTemplateFromFile('Dashboard_UI');
      
      // Add any server-side data to template if needed
      htmlTemplate.serverData = {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        userEmail: Session.getActiveUser().getEmail() || 'Not available'
      };
      
      const htmlOutput = htmlTemplate.evaluate()
        .setTitle('Keswick Budget Dashboard')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
        .addMetaTag('viewport', 'width=device-width, initial-scale=1')
        .setSandboxMode(HtmlService.SandboxMode.IFRAME);
      
      console.log('HTML output created successfully');
      return htmlOutput;
      
    } catch (templateError) {
      console.error('Template error:', templateError);
      
      // Return a basic error page if template fails
      return HtmlService.createHtmlOutput(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Dashboard Error</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; text-align: center; }
            .error { color: #d32f2f; margin: 20px 0; }
            .info { color: #666; margin: 10px 0; }
            pre { text-align: left; background: #f5f5f5; padding: 20px; border-radius: 5px; }
          </style>
        </head>
        <body>
          <h1>Dashboard Loading Error</h1>
          <div class="error">Failed to load dashboard template</div>
          <div class="info">Error: ${templateError.message}</div>
          <div class="info">Please check that DashboardUI.html exists in your project</div>
          <hr>
          <h3>Debug Information:</h3>
          <pre>${JSON.stringify({
            error: templateError.message,
            stack: templateError.stack,
            user: Session.getActiveUser().getEmail(),
            timestamp: new Date().toISOString()
          }, null, 2)}</pre>
        </body>
        </html>
      `).setTitle('Dashboard Error');
    }
    
  } catch (error) {
    console.error('doGet error:', error);
    
    // Return error HTML
    return HtmlService.createHtmlOutput(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Dashboard Error</title>
      </head>
      <body>
        <h1>Error Loading Dashboard</h1>
        <p>Error: ${error.message}</p>
        <p>Please contact support.</p>
      </body>
      </html>
    `).setTitle('Dashboard Error');
  }
}

/**
 * Handle POST requests - API endpoints for dashboard data
 */
function doPost(e) {
  try {
    let requestData;
    
    // Parse request data
    try {
      requestData = JSON.parse(e.postData.contents);
    } catch (parseError) {
      return createErrorResponse('Invalid request format', 'Request must be valid JSON');
    }
    
    const action = requestData.action || e.parameter.action;
    
    if (!action) {
      return createErrorResponse('Missing action parameter', 'Action is required for API calls');
    }
    
    return handleAPIRequest('POST', action, requestData);
    
  } catch (error) {
    console.error('doPost error:', error);
    return createErrorResponse('API request failed', error.message);
  }
}

// ============================================================================
// MAIN CLIENT-CALLABLE FUNCTION - MOST IMPORTANT!
// ============================================================================

/**
 * Main function called by the dashboard frontend
 * This is the primary entry point for google.script.run calls
 * CRITICAL: This function must ALWAYS return data, never throw errors
 *
 * Checks CONFIG.DEMO_MODE to determine whether to return live or demo data
 */
function getDashboardData() {
  // Check DEMO_MODE flag from CONFIG (Dashboard_BE.gs)
  // When DEMO_MODE is false, use live data from spreadsheets
  if (CONFIG.DEMO_MODE === false) {
    console.log('📊 Dashboard loading LIVE data (DEMO_MODE=false)');
    return getDashboardData_LiveMode();
  }

  // DEMO VERSION - Returns demo data when DEMO_MODE is true
  console.log('📊 Dashboard loading DEMO data (DEMO_MODE=true)');

  try {
    var email = '';
    try { email = Session.getActiveUser().getEmail() || ''; } catch(e) {}
    if (!email) { try { email = Session.getEffectiveUser().getEmail() || ''; } catch(e) {} }

    var response = {
      success: true,
      user: {
        email: email || 'demo@keswickchristian.org',
        firstName: email ? email.split('@')[0] : 'Demo',
        lastName: 'User',
        role: 'executive',
        divisions: ['US', 'LS', 'KK', 'AD'],
        departments: ['ALL']
      },
      data: generateCompleteFallbackData('executive'),
      isDemo: true,
      timestamp: new Date().toISOString()
    };

    // Force JSON serialization to catch any issues
    var serialized = JSON.stringify(response);
    return JSON.parse(serialized);

  } catch (e) {
    // Ultimate fallback
    return {
      success: true,
      user: { email: 'demo@keswickchristian.org', firstName: 'Demo', lastName: 'User', role: 'executive' },
      data: generateCompleteFallbackData('executive'),
      isDemo: true,
      error: e.message
    };
  }
}

// ============================================================================
// TAC GRADE-LEVEL TRACKING API FUNCTIONS
// ============================================================================

/**
 * Get TAC data by grade level for the TAC Tracker
 * Returns enrollment, fees, spending, and variance for each grade
 */
function getTACByGradeData() {
  try {
    const service = new KeswickDashboardService();
    const tacByGrade = service.getTACByGrade({});
    const stepUp = service.getStepUpPaymentStatus();
    const enrollment = service.getEnrollmentData();

    return {
      success: true,
      grades: tacByGrade.grades,
      totals: tacByGrade.totals,
      enrollment: enrollment,
      stepUp: stepUp,
      lastUpdated: tacByGrade.lastUpdated
    };
  } catch (error) {
    console.error('getTACByGradeData error:', error);
    // Return mock data on error
    return getMockTACByGradeData();
  }
}

/**
 * Save enrollment data to Script Properties
 * Called when user saves enrollment numbers in the TAC Tracker
 */
function saveEnrollmentData(enrollmentByGrade) {
  try {
    const service = new KeswickDashboardService();
    const result = service.saveEnrollmentData(enrollmentByGrade);
    return result;
  } catch (error) {
    console.error('saveEnrollmentData error:', error);
    return { success: false, message: 'Failed to save enrollment: ' + error.message };
  }
}

/**
 * Get enhanced analytics data
 * Returns department variance, approval metrics, cost per student, Step Up status
 */
function getEnhancedAnalytics() {
  try {
    const service = new KeswickDashboardService();
    return {
      success: true,
      departmentVariance: service.getSpendingVarianceByDepartment(),
      approvalMetrics: service.getApprovalTurnaroundMetrics(),
      costPerStudent: service.getCostPerStudentMetrics(),
      stepUp: service.getStepUpPaymentStatus()
    };
  } catch (error) {
    console.error('getEnhancedAnalytics error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get specific report data
 * Supports: admin, curriculum, fieldtrip, supply report types
 */
function getReportData(reportType, filters) {
  try {
    const service = new KeswickDashboardService();
    let reportData;

    switch (reportType) {
      case 'admin':
        reportData = service.getAdminExpensesReport(filters || {});
        break;
      case 'curriculum':
        reportData = service.getCurriculumReport(filters || {});
        break;
      case 'fieldtrip':
        reportData = service.getFieldTripReport(filters || {});
        break;
      case 'supply':
        reportData = service.getSupplyReport(filters || {}, filters?.aggregateLevel || 'teacher');
        break;
      default:
        return { success: false, error: 'Unknown report type: ' + reportType };
    }

    return { success: true, data: reportData };
  } catch (error) {
    console.error('getReportData error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Mock TAC data for demo/fallback
 */
function getMockTACByGradeData() {
  const grades = ['Infants', 'PK2', 'PK3', 'PK4', 'K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
  const divisions = { 'Infants': 'KK', 'PK2': 'KK', 'PK3': 'KK', 'PK4': 'KK', 'K': 'LS', '1': 'LS', '2': 'LS', '3': 'LS', '4': 'LS', '5': 'LS', '6': 'MS', '7': 'MS', '8': 'MS', '9': 'US', '10': 'US', '11': 'US', '12': 'US' };
  const fees = { 'Infants': 850, 'PK2': 850, 'PK3': 850, 'PK4': 850, 'K': 950, '1': 1000, '2': 1000, '3': 1050, '4': 1050, '5': 1100, '6': 1150, '7': 1200, '8': 1200, '9': 1250, '10': 1250, '11': 1300, '12': 1300 };

  const gradeData = grades.map(grade => {
    const enrollment = Math.floor(Math.random() * 40) + 30;
    const tacFee = fees[grade];
    const tacBudgeted = enrollment * tacFee;
    const tacSpent = Math.floor(tacBudgeted * (0.3 + Math.random() * 0.4));
    const variance = tacBudgeted - tacSpent;
    const variancePercent = Math.round((variance / tacBudgeted) * 100);

    return {
      grade: grade,
      division: divisions[grade],
      enrollment: enrollment,
      tacFee: tacFee,
      tacBudgeted: tacBudgeted,
      tacSpent: tacSpent,
      variance: variance,
      variancePercent: variancePercent,
      curricular: Math.floor(tacSpent * 0.4),
      fieldTrip: Math.floor(tacSpent * 0.3),
      techCost: Math.floor(tacSpent * 0.3),
      status: variancePercent < -10 ? 'over_budget' : variancePercent < 0 ? 'warning' : 'on_track'
    };
  });

  const totals = gradeData.reduce((acc, g) => ({
    enrollment: acc.enrollment + g.enrollment,
    tacBudgeted: acc.tacBudgeted + g.tacBudgeted,
    tacSpent: acc.tacSpent + g.tacSpent,
    variance: acc.variance + g.variance,
    curricular: acc.curricular + g.curricular,
    fieldTrip: acc.fieldTrip + g.fieldTrip,
    techCost: acc.techCost + g.techCost
  }), { enrollment: 0, tacBudgeted: 0, tacSpent: 0, variance: 0, curricular: 0, fieldTrip: 0, techCost: 0 });

  const enrollment = {};
  gradeData.forEach(g => enrollment[g.grade] = g.enrollment);

  return {
    success: true,
    grades: gradeData,
    totals: totals,
    enrollment: enrollment,
    stepUp: {
      quarterlyExpected: 1500000,
      currentQuarter: 2,
      quarters: {
        q1: { expected: 1500000, received: 1500000 },
        q2: { expected: 1500000, received: 1425000 },
        q3: { expected: 1500000, received: 0 },
        q4: { expected: 1500000, received: 0 }
      }
    },
    lastUpdated: new Date().toISOString()
  };
}

// Keep the old complex version commented out for when live data is needed
function getDashboardData_LiveMode() {
  const startTime = Date.now();

  try {
    // Step 1: Initialize service with fallback
    let service;
    try {
      service = new KeswickDashboardService();
      console.log('✓ Service initialized');
    } catch (serviceError) {
      console.error('✗ Service initialization failed:', serviceError.message);
      
      // Return demo data if service fails completely
      return {
        success: true,
        user: {
          email: Session.getActiveUser().getEmail() || 'demo@keswickchristian.org',
          firstName: 'Demo',
          lastName: 'User',
          role: 'executive'
        },
        data: generateCompleteFallbackData(),
        warning: 'Service initialization failed. Showing demo data.',
        loadTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    }
    
    // Step 2: Authenticate user with fallback
    let user;
    try {
      user = service.authenticateUser();
      console.log('✓ User authenticated:', user?.email);
    } catch (authError) {
      console.error('✗ Authentication error:', authError.message);
      
      // Create fallback user
      const email = Session.getActiveUser().getEmail() || 'demo@keswickchristian.org';
      user = {
        email: email,
        firstName: email.split('@')[0],
        lastName: 'User',
        role: 'executive',
        divisions: ['US', 'LS', 'KK', 'AD'],
        departments: ['ALL']
      };
      console.log('✓ Using fallback user:', user.email);
    }
    
    // Step 3: Ensure we have a valid user
    if (!user) {
      console.warn('⚠ No user object, creating default');
      user = {
        email: 'demo@keswickchristian.org',
        firstName: 'Demo',
        lastName: 'User',
        role: 'executive',
        divisions: ['US', 'LS', 'KK', 'AD'],
        departments: ['ALL']
      };
    }

    // Step 3b: Check for ACCESS_DENIED - return error for unauthorized users
    if (user.error === 'ACCESS_DENIED' || user.authenticated === false) {
      console.warn('⚠ User access denied:', user.email);
      return {
        success: false,
        error: 'ACCESS_DENIED',
        message: 'You do not have permission to access this dashboard. Please contact your administrator.',
        user: { email: user.email },
        timestamp: new Date().toISOString()
      };
    }

    // Step 4: Get dashboard data based on role with fallback
    let dashboardData;
    let dataError = null;
    
    try {
      console.log(`Fetching ${user.role} dashboard...`);
      
      switch (user.role) {
        case 'executive':
          dashboardData = service.getExecutiveDashboard({});
          break;
        case 'principal':
          dashboardData = service.getPrincipalDashboard({});
          break;
        case 'department_head':
          dashboardData = service.getDepartmentDashboard({});
          break;
        default:
          console.warn(`Unknown role ${user.role}, defaulting to executive`);
          dashboardData = service.getExecutiveDashboard({});
      }
      
      console.log('✓ Dashboard data retrieved');
      
    } catch (dataFetchError) {
      console.error('✗ Error fetching dashboard data:', dataFetchError.message);
      dataError = dataFetchError.message;
      
      // Generate complete fallback data
      dashboardData = generateCompleteFallbackData(user.role);
      console.log('✓ Using fallback dashboard data');
    }
    
    // Step 5: Validate and ensure data completeness
    if (!dashboardData || !dashboardData.kpis) {
      console.warn('⚠ Invalid or incomplete dashboard data, using fallback');
      dashboardData = generateCompleteFallbackData(user.role);
    }
    
    const endTime = Date.now();
    const loadTime = endTime - startTime;
    
    console.log('=====================================');
    console.log(`✓ getDashboardData completed in ${loadTime}ms`);
    console.log('=====================================');
    
    // Return successful response with any warnings
    const response = {
      success: true,
      user: user,
      data: dashboardData,
      loadTime: loadTime,
      timestamp: new Date().toISOString()
    };
    
    // Add warning if we had to use fallback data
    if (dataError) {
      response.warning = `Some data could not be loaded: ${dataError}. Showing cached/demo data.`;
    }

    // CRITICAL: Ensure response is JSON-serializable for google.script.run
    // This prevents silent failures when returning complex objects
    try {
      const serializedResponse = JSON.parse(JSON.stringify(response));
      console.log('Response serialized successfully, keys:', Object.keys(serializedResponse));
      return serializedResponse;
    } catch (serializeError) {
      console.error('Response serialization failed:', serializeError);
      // Return a minimal working response
      return {
        success: true,
        user: { email: response.user?.email || 'unknown', firstName: 'User', lastName: '', role: 'executive' },
        data: generateCompleteFallbackData(),
        warning: 'Data serialization issue - showing demo data',
        loadTime: response.loadTime,
        timestamp: response.timestamp
      };
    }
    
  } catch (criticalError) {
    // This should rarely happen, but ensure we ALWAYS return something
    console.error('CRITICAL ERROR in getDashboardData:', criticalError);
    
    const fallbackResponse = {
      success: true, // Still return success to show dashboard
      user: {
        email: 'error@keswickchristian.org',
        firstName: 'Error',
        lastName: 'User',
        role: 'executive'
      },
      data: generateCompleteFallbackData(),
      warning: `Critical error occurred: ${criticalError.message}. Showing demo data.`,
      loadTime: Date.now() - startTime,
      timestamp: new Date().toISOString()
    };
    
    return fallbackResponse;
  }
}

/**
 * Generate complete fallback dashboard data
 * This ensures the dashboard ALWAYS has data to display
 */
function generateCompleteFallbackData(role = 'executive') {
  const baseData = {
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
    transactions: generateDemoTransactions(20),
    alerts: [
      {
        id: 1,
        type: 'info',
        category: 'system',
        message: 'Dashboard loaded with demo data',
        timestamp: new Date(),
        division: 'ALL',
        department: 'System'
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
    trends: {
      monthly: generateMonthlyTrend(),
      categorical: generateCategoricalSpending()
    }
  };
  
  // Adjust based on role
  if (role === 'principal') {
    baseData.kpis = [
      { id: 'division_budget', label: 'Division Budget', value: 1800000, format: 'currency' },
      { id: 'division_spent', label: 'Spent to Date', value: 756000, format: 'currency' },
      { id: 'division_utilization', label: 'Utilization Rate', value: 42, format: 'percentage' },
      { id: 'pending_requests', label: 'Pending Requests', value: 8, format: 'number' }
    ];
    baseData.departments = [
      { department: 'Math', allocated: 250000, spent: 105000, available: 145000, utilization: 42 },
      { department: 'Science', allocated: 300000, spent: 126000, available: 174000, utilization: 42 },
      { department: 'English', allocated: 200000, spent: 84000, available: 116000, utilization: 42 },
      { department: 'History', allocated: 180000, spent: 75600, available: 104400, utilization: 42 }
    ];
  } else if (role === 'department_head') {
    baseData.kpis = [
      { id: 'dept_budget', label: 'Department Budget', value: 250000, format: 'currency' },
      { id: 'dept_spent', label: 'Spent to Date', value: 105000, format: 'currency' },
      { id: 'dept_available', label: 'Available Budget', value: 145000, format: 'currency' },
      { id: 'dept_utilization', label: 'Utilization Rate', value: 42, format: 'percentage' }
    ];
    baseData.budget = {
      department: 'Science',
      fiscalYear: '2024-25',
      allocated: 250000,
      spent: 105000,
      encumbered: 20000,
      available: 125000
    };
  }
  
  return baseData;
}

/**
 * Generate demo transactions
 */
function generateDemoTransactions(count) {
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

/**
 * Generate monthly trend data
 */
function generateMonthlyTrend() {
  const months = ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'];
  return months.map((month, i) => ({
    month: month,
    budget: 416667,
    actual: 350000 + Math.random() * 100000,
    forecast: 400000 + Math.random() * 50000
  }));
}

/**
 * Generate categorical spending data
 */
function generateCategoricalSpending() {
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

// ============================================================================
// DEMO MODE API
// ============================================================================

/**
 * Get current demo mode status
 * Called by frontend to show demo/live indicator
 */
function getDemoMode() {
  try {
    // Import CONFIG from Dashboard_BE.gs
    return {
      success: true,
      demoMode: CONFIG.DEMO_MODE,
      message: CONFIG.DEMO_MODE ? 'Dashboard is showing DEMO data' : 'Dashboard is showing LIVE data',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('getDemoMode error:', error);
    return {
      success: false,
      demoMode: true, // Default to demo on error
      error: error.message
    };
  }
}

/**
 * Toggle demo mode (executive users only)
 * NOTE: This changes the CONFIG value but requires redeployment to persist
 * For dynamic toggling, consider using PropertiesService
 */
function setDemoMode(enabled) {
  try {
    // Verify user has executive role
    const email = Session.getActiveUser().getEmail();
    const userAccess = CONFIG.USER_ACCESS[email] || CONFIG.USER_ACCESS['DEFAULT'];

    if (userAccess.role !== 'executive') {
      return {
        success: false,
        error: 'Unauthorized: Only executives can toggle demo mode',
        demoMode: CONFIG.DEMO_MODE
      };
    }

    // Use PropertiesService for dynamic toggle (persists without redeployment)
    const props = PropertiesService.getScriptProperties();
    props.setProperty('DEMO_MODE', String(enabled));

    // Also update CONFIG for current session
    CONFIG.DEMO_MODE = enabled;

    console.log(`Demo mode ${enabled ? 'ENABLED' : 'DISABLED'} by ${email}`);

    return {
      success: true,
      demoMode: enabled,
      message: enabled ? 'Switched to DEMO mode' : 'Switched to LIVE mode',
      changedBy: email,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('setDemoMode error:', error);
    return {
      success: false,
      error: error.message,
      demoMode: CONFIG.DEMO_MODE
    };
  }
}

/**
 * Initialize demo mode from stored property (called on service init)
 */
function initDemoModeFromProperty() {
  try {
    const props = PropertiesService.getScriptProperties();
    const storedMode = props.getProperty('DEMO_MODE');
    if (storedMode !== null) {
      CONFIG.DEMO_MODE = storedMode === 'true';
    }
  } catch (error) {
    console.error('initDemoModeFromProperty error:', error);
  }
}

// ============================================================================
// ROLE SWITCHER API (Demo Mode Only)
// ============================================================================

/**
 * Get available divisions for role switcher dropdown
 * @return {object} Response with divisions array
 */
function getAvailableDivisions() {
  try {
    const divisions = Object.entries(CONFIG.DIVISIONS).map(([code, info]) => ({
      code: code,
      name: info.name,
      grades: info.grades
    }));

    return {
      success: true,
      divisions: divisions
    };
  } catch (error) {
    console.error('getAvailableDivisions error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get departments for a specific division
 * @param {string} divisionCode - Division code (US, LS, KK, AD)
 * @return {object} Response with departments array
 */
function getDepartmentsByDivision(divisionCode) {
  try {
    // Map division code to department list
    const divisionDepartments = {
      'US': ['Math', 'Science', 'English', 'History', 'Foreign Language', 'Fine Arts', 'Athletics'],
      'LS': ['Elementary', 'Art', 'Music', 'PE', 'Library'],
      'KK': ['Keswick Kids', 'Early Childhood'],
      'AD': ['Administration', 'Finance', 'HR', 'Facilities', 'IT']
    };

    const depts = divisionDepartments[divisionCode] || [];
    const departments = depts.map(d => ({
      code: d,
      name: d
    }));

    return {
      success: true,
      division: divisionCode,
      departments: departments
    };
  } catch (error) {
    console.error('getDepartmentsByDivision error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get dashboard data for a simulated role (demo mode only)
 * Allows viewing dashboard as different roles during demos
 * @param {string} simulatedRole - Role to simulate (executive, principal, department_head)
 * @param {string} division - Division code for principal/dept_head view
 * @param {string} department - Department name for dept_head view
 * @return {object} Dashboard data for the simulated role
 */
function getDashboardDataAsRole(simulatedRole, division, department) {
  const startTime = Date.now();

  try {
    // Role switcher is always available for demo purposes
    // (We're serving demo data by default now)

    // Get actual user email for logging
    var email = '';
    try { email = Session.getActiveUser().getEmail() || ''; } catch(e) {}
    if (!email) { try { email = Session.getEffectiveUser().getEmail() || ''; } catch(e) {} }
    console.log(`Role simulation requested: ${simulatedRole} (division: ${division}, dept: ${department}) by ${email}`);

    // Build simulated user context
    const divisionName = CONFIG.DIVISIONS[division]?.name || division;
    const simulatedUser = {
      email: email,
      firstName: 'Demo',
      lastName: simulatedRole === 'executive' ? 'Executive' :
                simulatedRole === 'principal' ? `Principal (${divisionName})` :
                `Dept Head (${department || 'N/A'})`,
      role: simulatedRole,
      divisions: division ? [division] : ['US', 'LS', 'KK', 'AD'],
      departments: department ? [department] : ['ALL'],
      isSimulated: true
    };

    // Generate dashboard data for the simulated role
    let dashboardData = generateCompleteFallbackData(simulatedRole);

    // Customize data based on selected division/department
    if (simulatedRole === 'principal' && division) {
      // Filter to show only selected division
      dashboardData.divisionSummary = dashboardData.divisionSummary.filter(
        d => d.division === division
      );
      // Update KPIs to reflect division
      dashboardData.kpis = [
        { id: 'division_budget', label: `${divisionName} Budget`, value: 1800000, format: 'currency' },
        { id: 'division_spent', label: 'Spent to Date', value: 756000, format: 'currency' },
        { id: 'division_utilization', label: 'Utilization Rate', value: 42, format: 'percentage' },
        { id: 'pending_requests', label: 'Pending Requests', value: 8, format: 'number' }
      ];
    } else if (simulatedRole === 'department_head' && department) {
      // Update KPIs to reflect department
      dashboardData.kpis = [
        { id: 'dept_budget', label: `${department} Budget`, value: 250000, format: 'currency' },
        { id: 'dept_spent', label: 'Spent to Date', value: 105000, format: 'currency' },
        { id: 'dept_available', label: 'Available Budget', value: 145000, format: 'currency' },
        { id: 'dept_utilization', label: 'Utilization Rate', value: 42, format: 'percentage' }
      ];
      dashboardData.budget = {
        department: department,
        division: division,
        fiscalYear: '2024-25',
        allocated: 250000,
        spent: 105000,
        encumbered: 20000,
        available: 125000
      };
    }

    var response = {
      success: true,
      user: simulatedUser,
      data: dashboardData,
      isSimulated: true,
      simulatedRole: simulatedRole,
      simulatedDivision: division,
      simulatedDepartment: department,
      loadTime: Date.now() - startTime,
      timestamp: new Date().toISOString()
    };

    // Force JSON serialization to ensure clean return
    return JSON.parse(JSON.stringify(response));

  } catch (error) {
    console.error('getDashboardDataAsRole error:', error);
    return {
      success: false,
      error: error.message || 'Unknown error'
    };
  }
}

// ============================================================================
// API REQUEST ROUTER
// ============================================================================

/**
 * Route API requests to appropriate handlers
 */
function handleAPIRequest(method, action, data) {
  try {
    console.log(`API Request: ${method} ${action}`);
    
    // For now, just return success
    return createSuccessResponse({
      message: `API endpoint ${action} not implemented yet`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`API handler error for ${action}:`, error);
    return createErrorResponse('Internal server error', error.message);
  }
}

// ============================================================================
// RESPONSE HELPERS
// ============================================================================

/**
 * Create a standardized success response
 */
function createSuccessResponse(data) {
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    ...data
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Create a standardized error response
 */
function createErrorResponse(error, details = null) {
  console.error(`API Error: ${error}`, details);
  
  return ContentService.createTextOutput(JSON.stringify({
    success: false,
    error: error,
    details: details,
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Include HTML files (for HtmlService)
 * This function is required for including external HTML files
 */
function include(filename) {
  try {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
  } catch (error) {
    console.error(`Failed to include file: ${filename}`, error);
    // Return empty string to prevent template errors
    return '';
  }
}

/**
 * Get web app URL (for testing)
 */
function getWebAppUrl() {
  try {
    return ScriptApp.getService().getUrl();
  } catch (error) {
    return 'Not deployed';
  }
}

/**
 * Get school logo as base64
 * Called by frontend to display logo in header
 */
function getSchoolLogo() {
  try {
    if (!CONFIG.SCHOOL_LOGO_FILE_ID) {
      return { success: false, error: 'No logo file ID configured' };
    }

    const file = DriveApp.getFileById(CONFIG.SCHOOL_LOGO_FILE_ID);
    const blob = file.getBlob();
    const base64 = Utilities.base64Encode(blob.getBytes());
    const mimeType = blob.getContentType();

    return {
      success: true,
      logo: `data:${mimeType};base64,${base64}`,
      fileName: file.getName()
    };
  } catch (error) {
    console.error('Failed to load school logo:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get brand asset (school-name.png or crest.png) from _scratch folder
 * Called by frontend to display institutional header assets
 * @param {string} filename - Asset filename (school-name.png or crest.png)
 * @return {object} Response with base64 encoded image data
 */
function getBrandAsset(filename) {
  try {
    console.log('getBrandAsset called with filename:', filename);

    // Validate filename
    const validAssets = ['school-name.png', 'crest.png'];
    if (!validAssets.includes(filename)) {
      return { success: false, error: 'Invalid asset name. Must be school-name.png or crest.png' };
    }

    // Method 1: Check if there's a configured file ID for this asset
    if (CONFIG.BRAND_ASSETS && CONFIG.BRAND_ASSETS[filename]) {
      try {
        const fileId = CONFIG.BRAND_ASSETS[filename];
        const file = DriveApp.getFileById(fileId);
        const blob = file.getBlob();
        const base64 = Utilities.base64Encode(blob.getBytes());
        console.log('Loaded asset from configured file ID:', filename);
        return {
          success: true,
          data: base64,
          fileName: filename,
          mimeType: blob.getContentType()
        };
      } catch (idError) {
        console.warn('Failed to load from configured ID:', idError.message);
      }
    }

    // Method 2: For crest, try the signatures folder (same as invoicing)
    if (filename === 'crest.png') {
      try {
        const folderName = CONFIG.SIGNATURES_FOLDER || 'Budget_System_Signatures';
        const folders = DriveApp.getFoldersByName(folderName);
        if (folders.hasNext()) {
          const folder = folders.next();
          // Try seal.jpg first (used in invoicing), then crest.png
          for (const sealName of ['seal.jpg', 'seal.png', 'crest.jpg', 'crest.png']) {
            const files = folder.getFilesByName(sealName);
            if (files.hasNext()) {
              const file = files.next();
              const blob = file.getBlob();
              const base64 = Utilities.base64Encode(blob.getBytes());
              console.log('Loaded crest/seal from signatures folder:', sealName);
              return {
                success: true,
                data: base64,
                fileName: sealName,
                mimeType: blob.getContentType()
              };
            }
          }
        }
      } catch (sigError) {
        console.warn('Failed to load from signatures folder:', sigError.message);
      }
    }

    // Method 3: Try _scratch folder as fallback
    const scratchFolders = DriveApp.getFoldersByName('_scratch');
    if (scratchFolders.hasNext()) {
      const folder = scratchFolders.next();
      const files = folder.getFilesByName(filename);
      if (files.hasNext()) {
        const file = files.next();
        const blob = file.getBlob();
        const base64 = Utilities.base64Encode(blob.getBytes());
        console.log('Loaded from _scratch folder:', filename);
        return {
          success: true,
          data: base64,
          fileName: filename,
          mimeType: blob.getContentType()
        };
      }
    }

    // Method 4: Return failure - UI will handle with text fallback
    console.warn('Brand asset not found, UI will use text fallback:', filename);
    return { success: false, error: 'Asset not found - using text fallback' };

  } catch (error) {
    console.error('getBrandAsset error:', error.message);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// TESTING FUNCTIONS
// ============================================================================

/**
 * Test the getDashboardData function directly
 */
function testGetDashboardData() {
  console.log('Testing getDashboardData...');
  const result = getDashboardData();
  console.log('Result:', JSON.stringify(result, null, 2));
  return result;
}

/**
 * Test doGet function
 */
function testDoGet() {
  console.log('Testing doGet...');
  const mockRequest = { parameter: {} };
  const result = doGet(mockRequest);
  console.log('Content type:', result.getMimeType ? result.getMimeType() : 'Not set');
  console.log('Title:', result.getTitle ? result.getTitle() : 'Not set');
  console.log('Has content:', result.getContent ? 'Yes' : 'No');
  return result;
}