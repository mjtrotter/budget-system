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
 */
function getDashboardData() {
  const startTime = Date.now();
  
  console.log('=====================================');
  console.log('getDashboardData called');
  console.log('Time:', new Date().toISOString());
  console.log('=====================================');
  
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

    // Try to find _scratch folder in Drive
    const scratchFolders = DriveApp.getFoldersByName('_scratch');
    if (!scratchFolders.hasNext()) {
      console.error('_scratch folder not found in Drive');
      return { success: false, error: '_scratch folder not found in Google Drive' };
    }

    const folder = scratchFolders.next();
    console.log('Found _scratch folder:', folder.getName());

    // Find the asset file
    const files = folder.getFilesByName(filename);
    if (!files.hasNext()) {
      console.error('Asset file not found:', filename);
      return { success: false, error: 'Asset file not found: ' + filename };
    }

    const file = files.next();
    console.log('Found asset file:', file.getName());

    // Encode file as base64
    const blob = file.getBlob();
    const base64 = Utilities.base64Encode(blob.getBytes());

    return {
      success: true,
      data: base64,
      fileName: filename,
      mimeType: blob.getContentType()
    };
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