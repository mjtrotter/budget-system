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
    // In TEST_MODE: override approver to the requestor (if whitelisted) so they can demo the full approve/deny flow
    if (isTestMode() && requestData.requestor) {
      const requestorEmail = String(requestData.requestor).toLowerCase().trim();
      if (CONFIG.UAT_WHITELIST && CONFIG.UAT_WHITELIST.some(e => e.toLowerCase() === requestorEmail)) {
        console.log(`[TEST] Overriding approver from ${approverEmail} to requestor ${requestData.requestor} for demo flow`);
        approverEmail = requestData.requestor;
      }
    }

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
    
    // Determine which budget source to use for UI rendering 
    // (Admin/Warehouse = Individual; Curriculum/FieldTrip = Organization)
    let renderBudget = {
      allocated: userBudget.allocated,
      spent: userBudget.spent,
      encumbered: userBudget.encumbered,
      utilizationRate: userBudget.utilizationRate
    };
    
    // Override with organization budget metrics if provided by the specific form engine
    if (requestData.budgetContext && requestData.budgetContext.allocated !== undefined) {
      renderBudget.allocated = requestData.budgetContext.allocated;
      renderBudget.spent = requestData.budgetContext.spent || 0;
      renderBudget.encumbered = requestData.budgetContext.encumbered || 0;
      if (requestData.budgetContext.utilization) {
        renderBudget.utilizationRate = parseFloat(requestData.budgetContext.utilization) / 100;
      }
    }

    const budgetRemaining = renderBudget.allocated - renderBudget.spent - renderBudget.encumbered;
    const budgetAfterRequest = budgetRemaining - requestData.amount;
    const isOverBudget = budgetAfterRequest < 0;

    // Ensure minimum visibility for budget bar - convert decimal to percentage
    const utilizationPercent = (renderBudget.utilizationRate * 100) || 0;
    const utilizationWidth = Math.max(utilizationPercent, 3); // Minimum 3% width for visibility
    const requestWidth = Math.max((requestData.amount / userBudget.allocated) * 100, 1); // Minimum 1% width

    // Determine budget status styling - using school colors (green/gold)
    const budgetStatus = {
      class: isOverBudget ? 'danger' : (utilizationPercent > 80 ? 'warning' : 'success'),
      color: isOverBudget ? '#d32f2f' : (utilizationPercent > 80 ? '#f57c00' : '#19573B'),
      message: isOverBudget ? 'OVER BUDGET' : (utilizationPercent > 80 ? 'HIGH UTILIZATION' : 'WITHIN BUDGET')
    };

    let htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0; padding:0; background-color:#f4f4f4; font-family:Arial, sans-serif; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f4f4f4; padding:20px;">
    <tr>
      <td align="center">
        <!-- Main Wrapper -->
        <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 2px 10px rgba(0,0,0,0.1); border: 1px solid #dddddd;">
          
          <!-- Logo Banner -->
          <tr>
            <td align="center" style="background-color:#ffffff; padding:20px; border-bottom:1px solid #eeeeee;">
              <img src="https://lh3.googleusercontent.com/d/1HDkW_xGIc4jOBH4REnXb3VJcZaEjPHKj" alt="Keswick Christian School" width="280" style="display:block; max-width:280px; height:auto; border:0;">
            </td>
          </tr>

          <!-- Header -->
          <tr>
            <td align="center" style="background-color:#19573B; padding:15px;">
              <div style="color:#ffffff; font-size:14px; font-family:monospace; letter-spacing:1px;">ID: ${requestData.transactionId}</div>
            </td>
          </tr>

          <!-- Action Buttons (Outlook Bulletproof Table) -->
          <tr>
            <td align="center" style="padding:25px 20px; background-color:#ffffff; border-bottom:2px solid #f0f0f0;">
              <table border="0" cellspacing="0" cellpadding="0" align="center">
                <tr>
                  <td align="center" style="border-radius:4px; background-color:#19573B;">
                    <a href="${approveUrl}" target="_blank" style="font-size:16px; font-family:Arial, sans-serif; color:#ffffff; text-decoration:none; border-radius:4px; padding:12px 30px; border:1px solid #19573B; display:inline-block; font-weight:bold;">&#10003; APPROVE</a>
                  </td>
                  <td width="20"></td>
                  <td align="center" style="border-radius:4px; background-color:#C62828;">
                    <a href="${rejectUrl}" target="_blank" style="font-size:16px; font-family:Arial, sans-serif; color:#ffffff; text-decoration:none; border-radius:4px; padding:12px 30px; border:1px solid #C62828; display:inline-block; font-weight:bold;">&#10005; REJECT</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content Wrapper -->
          <tr>
            <td style="padding:20px;">`;

    // Add PDF section if PDF link exists
    if (requestData.pdfLink) {
      htmlBody += `
              <!-- PDF Section -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#fff8e1; border:1px solid #ffc107; border-radius:6px; margin-bottom:20px;">
                <tr>
                  <td align="center" style="padding:15px;">
                    <h3 style="color:#f57c00; margin:0 0 8px 0; font-size:16px; font-family:Arial, sans-serif;">Supporting Documentation</h3>
                    <p style="color:#8d6e00; margin:0 0 15px 0; font-size:14px; font-family:Arial, sans-serif;">Please review the attached document before making your approval decision.</p>
                    <table border="0" cellspacing="0" cellpadding="0" align="center">
                      <tr>
                        <td align="center" style="border-radius:4px; background-color:#ffc107;">
                          <a href="${requestData.pdfLink}" target="_blank" style="font-size:14px; font-family:Arial, sans-serif; color:#000000; text-decoration:none; border-radius:4px; padding:10px 20px; display:inline-block; font-weight:bold;">View Document</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>`;
    }

    htmlBody += `
              <!-- Summary Card (Table) -->
              <table width="100%" border="0" cellspacing="0" cellpadding="12" style="background-color:#f9f9f9; border-left:4px solid #19573B; border-radius:4px; margin-bottom:20px; border-top:1px solid #eeeeee; border-right:1px solid #eeeeee; border-bottom:1px solid #eeeeee;">
                <tr>
                  <td style="border-bottom:1px solid #e0e0e0; font-family:Arial, sans-serif;">
                    <span style="color:#666666; font-size:13px;">Request Type:</span><br>
                    <strong style="color:#333333; font-size:15px;">${requestData.type}</strong>
                  </td>
                </tr>
                <tr>
                  <td style="border-bottom:1px solid #e0e0e0; font-family:Arial, sans-serif;">
                    <span style="color:#666666; font-size:13px;">Requestor:</span><br>
                    <strong style="color:#333333; font-size:15px;">${userBudget.firstName} ${userBudget.lastName} &middot; ${userBudget.department}</strong>
                  </td>
                </tr>
                <tr>
                  <td style="font-family:Arial, sans-serif;">
                    <span style="color:#666666; font-size:13px;">Total Amount:</span><br>
                    <strong style="color:#19573B; font-size:18px;">$${requestData.amount.toFixed(2)}</strong>
                  </td>
                </tr>
              </table>

              <!-- Budget Box -->
              <table width="100%" border="0" cellspacing="0" cellpadding="15" style="background-color:#ffffff; border:1px solid #e0e0e0; border-radius:6px; margin-bottom:20px;">
                <tr>
                  <td style="font-family:Arial, sans-serif;">
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom:15px;">
                      <tr>
                        <td align="left" style="font-size:16px; font-weight:bold; color:#333333;">Budget Status</td>
                        <td align="right">
                          <span style="background-color:${budgetStatus.class === 'danger' ? '#FFEBEE' : (budgetStatus.class === 'warning' ? '#FFF3E0' : '#E8F5E9')}; color:${budgetStatus.color}; padding:6px 12px; border-radius:12px; font-size:12px; font-weight:bold;">${utilizationPercent.toFixed(0)}% Used</span>
                        </td>
                      </tr>
                    </table>

                    <!-- Budget Grid / Blocks -->
                    <table width="100%" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <!-- Allocated -->
                        <td width="31%" align="center" style="background-color:#f9f9f9; border:1px solid #eeeeee; border-radius:4px; padding:10px;">
                          <div style="font-size:11px; color:#888888; text-transform:uppercase; margin-bottom:5px;">Allocated</div>
                          <div style="font-size:14px; font-weight:bold; color:#333333;">$${renderBudget.allocated.toFixed(2)}</div>
                        </td>
                        <td width="3%"></td>
                        <!-- Available -->
                        <td width="32%" align="center" style="background-color:#f9f9f9; border:1px solid #eeeeee; border-radius:4px; padding:10px;">
                          <div style="font-size:11px; color:#888888; text-transform:uppercase; margin-bottom:5px;">Available</div>
                          <div style="font-size:14px; font-weight:bold; color:${budgetRemaining >= 0 ? '#19573B' : '#C62828'};">$${budgetRemaining.toFixed(2)}</div>
                        </td>
                        <td width="3%"></td>
                        <!-- After Request -->
                        <td width="31%" align="center" style="background-color:${isOverBudget ? '#FFEBEE' : '#f9f9f9'}; border:1px solid ${isOverBudget ? '#ef9a9a' : '#eeeeee'}; border-radius:4px; padding:10px;">
                          <div style="font-size:11px; color:#888888; text-transform:uppercase; margin-bottom:5px;">After Request</div>
                          <div style="font-size:14px; font-weight:bold; color:${budgetAfterRequest >= 0 ? '#19573B' : '#C62828'};">$${budgetAfterRequest.toFixed(2)}</div>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>
              </table>

              <!-- Purpose Box -->
              <table width="100%" border="0" cellspacing="0" cellpadding="15" style="background-color:#f5f5f5; border-radius:6px; margin-bottom:20px;">
                <tr>
                  <td style="font-family:Arial, sans-serif; font-size:14px; color:#555555; line-height:1.6;">
                    <div style="font-size:12px; color:#888888; font-weight:bold; margin-bottom:5px; text-transform:uppercase;">Purpose / Description</div>
                    ${requestData.description}
                  </td>
                </tr>
              </table>`;

    // Add Items Table if items exist
    if (requestData.items && requestData.items.length > 0) {
      htmlBody += `
              <!-- Items Table -->
              <h3 style="font-family:Arial, sans-serif; font-size:16px; color:#333333; margin:0 0 10px 0;">Items Requested</h3>
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="font-family:Arial, sans-serif; font-size:13px; border:1px solid #dddddd; border-radius:4px; overflow:hidden;">
                <tr>
                  <td style="background-color:#19573B; color:#ffffff; padding:10px; font-weight:bold;">Item</td>
                  <td style="background-color:#19573B; color:#ffffff; padding:10px; font-weight:bold; text-align:center;" width="50">Qty</td>
                  <td style="background-color:#19573B; color:#ffffff; padding:10px; font-weight:bold; text-align:right;" width="80">Total</td>
                </tr>`;

      let grandTotal = 0;

      requestData.items.forEach(item => {
        const quantity = Math.max(parseInt(item.quantity) || 1, 1);
        let unitPrice = parseFloat(item.unitPrice);
        let totalPrice = parseFloat(item.totalPrice);

        if (isNaN(unitPrice) || unitPrice <= 0) unitPrice = (totalPrice > 0 && quantity > 0) ? totalPrice / quantity : 0;
        if (isNaN(totalPrice) || totalPrice <= 0) totalPrice = unitPrice * quantity;
        if (isNaN(unitPrice)) unitPrice = 0;
        if (isNaN(totalPrice)) totalPrice = 0;

        grandTotal += totalPrice;

        htmlBody += `
                <tr>
                  <td style="padding:10px; border-bottom:1px solid #eeeeee;">${item.description || 'Item'}</td>
                  <td style="padding:10px; border-bottom:1px solid #eeeeee; text-align:center;">${quantity}</td>
                  <td style="padding:10px; border-bottom:1px solid #eeeeee; text-align:right;">$${totalPrice.toFixed(2)}</td>
                </tr>`;
      });

      htmlBody += `
                <tr>
                  <td colspan="2" style="padding:12px 10px; text-align:right; font-weight:bold; font-size:15px; border-top:2px solid #19573B;">Grand Total:</td>
                  <td style="padding:12px 10px; text-align:right; font-weight:bold; font-size:15px; border-top:2px solid #19573B;">$${grandTotal.toFixed(2)}</td>
                </tr>
              </table>`;
    }

    htmlBody += `
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="background-color:#19573B; padding:15px; font-family:Arial, sans-serif; font-size:12px; color:#ffffff;">
              ${isOverBudget ? '<div style="color:#FFCDD2; font-weight:bold; margin-bottom:8px;">WARNING: This request exceeds the available budget limit.</div>' : ''}
              Keswick Christian School Budget Management System
            </td>
          </tr>

        </table>
        <!-- End Main Wrapper -->
      </td>
    </tr>
  </table>
