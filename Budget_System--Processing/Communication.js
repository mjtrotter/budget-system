// ============================================================================
// COMMUNICATIONS MODULE - Communications.gs
// ============================================================================
// Centralized email and notification handling for Keswick Budget System
// ============================================================================

// ============================================================================
// ENHANCED APPROVAL EMAIL WITH PROFESSIONAL UI
// ============================================================================

/**
 * Sends enhanced approval email with budget visualization
 * Uses Web App URLs for one-click approval/rejection workflow
 */
function sendEnhancedApprovalEmail(approverEmail, requestData) {
  // Web App-based approval workflow - clicking buttons registers decision automatically
  try {
    const approveUrl = generateApprovalUrl(requestData.transactionId, approverEmail, 'approve');
    const rejectUrl = generateApprovalUrl(requestData.transactionId, approverEmail, 'reject');

    // UAT HINT LOGIC
    let actionHint = '';
    const desc = (requestData.description || '').toUpperCase();
    if (desc.includes('PLEASE APPROVE')) actionHint = '[ACTION: APPROVE] ';
    if (desc.includes('PLEASE REJECT') || desc.includes('PLEASE DENY')) actionHint = '[ACTION: REJECT] ';

    const subject = `${actionHint}Approval Required: ${requestData.type} - $${requestData.amount.toFixed(2)} - ${requestData.transactionId}`;

    // Get full user budget info for detailed display
    const userBudget = getUserBudgetInfo(requestData.requestor);
    const budgetRemaining = userBudget.allocated - userBudget.spent - userBudget.encumbered;
    const budgetAfterRequest = budgetRemaining - requestData.amount;
    const isOverBudget = budgetAfterRequest < 0;

    // Ensure minimum visibility for budget bar - convert decimal to percentage
    const utilizationPercent = (userBudget.utilizationRate * 100) || 0;
    const utilizationWidth = Math.max(utilizationPercent, 3); // Minimum 3% width for visibility
    const requestWidth = Math.max((requestData.amount / userBudget.allocated) * 100, 1); // Minimum 1% width

    // Determine budget status styling - using school colors (green/gold)
    const budgetStatus = {
      class: isOverBudget ? 'danger' : (utilizationPercent > 80 ? 'warning' : 'success'),
      color: isOverBudget ? '#d32f2f' : (utilizationPercent > 80 ? '#f57c00' : '#2e7d32'),
      message: isOverBudget ? 'OVER BUDGET' : (utilizationPercent > 80 ? 'HIGH UTILIZATION' : 'WITHIN BUDGET')
    };

    let htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background: #f5f5f5; line-height: 1.4; }
    .wrapper { max-width: 700px; margin: 0 auto; background: white; }

    /* Header with school colors - green gradient */
    .header {
      background: #2e7d32;
      background: -webkit-linear-gradient(135deg, #2e7d32 0%, #4caf50 100%);
      background: linear-gradient(135deg, #2e7d32 0%, #4caf50 100%);
      color: #ffffff;
      padding: 40px 30px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .header:before {
      content: '';
      position: absolute;
      top: -50%;
      right: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
      animation: pulse 4s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { transform: scale(0.8); opacity: 0.5; }
      50% { transform: scale(1.2); opacity: 0.8; }
    }
    .header h1 {
      margin: 0;
      font-size: 32px;
      font-weight: 300;
      position: relative;
      z-index: 1;
      text-shadow: 0 2px 4px rgba(0,0,0,0.3);
      color: #ffffff !important;
    }
    .header .transaction-id {
      margin-top: 10px;
      font-size: 16px;
      opacity: 0.95;
      position: relative;
      z-index: 1;
      letter-spacing: 1px;
      color: #ffffff !important;
      text-shadow: 0 1px 2px rgba(0,0,0,0.2);
    }

    /* Content */
    .content { padding: 15px 30px 40px 30px; }

    /* PDF Section - NEW */
    .pdf-section {
      background: linear-gradient(135deg, #fff8e1 0%, #fffbf0 100%);
      border: 2px solid #ffc107;
      border-radius: 12px;
      padding: 25px;
      margin-bottom: 30px;
      text-align: center;
      box-shadow: 0 4px 12px rgba(255, 193, 7, 0.2);
    }
    .pdf-section h3 { color: #f57c00; margin-bottom: 10px; font-size: 18px; font-weight: 600; }
    .pdf-section p { color: #8d6e00; margin-bottom: 15px; font-size: 14px; }
    .pdf-button {
      background: linear-gradient(135deg, #ffc107 0%, #ff9800 100%);
      color: #000;
      padding: 15px 30px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: bold;
      font-size: 16px;
      display: inline-block;
      box-shadow: 0 4px 12px rgba(255, 193, 7, 0.3);
      transition: all 0.3s ease;
    }
    .pdf-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(255, 193, 7, 0.4);
    }

    /* Budget Visual Bar with school colors */
    .budget-visual {
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
      border-radius: 12px;
      padding: 25px;
      margin: 0 0 30px 0;
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      border: 2px solid #e8f5e9;
    }
    .budget-visual h3 {
      margin: 0 0 5px 0;
      color: #2e7d32;
      font-size: 18px;
      font-weight: 600;
    }
    .budget-visual p {
      margin: 0 0 20px 0;
      color: #666;
      font-size: 14px;
      font-weight: 500;
    }
    .budget-bar-container {
      background: #e8e8e8;
      height: 50px;
      border-radius: 25px;
      position: relative;
      overflow: hidden;
      margin: 20px 0;
      box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
      border: 1px solid #ddd;
    }
    .budget-bar-spent {
      background: #4caf50;
      background: -webkit-linear-gradient(90deg, #4caf50 0%, #2e7d32 100%);
      background: linear-gradient(90deg, #4caf50 0%, #2e7d32 100%);
      height: 100%;
      position: absolute;
      left: 0;
      top: 0;
      transition: width 0.5s ease;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      min-width: 12px;
      border-radius: 25px 0 0 25px;
    }
    .budget-bar-request {
      background: #ffc107;
      background: repeating-linear-gradient(
        45deg,
        #ffc107,
        #ffc107 8px,
        #ffeb3b 8px,
        #ffeb3b 16px
      );
      height: 100%;
      position: absolute;
      top: 0;
      opacity: 0.9;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      min-width: 6px;
    }
    .budget-labels {
      display: flex;
      justify-content: space-between;
      margin-top: 15px;
      font-size: 14px;
      font-weight: 600;
    }
    .budget-amount { font-weight: 700; color: #333; font-size: 16px; }

    /* Info Cards */
    .info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      margin: 30px 0;
    }
    .info-card {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 12px;
      border: 1px solid #e9ecef;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .info-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    }
    .info-card.full-width { grid-column: 1 / -1; }
    .info-card h3 {
      margin: 0 0 8px 0;
      color: #666;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 500;
    }
    .info-card .value {
      font-size: 24px;
      font-weight: 600;
      color: #333;
      line-height: 1.2;
    }
    .info-card .dual-value {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .info-card .dual-value .left,
    .info-card .dual-value .right { flex: 1; }
    .info-card .dual-value .separator {
      width: 1px;
      height: 40px;
      background: #ddd;
      margin: 0 20px;
    }
    .info-card.danger {
      background: #ffebee;
      border-color: #ffcdd2;
      border-left: 4px solid #d32f2f;
    }
    .info-card.warning {
      background: #fff8e1;
      border-color: #ffe0b2;
      border-left: 4px solid #f57c00;
    }
    .info-card.success {
      background: #e8f5e9;
      border-color: #c8e6c9;
      border-left: 4px solid #2e7d32;
    }

    /* Requestor layout with badge parallel to name */
    .requestor-name-line {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 4px;
    }
    .teacher-name {
      font-size: 18px;
      font-weight: 600;
      color: #333;
      line-height: 1.2;
    }
    .dept-badge {
      background: #e8f5e9;
      color: #2e7d32;
      padding: 6px 12px;
      border-radius: 15px;
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
      border: 1px solid #c8e6c9;
    }

    /* Budget status with percentage to the right */
    .budget-status-layout {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .budget-status-text { flex: 1; }
    .budget-percentage {
      font-size: 16px;
      font-weight: 600;
      color: #666;
      white-space: nowrap;
      margin-left: 15px;
    }

    /* Items Table - Responsive Design */
    .items-section {
      margin: 40px 0;
      background: #fafafa;
      border-radius: 12px;
      padding: 25px;
      overflow: hidden;
    }
    .items-section h3 {
      margin: 0 0 20px 0;
      color: #333;
      font-size: 18px;
    }
    .items-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      background: white;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      border-radius: 8px;
      overflow: hidden;
      max-width: 100%;
    }
    .items-table th {
      background: #f5f5f5;
      padding: 12px 8px;
      text-align: left;
      font-weight: 600;
      color: #666;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 2px solid #e0e0e0;
      white-space: nowrap;
    }
    .items-table td {
      padding: 12px 8px;
      border-bottom: 1px solid #f0f0f0;
      font-size: 14px;
    }
    .items-table tr:last-child td { border-bottom: none; }
    .items-table tr:hover { background: #f8f9fa; }
    .items-table .qty {
      text-align: center;
      font-weight: 600;
      color: #2e7d32;
      font-size: 14px;
      white-space: nowrap;
    }
    .items-table .price {
      text-align: right;
      font-weight: 600;
      color: #2e7d32;
      font-size: 14px;
      white-space: nowrap;
    }
    .items-table .unit-price {
      text-align: right;
      color: #666;
      font-size: 14px;
      white-space: nowrap;
    }

    /* Mobile-first responsive items */
    @media (max-width: 600px) {
      .items-table { font-size: 12px; }
      .items-table th { padding: 8px 4px; font-size: 10px; }
      .items-table td { padding: 8px 4px; font-size: 12px; }
      .items-table .qty,
      .items-table .price,
      .items-table .unit-price { font-size: 12px; }
      /* Hide unit price column on very small screens */
      .items-table th:nth-child(3),
      .items-table td:nth-child(3) { display: none; }
    }

    @media (max-width: 480px) {
      .content { padding: 10px 15px 40px 15px; }
      .budget-visual { padding: 20px; }
      .items-section { padding: 15px; }
      .action-section { margin: 40px -15px -40px; }
    }

    /* Action Buttons with school colors */
    .action-section {
      background: #f5f5f5;
      margin: 40px -30px -40px;
      padding: 40px 30px;
      text-align: center;
      border-top: 2px solid #e0e0e0;
    }
    .action-section h3 {
      margin: 0 0 25px 0;
      color: #333;
      font-size: 20px;
    }
    .button-group {
      display: flex;
      gap: 20px;
      justify-content: center;
      flex-wrap: wrap;
    }
    .btn {
      display: inline-block;
      padding: 18px 50px;
      text-decoration: none;
      font-weight: 700;
      font-size: 16px;
      border-radius: 8px;
      text-transform: uppercase;
      letter-spacing: 1px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      border: none;
      min-width: 180px;
    }
    .btn-approve {
      background: #4caf50;
      color: #ffffff;
    }
    .btn-approve:hover {
      background: #45a049;
      box-shadow: 0 6px 16px rgba(76,175,80,0.3);
    }
    .btn-reject {
      background: #d32f2f;
      color: #ffffff;
    }
    .btn-reject:hover {
      background: #c62828;
      box-shadow: 0 6px 16px rgba(211,47,47,0.3);
    }

    /* Footer */
    .footer {
      background: #f5f5f5;
      padding: 25px;
      text-align: center;
      color: #666;
      font-size: 13px;
      border-top: 1px solid #e0e0e0;
    }
    .footer-warning {
      color: #d32f2f;
      font-weight: 500;
      margin-bottom: 10px;
    }

    /* Responsive adjustments */
    @media (max-width: 600px) {
      .info-grid { grid-template-columns: 1fr; }
      .button-group { flex-direction: column; }
      .btn { width: 100%; }
      .dual-value { flex-direction: column !important; }
      .dual-value .separator { display: none; }
      .requestor-name-line { flex-direction: column; align-items: flex-start; }
      .dept-badge { margin-top: 8px; }
      .budget-status-layout { flex-direction: column; align-items: flex-start; }
      .budget-percentage { margin-left: 0; margin-top: 5px; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>Budget Approval Request</h1>
      <div class="transaction-id">${requestData.transactionId}</div>
    </div>

    <div class="content">`;

    // Add PDF section if PDF link exists - NEW FUNCTIONALITY
    if (requestData.pdfLink) {
      htmlBody += `
      <!-- PDF Documentation Section -->
      <div class="pdf-section">
        <h3>📄 Supporting Documentation</h3>
        <p>Please review the attached document before making your approval decision.</p>
        <a href="${requestData.pdfLink}" class="pdf-button" target="_blank">View Document</a>
      </div>`;
    }

    htmlBody += `
      <!-- Budget Visualization -->
      <div class="budget-visual">
        <h3>Budget Overview for ${userBudget.firstName} ${userBudget.lastName}</h3>
        <p>${userBudget.department} Department</p>
        <div class="budget-bar-container">
          <div class="budget-bar-spent" style="width: ${utilizationWidth}%"></div>
          <div class="budget-bar-request" style="left: ${utilizationWidth}%; width: ${requestWidth}%"></div>
        </div>
        <div class="budget-labels">
          <span class="budget-amount">$0</span>
          <span class="budget-amount">$${userBudget.allocated.toFixed(2)}</span>
        </div>
      </div>

      <!-- Request Information Grid -->
      <div class="info-grid">
        <div class="info-card">
          <h3>Request Type</h3>
          <div class="value">${requestData.type}</div>
        </div>
        <div class="info-card">
          <h3>Total Amount</h3>
          <div class="value">$${requestData.amount.toFixed(2)}</div>
        </div>
        <div class="info-card">
          <h3>Requestor</h3>
          <div class="requestor-name-line">
            <span class="teacher-name">${userBudget.firstName} ${userBudget.lastName}</span>
            <span class="dept-badge">${userBudget.department}</span>
          </div>
        </div>
        <div class="info-card ${budgetStatus.class}">
          <h3>Budget Status</h3>
          <div class="budget-status-layout">
            <div class="budget-status-text">
              <div class="value">${budgetStatus.message}</div>
            </div>
            <div class="budget-percentage">${utilizationPercent.toFixed(1)}%</div>
          </div>
        </div>
        <div class="info-card">
          <h3>Budget Details</h3>
          <div class="dual-value">
            <div class="left">
              <div style="font-size: 14px; color: #666; margin-bottom: 5px;">Available</div>
              <div style="font-size: 18px; font-weight: 600; color: ${budgetRemaining >= 0 ? '#2e7d32' : '#d32f2f'};">
                $${budgetRemaining.toFixed(2)}
              </div>
            </div>
            <div class="separator"></div>
            <div class="right">
              <div style="font-size: 14px; color: #666; margin-bottom: 5px;">After Request</div>
              <div style="font-size: 18px; font-weight: 600; color: ${budgetAfterRequest >= 0 ? '#2e7d32' : '#d32f2f'};">
                $${budgetAfterRequest.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
        <div class="info-card full-width">
          <h3>Description</h3>
          <div class="value" style="font-size: 16px; font-weight: 500; color: #555;">
            ${requestData.description}
          </div>
        </div>
      </div>`;

    // Add Items Table if items exist - FIXED UNIT PRICE LOGIC
    if (requestData.items && requestData.items.length > 0) {
      htmlBody += `
      <!-- Items Table - FIXED UNIT PRICE LOGIC -->
      <div class="items-section">
        <h3>📦 Items Requested</h3>
        <table class="items-table">
          <thead>
            <tr>
              <th>Description</th>
              <th class="qty">Qty</th>
              <th class="unit-price">Unit Price</th>
              <th class="price">Total</th>
            </tr>
          </thead>
          <tbody>`;

      // DEBUG: Log incoming item data for troubleshooting template failures
      console.log(`[EMAIL_DEBUG] Transaction: ${requestData.transactionId}, Items: ${requestData.items?.length || 0}`);
      if (requestData.items) {
        requestData.items.forEach((item, idx) => {
          console.log(`[EMAIL_DEBUG] Item ${idx}: qty=${item.quantity}, unit=${item.unitPrice}, total=${item.totalPrice}`);
        });
      }

      let grandTotal = 0;

      // FIXED: Defensive price calculation to prevent division by zero and NaN propagation
      requestData.items.forEach(item => {
        // Ensure quantity is at least 1 to prevent division by zero
        const quantity = Math.max(parseInt(item.quantity) || 1, 1);

        // Calculate prices with defensive fallbacks
        let unitPrice = parseFloat(item.unitPrice);
        let totalPrice = parseFloat(item.totalPrice);

        // Handle missing unitPrice - calculate from totalPrice/quantity
        if (isNaN(unitPrice) || unitPrice <= 0) {
          unitPrice = (totalPrice > 0 && quantity > 0) ? totalPrice / quantity : 0;
        }

        // Handle missing totalPrice - calculate from unitPrice*quantity
        if (isNaN(totalPrice) || totalPrice <= 0) {
          totalPrice = unitPrice * quantity;
        }

        // Final NaN guard
        if (isNaN(unitPrice)) unitPrice = 0;
        if (isNaN(totalPrice)) totalPrice = 0;

        grandTotal += totalPrice;

        htmlBody += `
            <tr>
              <td>
                <div class="item-description">${item.description || 'Item'}</div>
              </td>
              <td class="qty">${quantity}</td>
              <td class="unit-price">$${unitPrice.toFixed(2)}</td>
              <td class="price"><strong>$${totalPrice.toFixed(2)}</strong></td>
            </tr>`;
      });

      htmlBody += `
          </tbody>
        </table>
        <div style="text-align: right; margin-top: 15px; font-weight: bold; font-size: 16px;">
          TOTAL: $${grandTotal.toFixed(2)}
        </div>
      </div>`;
    }

    htmlBody += `
      <!-- Action Buttons -->
      <div class="action-section">
        <h3>Your Decision</h3>
        <div class="button-group">
          <a href="${approveUrl}" class="btn btn-approve">✅ APPROVE REQUEST</a>
          <a href="${rejectUrl}" class="btn btn-reject">❌ REJECT REQUEST</a>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      ${isOverBudget ? '<div class="footer-warning">⚠️ WARNING: This request exceeds the available budget</div>' : ''}
      <p>Please review this request promptly. If you have questions, contact the Business Office.</p>
      <p>Keswick Christian School Budget Management System</p>
    </div>
  </div>
</body>
</html>`;

    // Log the URL in TEST_MODE for verification visibility
    if (isTestMode()) {
      console.log(`🧪 [TEST MODE] Approval URL: ${approveUrl}`);
      console.log(`🧪 [TEST MODE] Reject URL: ${rejectUrl}`);
    }

    // Send the email via Utility
    const recipient = getEmailRecipient(approverEmail);
    sendSystemEmail({
      to: recipient,
      subject: subject,
      htmlBody: htmlBody
    });

    console.log(`Enhanced approval email sent to ${approverEmail} for ${requestData.transactionId}`);

  } catch (error) {
    console.error('Error sending enhanced approval email:', error);
    // Fallback to simple email if HTML fails
    const fallbackSubject = `Approval Required: ${requestData.transactionId}`;
    const fallbackBody = `
      Request: ${requestData.type}
      Amount: $${requestData.amount.toFixed(2)}
      Requestor: ${requestData.requestor}
      Description: ${requestData.description}

      Approve: ${generateApprovalUrl(requestData.transactionId, approverEmail, 'approve')}
      Reject: ${generateApprovalUrl(requestData.transactionId, approverEmail, 'reject')}
    `;

    sendSystemEmail({
      to: getEmailRecipient(approverEmail),
      subject: fallbackSubject,
      body: fallbackBody
    });
  }
}



// ============================================================================
// APPROVAL NOTIFICATION TO REQUESTOR
// ============================================================================
function sendApprovalNotification(requestorEmail, transactionData) {
  try {
    const userBudget = getUserBudgetInfo(requestorEmail);

    // Calculate updated budget figures
    const newSpent = userBudget.spent + transactionData.amount;
    const newEncumbered = Math.max(0, userBudget.encumbered - transactionData.amount);
    const newAvailable = userBudget.allocated - newSpent - newEncumbered;
    const newUtilization = userBudget.allocated > 0 ? (newSpent / userBudget.allocated * 100) : 0;

    const subject = `✅ Purchase Order Approved - ${transactionData.transactionId}`;

    const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #333;
          background-color: #f5f5f5;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background: white;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
          background: linear-gradient(135deg, #2e7d32, #4caf50);
          color: white;
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 600;
        }
        .header .icon {
          font-size: 48px;
          margin-bottom: 10px;
        }
        .content {
          padding: 40px 30px;
        }
        .approval-box {
          background: #e8f5e9;
          border-left: 4px solid #4caf50;
          padding: 20px;
          margin: 20px 0;
          border-radius: 5px;
        }
        .approval-box h2 {
          color: #2e7d32;
          margin: 0 0 10px 0;
          font-size: 20px;
        }
        .info-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
          margin: 30px 0;
        }
        .info-card {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          text-align: center;
          border: 1px solid #e9ecef;
        }
        .info-label {
          color: #6c757d;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 5px;
        }
        .info-value {
          font-size: 24px;
          font-weight: 600;
          color: #495057;
        }
        .info-value.green {
          color: #2e7d32;
        }
        .info-value.blue {
          color: #1976d2;
        }
        .details-section {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
        }
        .details-title {
          font-weight: 600;
          color: #495057;
          margin-bottom: 10px;
          font-size: 18px;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #e9ecef;
        }
        .detail-row:last-child {
          border-bottom: none;
        }
        .detail-label {
          color: #6c757d;
        }
        .detail-value {
          color: #495057;
          font-weight: 500;
        }
        .next-steps {
          background: #e3f2fd;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .next-steps h3 {
          color: #1565c0;
          margin: 0 0 10px 0;
          font-size: 18px;
        }
        .next-steps ul {
          margin: 10px 0;
          padding-left: 20px;
        }
        .next-steps li {
          margin: 8px 0;
          color: #424242;
        }
        .footer {
          background: #f8f9fa;
          padding: 20px;
          text-align: center;
          color: #6c757d;
          font-size: 14px;
        }
        .warning {
          color: #d32f2f;
          font-weight: 600;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="icon">✅</div>
          <h1>Purchase Order Approved</h1>
        </div>

        <div class="content">
          <div class="approval-box">
            <h2>Your order has been approved!</h2>
            <p>The Business Office is now processing your purchase order. No further action is required from you at this time.</p>
          </div>

          <div class="details-section">
            <div class="details-title">Order Details</div>
            <div class="detail-row">
              <span class="detail-label">Transaction ID:</span>
              <span class="detail-value">${transactionData.transactionId}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Order Type:</span>
              <span class="detail-value">${transactionData.type}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Amount:</span>
              <span class="detail-value">$${transactionData.amount.toFixed(2)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Approved By:</span>
              <span class="detail-value">${formatApproverName(transactionData.approver)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Approved On:</span>
              <span class="detail-value">${new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}</span>
            </div>
          </div>

          <div class="info-grid">
            <div class="info-card">
              <div class="info-label">Remaining Budget</div>
              <div class="info-value green">$${newAvailable.toFixed(2)}</div>
            </div>
            <div class="info-card">
              <div class="info-label">Budget Utilization</div>
              <div class="info-value blue">${newUtilization.toFixed(1)}%</div>
            </div>
          </div>

          <div class="next-steps">
            <h3>What Happens Next?</h3>
            <ul>
              <li>The Business Office will generate an official purchase order</li>
              <li>Your order will be submitted to the vendor</li>
              <li>You'll receive delivery confirmation when items arrive</li>
              <li>No further action is needed from you</li>
            </ul>
          </div>

          <div class="details-section">
            <div class="details-title">Your Current Budget Status</div>
            <div class="detail-row">
              <span class="detail-label">Total Allocated:</span>
              <span class="detail-value">$${userBudget.allocated.toFixed(2)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Total Spent (including this order):</span>
              <span class="detail-value">$${newSpent.toFixed(2)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Pending Orders:</span>
              <span class="detail-value">$${newEncumbered.toFixed(2)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Available to Spend:</span>
              <span class="detail-value green">$${newAvailable.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div class="footer">
          <p>Keswick Christian School • Budget Management System</p>
          <p>Questions? Contact the Business Office</p>
          ${isTestMode() ? '<p class="warning">🧪 TEST MODE - This is a test notification</p>' : ''}
        </div>
      </div>
    </body>
    </html>
  `;

    const recipient = getEmailRecipient(requestorEmail);

    sendSystemEmail({
      to: recipient,
      subject: isTestMode() ? `[TEST] ${subject}` : subject,
      htmlBody: htmlBody
    });

    console.log(`✉️ Approval notification sent to ${recipient}`);

  } catch (error) {
    console.error('Error sending approval notification:', error);
  }
}

/**
 * Sends approval confirmation email - CORRECTED VERSION
 */
function sendApprovalConfirmation(email, transactionId, amount, description) {
  const userBudget = getUserBudgetInfo(email);
  const budgetRemaining = userBudget.allocated - userBudget.spent - userBudget.encumbered;
  const budgetAfterRequest = budgetRemaining + amount; // Add back since it was encumbered

  let budgetInfo = '';
  // Only show budget info for non-admin requests
  if (!transactionId.startsWith('ADMIN')) {
    // Use the pre-calculated utilization rate from UserDirectory (stored as decimal, convert to percentage)
    const utilizationPercent = (userBudget.utilizationRate * 100) || 0;
    budgetInfo = `
      <div style="background: #e8f5e9; padding: 15px; border-radius: 6px; margin-top: 20px;">
        <h4 style="margin: 0 0 10px 0; color: #2e7d32;">Your Budget Status</h4>
        <p style="margin: 5px 0;"><strong>Remaining Budget:</strong> $${budgetAfterRequest.toFixed(2)}</p>
        <p style="margin: 5px 0;"><strong>Budget Utilization:</strong> ${utilizationPercent.toFixed(1)}%</p>
      </div>
    `;
  }

  sendSystemEmail({
    to: email,
    subject: `✅ Budget Request Approved: ${transactionId}`,
    htmlBody: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #4caf50; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">Request Approved</h2>
        </div>
        <div style="background: white; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 8px 8px;">
          <h3>Your budget request has been approved!</h3>
          <div style="background: #f5f5f5; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Transaction ID:</strong> ${transactionId}</p>
            <p style="margin: 5px 0;"><strong>Amount:</strong> $${amount.toFixed(2)}</p>
            <p style="margin: 5px 0;"><strong>Description:</strong> ${description}</p>
          </div>
          <p style="color: #666; line-height: 1.6;">
            The Business Office will handle this purchase on your behalf.
            Items will be received to the divisional offices upon receipt.
          </p>
          ${budgetInfo}
          <p style="margin-top: 20px; font-size: 14px; color: #999;">
            If you have questions about this purchase, please contact the Business Office.
          </p>
        </div>
      </div>
    `
  });
}

// ============================================================================
// REJECTION NOTIFICATION TO REQUESTOR
// ============================================================================

function sendRejectionNotification(requestorEmail, transactionData) {
  try {
    const subject = `❌ Purchase Order Rejected - ${transactionData.transactionId}`;

    const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #333;
          background-color: #f5f5f5;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background: white;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
          background: linear-gradient(135deg, #d32f2f, #f44336);
          color: white;
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 600;
        }
        .header .icon {
          font-size: 48px;
          margin-bottom: 10px;
        }
        .content {
          padding: 40px 30px;
        }
        .rejection-box {
          background: #ffebee;
          border-left: 4px solid #f44336;
          padding: 20px;
          margin: 20px 0;
          border-radius: 5px;
        }
        .rejection-box h2 {
          color: #c62828;
          margin: 0 0 10px 0;
          font-size: 20px;
        }
        .details-section {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
        }
        .details-title {
          font-weight: 600;
          color: #495057;
          margin-bottom: 10px;
          font-size: 18px;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #e9ecef;
        }
        .detail-row:last-child {
          border-bottom: none;
        }
        .detail-label {
          color: #6c757d;
        }
        .detail-value {
          color: #495057;
          font-weight: 500;
        }
        .contact-box {
          background: #fff3cd;
          border: 1px solid #ffeaa7;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .contact-box h3 {
          color: #856404;
          margin: 0 0 10px 0;
          font-size: 18px;
        }
        .contact-info {
          background: #e3f2fd;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
          text-align: center;
        }
        .contact-info .approver-name {
          font-size: 20px;
          font-weight: 600;
          color: #1565c0;
          margin-bottom: 5px;
        }
        .contact-info .approver-email {
          color: #424242;
          font-size: 16px;
        }
        .next-steps {
          background: #f5f5f5;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .next-steps h3 {
          color: #424242;
          margin: 0 0 10px 0;
          font-size: 18px;
        }
        .next-steps ul {
          margin: 10px 0;
          padding-left: 20px;
        }
        .next-steps li {
          margin: 8px 0;
          color: #616161;
        }
        .footer {
          background: #f8f9fa;
          padding: 20px;
          text-align: center;
          color: #6c757d;
          font-size: 14px;
        }
        .warning {
          color: #d32f2f;
          font-weight: 600;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="icon">❌</div>
          <h1>Purchase Order Rejected</h1>
        </div>

        <div class="content">
          <div class="rejection-box">
            <h2>Your purchase order was not approved</h2>
            <p>Please review the details below and contact the approver listed for more information.</p>
          </div>

          <div class="details-section">
            <div class="details-title">Order Details</div>
            <div class="detail-row">
              <span class="detail-label">Transaction ID:</span>
              <span class="detail-value">${transactionData.transactionId}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Order Type:</span>
              <span class="detail-value">${transactionData.type}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Amount:</span>
              <span class="detail-value">$${transactionData.amount.toFixed(2)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Rejected By:</span>
              <span class="detail-value">${formatApproverName(transactionData.approver)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Rejected On:</span>
              <span class="detail-value">${new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}</span>
            </div>
          </div>

          <div class="contact-box">
            <h3>⚠️ Important: Contact Your Approver</h3>
            <p>To understand why your order was rejected and discuss next steps, please reach out to:</p>
          </div>

          <div class="contact-info">
            <div class="approver-name">${formatApproverName(transactionData.approver)}</div>
            <div class="approver-email">${transactionData.approver}</div>
          </div>

          <div class="next-steps">
            <h3>What You Can Do Next:</h3>
            <ul>
              <li>Contact ${formatApproverName(transactionData.approver)} to discuss the rejection reason</li>
              <li>Review your request for any issues or missing information</li>
              <li>Consider alternative options or vendors if applicable</li>
              <li>Submit a revised request after addressing any concerns</li>
            </ul>
          </div>

          <div class="details-section">
            <div class="details-title">Common Rejection Reasons</div>
            <ul style="margin: 10px 0; padding-left: 20px; color: #616161;">
              <li>Insufficient budget remaining</li>
              <li>Missing or incomplete documentation</li>
              <li>Item not aligned with educational objectives</li>
              <li>Alternative vendor or option preferred</li>
              <li>Timing considerations</li>
            </ul>
          </div>
        </div>

        <div class="footer">
          <p>Keswick Christian School • Budget Management System</p>
          <p>Questions? Contact your approver or the Business Office</p>
          ${isTestMode() ? '<p class="warning">🧪 TEST MODE - This is a test notification</p>' : ''}
        </div>
      </div>
    </body>
    </html>
  `;

    const recipient = getEmailRecipient(requestorEmail);

    sendSystemEmail({
      to: recipient,
      subject: isTestMode() ? `[TEST] ${subject}` : subject,
      htmlBody: htmlBody
    });

    console.log(`✉️ Rejection notification sent to ${recipient}`);

  } catch (error) {
    console.error('Error sending rejection notification:', error);
  }
}

function sendBusinessOfficeNotification(details) {
  const recipient = isTestMode() ? CONFIG.TEST_EMAIL : CONFIG.BUSINESS_OFFICE_EMAIL;

  sendSystemEmail({
    to: recipient,
    subject: `Budget System: ${details.type}`,
    htmlBody: `
      <h3>${details.type}</h3>
      <p><strong>Transaction ID:</strong> ${details.transactionId}</p>
      <p><strong>Requestor:</strong> ${details.requestor}</p>
      <p><strong>Amount:</strong> $${details.amount.toFixed(2)}</p>
      <p><strong>Description:</strong> ${details.description}</p>
      ${details.justification ? `<p><strong>Justification:</strong> ${details.justification}</p>` : ''}
    `
  });
}

function sendErrorNotification(email, transactionId, formType, errorMessage) {
  try {
    const recipient = getEmailRecipient(email);
    const subject = `❌ Order Processing Error - ${transactionId || 'Request Failed'}`;

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #dc2626; color: white; padding: 25px; text-align: center; border-radius: 8px 8px 0 0;">
          <h2>Request Processing Error</h2>
        </div>

        <div style="background: white; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 8px 8px;">
          <div style="background: #fee2e2; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
            <p style="margin: 0; color: #dc2626;">
              <strong>Your ${formType.toLowerCase().replace('_', ' ')} request could not be processed:</strong>
            </p>
          </div>

          ${transactionId ? `<p><strong>Transaction ID:</strong> ${transactionId}</p>` : ''}
          <p><strong>Error:</strong> ${errorMessage}</p>

          <div style="background: #f5f5f5; padding: 20px; border-radius: 6px; margin-top: 20px;">
            <h4 style="margin-top: 0;">Next Steps:</h4>
            <ol style="margin: 10px 0; padding-left: 20px;">
              <li>Review the error message above</li>
              <li>Correct the issue in your request</li>
              <li>Resubmit your ${formType.toLowerCase().replace('_', ' ')} request</li>
            </ol>
          </div>

          <p style="margin-top: 20px; color: #666; font-size: 14px;">
            If you need assistance, please contact the Business Office at ${CONFIG.BUSINESS_OFFICE_EMAIL}
          </p>
        </div>
      </div>
    `;

    sendSystemEmail({
      to: recipient,
      subject: subject,
      htmlBody: htmlBody
    });

    logSystemEvent('ERROR_NOTIFICATION_SENT', email, 0, { transactionId, formType, errorMessage });

  } catch (error) {
    console.error('Error sending error notification:', error);
  }
}

/**
 * Sends validation error email to requestor
 */
function sendWarehouseValidationError(requestorEmail, errors) {
  const recipient = getEmailRecipient(requestorEmail);
  const subject = '❌ Warehouse Request Error - Invalid Item IDs';

  let htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px;">
      <div style="background: #f44336; color: white; padding: 25px; text-align: center; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">Warehouse Request Error</h2>
      </div>

      <div style="padding: 30px; background: white; border: 1px solid #ddd; border-radius: 0 0 8px 8px;">
        <p>Your warehouse request could not be processed because the following item IDs are not valid:</p>

        <div style="background: #ffebee; padding: 20px; border-radius: 6px; margin: 20px 0;">
          <h4 style="color: #c62828; margin-top: 0;">Invalid Items:</h4>
          <ul style="color: #666;">
  `;

  errors.forEach(error => {
    htmlBody += `<li><strong>Item ${error.position}:</strong> ID "${error.itemId}" - ${error.error}</li>`;
  });

  htmlBody += `
          </ul>
        </div>

        <p><strong>Next Steps:</strong></p>
        <ol>
          <li>Verify the item IDs against the warehouse catalog</li>
          <li>Correct any typos or invalid IDs</li>
          <li>Resubmit your request with valid item IDs</li>
        </ol>

        <p style="margin-top: 20px; color: #666;">
          If you need assistance finding the correct item IDs, please contact the warehouse team.
        </p>
      </div>
    </div>
  `;

  sendSystemEmail({
    to: recipient,
    subject: subject,
    htmlBody: htmlBody
  });

  logSystemEvent('WAREHOUSE_VALIDATION_ERROR', requestorEmail, 0, { errors });
}

/**
 * Sends validation error email to requestor
 */
function sendValidationErrorEmail(requestorEmail, transactionId, orderType, invalidItems) {
  const recipient = getEmailRecipient(requestorEmail);
  const subject = `❌ Order Validation Failed - ${transactionId}`;

  let itemDetails = '';

  if (orderType === 'AMAZON') {
    invalidItems.forEach(item => {
      itemDetails += `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #eee;">Item ${item.itemNumber}</td>
          <td style="padding: 12px; border-bottom: 1px solid #eee;">${item.description}</td>
          <td style="padding: 12px; border-bottom: 1px solid #eee; color: #d32f2f;">${item.issue}</td>
        </tr>
        <tr>
          <td colspan="3" style="padding: 0 12px 12px 12px; border-bottom: 1px solid #eee; color: #666;">
            URL: ${item.url}
          </td>
        </tr>
      `;
    });
  } else if (orderType === 'WAREHOUSE') {
    invalidItems.forEach(item => {
      itemDetails += `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #eee;">Item ${item.itemNumber}</td>
          <td style="padding: 12px; border-bottom: 1px solid #eee;">ID: ${item.itemId}</td>
          <td style="padding: 12px; border-bottom: 1px solid #eee; color: #d32f2f;">${item.issue}</td>
        </tr>
      `;
    });
  }

  const formUrls = {
    'AMAZON': `https://docs.google.com/forms/d/${CONFIG.FORMS.AMAZON}/viewform`,
    'WAREHOUSE': `https://docs.google.com/forms/d/${CONFIG.FORMS.WAREHOUSE}/viewform`
  };

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #d32f2f; color: white; padding: 25px; text-align: center; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">Order Validation Failed</h2>
      </div>

      <div style="background: white; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 8px 8px;">
        <div style="background: #ffebee; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
          <p style="margin: 0; color: #c62828;">
            <strong>Your ${orderType.toLowerCase()} order could not be processed due to validation errors.</strong>
          </p>
        </div>

        <p><strong>Transaction ID:</strong> ${transactionId}</p>

        <h3 style="color: #d32f2f; margin-top: 20px;">Invalid Items:</h3>
        <table style="width: 100%; border-collapse: collapse;">
          ${itemDetails}
        </table>

        <div style="background: #f5f5f5; padding: 20px; border-radius: 6px; margin-top: 20px;">
          <h4 style="margin-top: 0;">Next Steps:</h4>
          <ol style="margin: 10px 0; padding-left: 20px;">
            ${orderType === 'AMAZON' ? `
              <li>Ensure all URLs are from Amazon.com</li>
              <li>Verify URLs lead to valid product pages</li>
              <li>Use the "Share" button on Amazon to get correct URLs</li>
            ` : `
              <li>Verify item IDs against the warehouse catalog</li>
              <li>Check for typos in the item ID codes</li>
              <li>Contact warehouse for correct item codes if needed</li>
            `}
          </ol>

          <div style="text-align: center; margin-top: 20px;">
            <a href="${formUrls[orderType]}" style="display: inline-block; padding: 12px 30px; background: #2e7d32; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Resubmit Order
            </a>
          </div>
        </div>

        <p style="margin-top: 20px; color: #666; font-size: 14px;">
          If you need assistance, please contact the Business Office at mtrotter@keswickchristian.org
        </p>
      </div>
    </div>
  `;

  sendSystemEmail({
    to: recipient,
    subject: subject,
    htmlBody: htmlBody
  });

  console.log(`✉️ Validation error email sent to ${recipient} for ${transactionId}`);
}

// ============================================================================
// FUNCTIONS TO COPY FROM AmazonEngine.gs (NO CHANGES NEEDED)
// ============================================================================
/*
Copy the following functions from AmazonEngine.gs without modification:

1. sendPriceIncreaseNotification() - Lines 774-923
2. sendFinalCartEmail() - Lines 1147-1303
*/

// ============================================================================
// HELPER FUNCTIONS TO COPY FROM Main.gs (NO CHANGES NEEDED)
// ============================================================================


function formatApproverName(email) {
  if (!email || email === 'AUTO_APPROVED') return 'System (Auto-Approved)';
  if (email === 'AUTO_SYSTEM') return 'System (Auto-Approved)';

  // Try to format the email into a friendly name
  const namePart = email.split('@')[0];
  const parts = namePart.split('.');

  if (parts.length >= 2) {
    // Format as "John Smith"
    const firstName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    const lastName = parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
    return `${firstName} ${lastName}`;
  } else {
    // Just capitalize the single name
    return namePart.charAt(0).toUpperCase() + namePart.slice(1);
  }
}

function getEmailRecipient(email) {
  // In test mode, emails go to the actual recipient (submitter/approver)
  // This allows realistic testing while keeping TEST_MODE flag for other behaviors
  if (isTestMode()) {
    // Verify email is from the organization domain for safety
    const normalizedEmail = String(email || '').toLowerCase().trim();
    if (normalizedEmail.endsWith('@keswickchristian.org')) {
      console.log(`🧪 [TEST MODE] Sending to actual recipient: ${email}`);
      return email;  // Send to actual submitter/approver
    }

    // Only redirect non-organization emails to admin (safety measure)
    console.log(`🧪 [TEST MODE] Non-org email, redirecting to admin: ${email} -> ${CONFIG.ADMIN_EMAIL}`);
    return CONFIG.ADMIN_EMAIL;
  }
  return email;
}

function isTestMode() {
  // Use CONFIG.TEST_MODE directly for reliable test mode checking
  // This ensures all email routing goes to test recipient during testing
  return CONFIG.TEST_MODE === true;
}


// ============================================================================
// NEW FUNCTIONS REQUIRED
// ============================================================================

/**
 * Sends approval reminder emails for stale requests
 * Called by System Maintenance
 * @param {Object} staleItem - Contains queueId, requestor, type, amount, age
 */
function sendApprovalReminder(staleItem) {
  try {
    const userBudget = getUserBudgetInfo(staleItem.requestor);
    const approverEmail = userBudget ? userBudget.approver : CONFIG.TEST_EMAIL;
    const recipient = getEmailRecipient(approverEmail);

    // Check for escalation (>7 days)
    const shouldEscalate = staleItem.age >= 7;
    // Route through getEmailRecipient to respect test mode
    const escalationRecipient = shouldEscalate ? getEmailRecipient(CONFIG.ESCALATION_EMAIL) : null;

    const subject = shouldEscalate ?
      `⚠️ ESCALATED: Approval Required - ${staleItem.queueId} (${staleItem.age} days old)` :
      `⏰ REMINDER: Pending Approval - ${staleItem.queueId} (${staleItem.age} days old)`;

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <div style="background: ${shouldEscalate ? '#d32f2f' : '#FF8F00'}; color: white; padding: 20px; text-align: center;">
          <h2>${shouldEscalate ? '⚠️ ESCALATED Approval Request' : '⏰ Approval Reminder'}</h2>
        </div>
        <div style="padding: 20px; background: white;">
          <p>This approval request has been pending for <strong>${staleItem.age} days</strong>:</p>
          <ul>
            <li><strong>Request ID:</strong> ${staleItem.queueId}</li>
            <li><strong>Type:</strong> ${staleItem.type}</li>
            <li><strong>Amount:</strong> $${staleItem.amount.toFixed(2)}</li>
            <li><strong>Requestor:</strong> ${staleItem.requestor}</li>
          </ul>
          ${shouldEscalate ?
        '<p style="color: #d32f2f; font-weight: bold;">This request has been escalated due to extended delay.</p>' :
        '<p>Please review and approve/reject this request as soon as possible.</p>'
      }

          <div style="margin-top: 20px; text-align: center;">
            <a href="${generateApprovalUrl(staleItem.queueId, approverEmail, 'approve')}"
               style="display: inline-block; padding: 12px 30px; background: #4caf50; color: white; text-decoration: none; border-radius: 6px; margin-right: 10px;">
              ✓ APPROVE
            </a>
            <a href="${generateApprovalUrl(staleItem.queueId, approverEmail, 'reject')}"
               style="display: inline-block; padding: 12px 30px; background: #f44336; color: white; text-decoration: none; border-radius: 6px;">
              ✗ REJECT
            </a>
          </div>
        </div>
      </div>
    `;

    sendSystemEmail({
      to: recipient,
      subject: subject,
      htmlBody: htmlBody,
      cc: escalationRecipient
    });

    // Log escalation if applicable
    if (shouldEscalate) {
      logSystemEvent('APPROVAL_ESCALATED', staleItem.requestor, staleItem.amount, {
        queueId: staleItem.queueId,
        age: staleItem.age,
        escalatedTo: CONFIG.ESCALATION_EMAIL
      });
    }

  } catch (error) {
    console.error('Error sending reminder:', error);
  }
}

/**
 * Sends daily error digest to admin
 * Called by System Maintenance
 * @param {Array} errors - Array of error objects from the last 24 hours
 */
function sendDailyErrorDigest(errors) {
  if (!errors || errors.length === 0) return;

  try {
    const subject = `📊 Daily Error Report - ${new Date().toLocaleDateString()}`;

    // Group errors by type
    const errorGroups = {};
    errors.forEach(error => {
      const type = error.type || 'UNKNOWN';
      if (!errorGroups[type]) {
        errorGroups[type] = [];
      }
      errorGroups[type].push(error);
    });

    let htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 800px;">
        <div style="background: #1976d2; color: white; padding: 20px; text-align: center;">
          <h2>📊 Daily Error Digest</h2>
          <p>${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div style="padding: 20px; background: white;">
          <p><strong>Total Errors:</strong> ${errors.length}</p>

          <h3>Error Summary by Type:</h3>
    `;

    Object.entries(errorGroups).forEach(([type, typeErrors]) => {
      htmlBody += `
        <div style="margin: 20px 0; padding: 15px; background: #f5f5f5; border-left: 4px solid #d32f2f;">
          <h4 style="margin: 0 0 10px 0; color: #d32f2f;">${type} (${typeErrors.length})</h4>
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="background: #e0e0e0;">
              <th style="padding: 8px; text-align: left;">Time</th>
              <th style="padding: 8px; text-align: left;">User</th>
              <th style="padding: 8px; text-align: left;">Details</th>
            </tr>
      `;

      typeErrors.slice(0, 10).forEach(error => {
        htmlBody += `
          <tr style="border-bottom: 1px solid #ddd;">
            <td style="padding: 8px;">${new Date(error.timestamp).toLocaleTimeString()}</td>
            <td style="padding: 8px;">${error.user || 'N/A'}</td>
            <td style="padding: 8px;">${error.message || error.details || 'No details'}</td>
          </tr>
        `;
      });

      if (typeErrors.length > 10) {
        htmlBody += `
          <tr>
            <td colspan="3" style="padding: 8px; text-align: center; color: #666;">
              ... and ${typeErrors.length - 10} more
            </td>
          </tr>
        `;
      }

      htmlBody += `
          </table>
        </div>
      `;
    });

    htmlBody += `
          <div style="margin-top: 30px; padding: 15px; background: #e3f2fd; border-radius: 6px;">
            <h4 style="margin: 0 0 10px 0;">Recommended Actions:</h4>
            <ul style="margin: 5px 0;">
              <li>Review high-frequency errors for systemic issues</li>
              <li>Check user directory for any access issues</li>
              <li>Verify all form triggers are functioning</li>
              <li>Monitor system performance metrics</li>
            </ul>
          </div>
        </div>
      </div>
    `;

    sendSystemEmail({
      to: CONFIG.ADMIN_EMAIL || CONFIG.BUSINESS_OFFICE_EMAIL,
      subject: subject,
      htmlBody: htmlBody
    });

  } catch (error) {
    console.error('Error sending daily digest:', error);
  }
}

/**
 * Sends resubmission notification with prefilled form link
 * @param {string} requestorEmail - User email
 * @param {string} formType - Type of form (AMAZON, WAREHOUSE, etc.)
 * @param {Object} originalData - Original form data for prefilling
 * @param {string} errorReason - Reason for failure
 */
function sendResubmissionNotification(requestorEmail, formType, originalData, errorReason) {
  try {
    const formUrls = {
      'AMAZON': CONFIG.FORMS.AMAZON,
      'WAREHOUSE': CONFIG.FORMS.WAREHOUSE,
      'FIELD_TRIP': CONFIG.FORMS.FIELD_TRIP,
      'CURRICULUM': CONFIG.FORMS.CURRICULUM,
      'ADMIN': CONFIG.FORMS.ADMIN
    };

    const formId = formUrls[formType];
    if (!formId) return;

    const subject = `🔄 Resubmit Your ${formType.replace('_', ' ')} Request`;

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <div style="background: #ff9800; color: white; padding: 20px; text-align: center;">
          <h2>Resubmission Required</h2>
        </div>
        <div style="padding: 20px; background: white;">
          <p>Your ${formType.toLowerCase().replace('_', ' ')} request encountered an issue:</p>

          <div style="background: #ffebee; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #d32f2f;">
            <strong>Error:</strong> ${errorReason}
          </div>

          <p>We've saved your form data. Click below to resubmit with corrections:</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://docs.google.com/forms/d/${formId}/viewform"
               style="display: inline-block; padding: 15px 40px; background: #4caf50; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Resubmit Request
            </a>
          </div>

          ${originalData ? `
          <div style="background: #f5f5f5; padding: 15px; border-radius: 6px;">
            <h4 style="margin: 0 0 10px 0;">Your Original Request:</h4>
            <ul style="margin: 5px 0;">
              ${originalData.amount ? `<li>Amount: $${originalData.amount}</li>` : ''}
              ${originalData.description ? `<li>Description: ${originalData.description}</li>` : ''}
              ${originalData.items ? `<li>Items: ${originalData.items.length}</li>` : ''}
            </ul>
          </div>
          ` : ''}
        </div>
      </div>
    `;

    sendSystemEmail({
      to: getEmailRecipient(requestorEmail),
      subject: subject,
      htmlBody: htmlBody
    });

  } catch (error) {
    console.error('Error sending resubmission notification:', error);
  }
}

// ============================================================================
// FISCAL YEAR NOTIFICATIONS
// ============================================================================

/**
 * Sends fiscal year archive completion notification
 * @param {Object} archiveResults - Results from archive process
 */
function sendFiscalYearArchiveNotification(archiveResults) {
  try {
    const subject = `✅ Fiscal Year Archive Complete - ${archiveResults.fiscalYear}`;

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 700px;">
        <div style="background: #2e7d32; color: white; padding: 30px; text-align: center;">
          <h2>Fiscal Year Archive Complete</h2>
          <p>FY ${archiveResults.fiscalYear}</p>
        </div>
        <div style="padding: 30px; background: white;">
          <h3>Archive Summary:</h3>
          <ul>
            <li><strong>Transactions Archived:</strong> ${archiveResults.transactionCount}</li>
            <li><strong>Total Amount:</strong> $${archiveResults.totalAmount.toFixed(2)}</li>
            <li><strong>Archive Location:</strong> <a href="${archiveResults.archiveUrl}">View Archive</a></li>
            <li><strong>Backup Created:</strong> ${archiveResults.backupCreated ? 'Yes' : 'No'}</li>
          </ul>

          <div style="background: #e8f5e9; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <h4 style="margin: 0 0 10px 0;">System Ready for New Fiscal Year</h4>
            <p>All transaction data has been cleared and the system is ready for FY ${archiveResults.newFiscalYear}.</p>
          </div>

          <div style="background: #fff3cd; padding: 15px; border-radius: 6px;">
            <h4 style="margin: 0 0 10px 0;">⚠️ Important Notes:</h4>
            <ul style="margin: 5px 0;">
              <li>User budgets have been reset to $0 pending new allocations</li>
              <li>All pending approvals have been cleared</li>
              <li>Sequential IDs will restart from 001</li>
              <li>Previous year data is read-only in the archive</li>
            </ul>
          </div>
        </div>
      </div>
    `;

    sendSystemEmail({
      to: CONFIG.ADMIN_EMAIL || CONFIG.BUSINESS_OFFICE_EMAIL,
      subject: subject,
      htmlBody: htmlBody,
      cc: getEmailRecipient(CONFIG.BUSINESS_OFFICE_EMAIL)
    });

  } catch (error) {
    console.error('Error sending archive notification:', error);
  }
}

// ============================================================================
// END OF COMMUNICATIONS MODULE
// ============================================================================