</body>
</html>`;

    // Log the URL in TEST_MODE for verification visibility
    if (isTestMode()) {
      console.log(`🧪 [TEST MODE] Approval URL: ${approveUrl}`);
      console.log(`🧪 [TEST MODE] Reject URL: ${rejectUrl}`);
    }

    // Send the email via Utility (approverEmail already overridden above in TEST_MODE)
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
    let renderBudget = userBudget;

    // Route Organization Budgets for Curriculum and Field Trips
    const typeStr = (transactionData.type || '').toUpperCase();
    if (typeStr.includes('FIELD_TRIP') || typeStr.includes('FIELD TRIP') || typeStr.includes('CURRICULUM')) {
      const division = getDivisionFromDepartment(userBudget.department);
      const orgName = typeStr.includes('FIELD') ? division : userBudget.department;
      
      const orgBudget = getOrganizationBudgetInfo(orgName);
      if (orgBudget) {
        renderBudget = orgBudget;
      }
    }

    // Calculate updated budget figures. Wait, at "Approved" status it's just encumbered.
    // It doesn't move to spent until it's Ordered/Invoiced.
    const newSpent = renderBudget.spent;
    const newEncumbered = renderBudget.encumbered; // Because they already hit the encumbrance line before approval is resolved
    const newAvailable = renderBudget.allocated - newSpent - newEncumbered;
    const newUtilization = renderBudget.allocated > 0 ? ((newSpent + newEncumbered) / renderBudget.allocated * 100) : 0;

    const subject = `Purchase Order Approved - ${transactionData.transactionId}`;

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
          background: #19573B;
          color: white;
          padding: 24px;
          text-align: center;
        }
        .header img {
          max-width: 200px;
          height: auto;
          filter: brightness(0) invert(1);
          margin-bottom: 12px;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
        }
        .content {
          padding: 40px 30px;
        }
        .approval-box {
          background: #e8f5e9;
          border-left: 4px solid #19573B;
          padding: 20px;
          margin: 20px 0;
          border-radius: 5px;
        }
        .approval-box h2 {
          color: #19573B;
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
          color: #19573B;
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
        <div style="background:white;padding:16px;text-align:center;border-bottom:1px solid #eee;">
          <img src="https://lh3.googleusercontent.com/d/1HDkW_xGIc4jOBH4REnXb3VJcZaEjPHKj" alt="Keswick Christian School" style="max-width:200px;height:auto;" onerror="this.style.display='none'">
        </div>
        <div class="header">
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

          ${getArtifactLinksHtml(transactionData.transactionId)}

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
              <span class="detail-value">$${renderBudget.allocated.toFixed(2)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Total Spent (settled):</span>
              <span class="detail-value">$${newSpent.toFixed(2)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Pending Orders (including this):</span>
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

// ============================================================================
// REJECTION NOTIFICATION TO REQUESTOR
// ============================================================================

/**
 * Sends an error notification to the requestor when their form submission fails validation.
 * Tells them what went wrong and asks them to resubmit.
 */
function sendSubmissionErrorEmail(requestorEmail, errorData) {
  try {
    const recipient = getEmailRecipient(requestorEmail);
    const subject = `Action Required: ${errorData.formType} - Submission Error`;

    const htmlBody = `<!DOCTYPE html><html><head><style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
      .wrapper { max-width: 520px; margin: 0 auto; padding: 20px; }
      .card { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
      .header { background: #b71c1c; padding: 24px; text-align: center; color: white; }
      .header img { max-width: 180px; margin-bottom: 12px; filter: brightness(0) invert(1); }
      .header h1 { font-size: 20px; font-weight: 600; margin: 0; }
      .body { padding: 24px; color: #333; font-size: 15px; line-height: 1.6; }
      .error-box { background: #fff3f3; border: 1px solid #ffcdd2; border-radius: 8px; padding: 16px; margin: 16px 0; }
      .error-box strong { color: #b71c1c; }
      .footer { padding: 16px; background: #fafafa; border-top: 1px solid #eee; text-align: center; font-size: 12px; color: #888; }
    </style></head><body>
    <div class="wrapper"><div class="card">
      <div style="background:white;padding:16px;text-align:center;border-bottom:1px solid #eee;">
        <img src="https://lh3.googleusercontent.com/d/1HDkW_xGIc4jOBH4REnXb3VJcZaEjPHKj" alt="Keswick" style="max-width:200px;height:auto;" onerror="this.style.display='none'">
      </div>
      <div class="header">
        <h1>Submission Error</h1>
      </div>
      <div class="body">
        <p>Your <strong>${errorData.formType}</strong> submission could not be processed.</p>
        <div class="error-box">
          <strong>Issue:</strong> ${errorData.errorMessage}
        </div>
        <p>Please correct the issue and resubmit your request. If you need help finding the correct information, contact the Business Office.</p>
      </div>
      <div class="footer">Keswick Christian School &middot; Budget Management System</div>
    </div></div></body></html>`;

    sendSystemEmail({
      to: recipient,
      subject: subject,
      htmlBody: htmlBody
    });

    console.log(`📧 Submission error email sent to ${requestorEmail} for ${errorData.formType}`);
  } catch (emailError) {
    console.error(`❌ Failed to send submission error email: ${emailError.message}`);
  }
}

function sendRejectionNotification(requestorEmail, transactionData) {
  try {
    const subject = `Purchase Order Rejected - ${transactionData.transactionId}`;

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
          background: #b71c1c;
          color: white;
          padding: 24px;
          text-align: center;
        }
        .header img {
          max-width: 200px;
          height: auto;
          filter: brightness(0) invert(1);
          margin-bottom: 12px;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
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
        <div style="background:white;padding:16px;text-align:center;border-bottom:1px solid #eee;">
          <img src="https://lh3.googleusercontent.com/d/1HDkW_xGIc4jOBH4REnXb3VJcZaEjPHKj" alt="Keswick Christian School" style="max-width:200px;height:auto;" onerror="this.style.display='none'">
        </div>
        <div class="header">
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

/**
 * Sends a combined email to the Business Office with all generated warehouse invoices attached.
 * @param {Object} internalResult - Result from internal division invoice generation
 * @param {Object} externalResult - Result from external combined invoice generation
 */
function sendWarehouseBatchEmailToBusinessOffice(internalResult, externalResult) {
  try {
    const recipient = getEmailRecipient(CONFIG.BUSINESS_OFFICE_EMAIL);
    const dateStr = Utilities.formatDate(new Date(), 'America/New_York', 'MM/dd/yyyy');
    const subject = `Warehouse Batch Invoices - ${dateStr}`;
    
    let htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #19573B; color: white; padding: 25px; text-align: center; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">Warehouse Batch Invoices</h2>
        </div>
        <div style="background: white; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 8px 8px;">
          <p>The automated warehouse batch processing has completed. Please find the generated invoices attached.</p>
          <ul style="line-height: 1.6;">
    `;
    
    const attachments = [];

    // Attach internal division invoices
    if (internalResult && internalResult.success && internalResult.invoices) {
      htmlBody += `<li><b>Internal Division Invoices:</b> ${internalResult.invoices.length} generated</li>`;
      internalResult.invoices.forEach(inv => {
        try {
          const fileId = typeof extractFileIdFromUrl === 'function' ? extractFileIdFromUrl(inv.fileUrl) : inv.fileUrl.match(/[-\\w]{25,}/)[0];
          if (fileId) {
            const file = DriveApp.getFileById(fileId);
            attachments.push(file.getBlob());
          }
        } catch (e) {
          console.error('Could not attach internal invoice:', e);
        }
      });
    }

    // Attach external single invoice
    if (externalResult && externalResult.success && externalResult.fileUrl) {
      htmlBody += `<li><b>External Warehouse Invoice:</b> Generated</li>`;
      try {
        const fileId = typeof extractFileIdFromUrl === 'function' ? extractFileIdFromUrl(externalResult.fileUrl) : externalResult.fileUrl.match(/[-\w]{25,}/)[0];
        if (fileId) {
          const file = DriveApp.getFileById(fileId);
          attachments.push(file.getBlob());
        }
      } catch (e) {
        console.error('Could not attach external invoice:', e);
      }
    }
    
    htmlBody += `
          </ul>
          <p style="margin-top: 20px; font-size: 14px; color: #666;">
            The original PDF documents are also saved in the Budget System Drive folders.
          </p>
        </div>
      </div>
    `;

    sendSystemEmail({
      to: recipient,
      subject: isTestMode() ? `[TEST] ${subject}` : subject,
      htmlBody: htmlBody,
      attachments: attachments
    });

    console.log(`✉️ Warehouse batch email sent to Business Office (${recipient}) with ${attachments.length} attachments.`);
  } catch (error) {
    console.error('Error sending warehouse batch email to BO:', error);
  }
}

function sendBusinessOfficeNotification(details) {
  const recipient = getEmailRecipient(CONFIG.BUSINESS_OFFICE_EMAIL);

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
    const subject = `Order Processing Error - ${transactionId || 'Request Failed'}`;

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
  const subject = 'Warehouse Request Error - Invalid Item IDs';

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
  const subject = `Order Validation Failed - ${transactionId}`;

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
            <a href="${formUrls[orderType]}" style="display: inline-block; padding: 12px 30px; background: #19573B; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
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
// HELPER FUNCTIONS
// ============================================================================

function formatApproverName(email) {
  if (!email || email === 'AUTO_APPROVED') return 'System (Auto-Approved)';
  if (email === 'AUTO_SYSTEM') return 'System (Auto-Approved)';

  // Use directory lookup for proper name
  try {
    return getDisplayName(email);
  } catch (e) {
    // Fallback: parse email into a name
    const namePart = email.split('@')[0];
    const parts = namePart.split('.');
    if (parts.length >= 2) {
      return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    }
    return namePart.charAt(0).toUpperCase() + namePart.slice(1);
  }
}

function getEmailRecipient(email) {
  if (isTestMode()) {
    const normalizedEmail = String(email || '').toLowerCase().trim();
    // Only whitelisted UAT users receive emails in test mode
    if (CONFIG.UAT_WHITELIST && CONFIG.UAT_WHITELIST.includes(normalizedEmail)) {
      console.log(`[TEST] Sending to whitelisted UAT user: ${email}`);
      return email;
    }
    // All other emails (including non-whitelisted org users) redirect to test recipient
    console.log(`[TEST] Non-whitelisted, redirecting: ${email} -> ${CONFIG.TEST_EMAIL_RECIPIENT}`);
    return CONFIG.TEST_EMAIL_RECIPIENT;
  }
  return email;
}

function isTestMode() {
  return CONFIG.TEST_MODE === true;
}

/**
 * Looks up invoice/artifact URLs for a transaction from the TransactionLedger.
 * @param {string} transactionId
 * @returns {Object} { invoiceUrl, invoiceId } or empty object if not found
 */
function getArtifactLinks(transactionId) {
  try {
    const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
    const ledger = budgetHub.getSheetByName('TransactionLedger');
    if (!ledger) return {};

    const data = ledger.getDataRange().getValues();
    // Ledger columns: 0=transactionId, 10=invoiceGenerated, 11=invoiceId, 12=invoiceUrl
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === transactionId && data[i][10] === 'YES') {
        return {
          invoiceId: data[i][11] || '',
          invoiceUrl: data[i][12] || ''
        };
      }
    }
  } catch (e) {
    console.warn(`Could not retrieve artifact links for ${transactionId}: ${e.message}`);
  }
  return {};
}

/**
 * Generates HTML snippet for artifact preview links in notification emails.
 * @param {string} transactionId
 * @returns {string} HTML block (empty string if no artifacts found)
 */
function getArtifactLinksHtml(transactionId) {
  const artifacts = getArtifactLinks(transactionId);
  if (!artifacts.invoiceUrl) return '';

  return `
    <div style="background: #e8f5e9; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #c8e6c9;">
      <div style="font-weight: 600; color: #19573B; margin-bottom: 10px; font-size: 16px;">Generated Documents</div>
      <div style="padding: 8px 0;">
        <a href="${artifacts.invoiceUrl}" style="color: #1565c0; text-decoration: none; font-weight: 500;">
          View Invoice (${artifacts.invoiceId})
        </a>
      </div>
    </div>`;
}

/**
 * Sends an invoice-ready notification to the requestor with a link to the generated invoice.
 * Call this after batch or single invoice generation.
 * @param {string} requestorEmail
 * @param {Object} invoiceData - { transactionId, invoiceId, invoiceUrl, type, amount }
 */
function sendInvoiceReadyNotification(requestorEmail, invoiceData) {
  try {
    const recipient = getEmailRecipient(requestorEmail);
    const subject = `Invoice Generated - ${invoiceData.invoiceId}`;

    const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #1565c0, #42a5f5); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 30px; }
        .invoice-link { display: inline-block; background: #1565c0; color: white; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 600; margin: 15px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e9ecef; }
        .detail-label { color: #6c757d; }
        .detail-value { color: #495057; font-weight: 500; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; font-size: 14px; }
        .warning { color: #d32f2f; font-weight: 600; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Invoice Ready</h1>
        </div>
        <div class="content">
          <p>Your purchase order has been invoiced. You can view and download your invoice below.</p>
          <div style="text-align: center; margin: 25px 0;">
            <a href="${invoiceData.invoiceUrl}" class="invoice-link">View Invoice (PDF)</a>
          </div>
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
            <div class="detail-row">
              <span class="detail-label">Invoice ID:</span>
              <span class="detail-value">${invoiceData.invoiceId}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Transaction ID:</span>
              <span class="detail-value">${invoiceData.transactionId}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Type:</span>
              <span class="detail-value">${invoiceData.type || 'Purchase Order'}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Amount:</span>
              <span class="detail-value">$${(invoiceData.amount || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>
        <div class="footer">
          <p>Keswick Christian School &bull; Budget Management System</p>
          ${isTestMode() ? '<p class="warning">TEST MODE - This is a test notification</p>' : ''}
        </div>
      </div>
    </body>
    </html>`;

    sendSystemEmail({
      to: recipient,
      subject: isTestMode() ? `[TEST] ${subject}` : subject,
      htmlBody: htmlBody
    });

    console.log(`Invoice notification sent to ${recipient} for ${invoiceData.invoiceId}`);
  } catch (error) {
    console.error('Error sending invoice notification:', error);
  }
}

// ============================================================================
// ADDITIONAL FUNCTIONS
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
      `ESCALATED: Approval Required - ${staleItem.queueId} (${staleItem.age} days old)` :
      `REMINDER: Pending Approval - ${staleItem.queueId} (${staleItem.age} days old)`;

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <div style="background: ${shouldEscalate ? '#d32f2f' : '#FF8F00'}; color: white; padding: 20px; text-align: center;">
          <h2>${shouldEscalate ? 'ESCALATED Approval Request' : 'Approval Reminder'}</h2>
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
    const subject = `Daily Error Report - ${new Date().toLocaleDateString()}`;

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
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; max-width: 700px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #19573B 0%, #2E7D32 100%); color: white; padding: 16px 20px; text-align: center;">
          <h2 style="margin: 0; font-size: 20px; font-weight: 600;">Daily Error Digest</h2>
          <p style="margin: 6px 0 0; font-size: 13px; opacity: 0.85;">${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
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
          <div style="margin-top: 30px; padding: 15px; background: #E8F5E9; border-radius: 6px; border-left: 4px solid #19573B;">
            <h4 style="margin: 0 0 10px 0; color: #19573B;">Recommended Actions:</h4>
            <ul style="margin: 5px 0; color: #333;">
              <li>Review high-frequency errors for systemic issues</li>
              <li>Check user directory for any access issues</li>
              <li>Verify all form triggers are functioning</li>
              <li>Monitor system performance metrics</li>
            </ul>
          </div>
        </div>
        <div style="background: #19573B; padding: 10px 20px; text-align: center; font-size: 11px; color: rgba(255,255,255,0.7);">
          Keswick Christian School · Budget Management System · Admin Digest
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

    const subject = `Resubmit Your ${formType.replace('_', ' ')} Request`;

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
    const subject = `Fiscal Year Archive Complete - ${archiveResults.fiscalYear}`;

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 700px;">
        <div style="background: #19573B; color: white; padding: 30px; text-align: center;">
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