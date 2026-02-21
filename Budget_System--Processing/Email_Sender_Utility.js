/**
 * ============================================================================
 * EMAIL SENDER UTILITY
 * ============================================================================
 * Handles sending emails via multiple providers:
 * - SMTP API (SendGrid, Mailgun, Microsoft Graph)
 * - Gmail/MailApp fallback
 *
 * Configuration via Script Properties:
 * - SMTP_ENABLED: true/false
 * - SMTP_PROVIDER: SENDGRID, MAILGUN, MSGRAPH
 * - SMTP_API_KEY: API key for the provider
 * - MSGRAPH_CLIENT_ID: Azure AD client ID (for Microsoft Graph)
 * - MSGRAPH_CLIENT_SECRET: Azure AD client secret
 * - MSGRAPH_TENANT_ID: Azure AD tenant ID
 */

const EMAIL_CONFIG = {
    SENDER_ALIAS: 'invoicing@keswickchristian.org',
    SENDER_NAME: 'Keswick Budget System',
    PROP_SMTP_CONFIGURED: 'SMTP_CONFIGURED'
};

/**
 * Main email sending function - routes to appropriate provider
 */
function sendSystemEmail(emailObj) {
    console.log(`📧 Attempting to send email to ${emailObj.to}`);

    // Try SMTP provider first if enabled
    if (CONFIG.SMTP && CONFIG.SMTP.ENABLED) {
        try {
            const result = sendViaSMTPProvider(emailObj);
            if (result) {
                console.log(`✅ Email sent via ${CONFIG.SMTP.PROVIDER} to ${emailObj.to}`);
                return true;
            }
        } catch (smtpError) {
            console.error(`❌ SMTP provider failed: ${smtpError.message}`);
            console.log('⚠️ Falling back to Gmail/MailApp...');
        }
    }

    // Fallback to Gmail/MailApp
    return sendViaGmail(emailObj);
}

/**
 * Send via SMTP API provider (SendGrid, Mailgun, Office365, or Microsoft Graph)
 */
function sendViaSMTPProvider(emailObj) {
    const provider = CONFIG.SMTP.PROVIDER.toUpperCase();

    switch (provider) {
        case 'SENDGRID':
            return sendViaSendGrid(emailObj);
        case 'MAILGUN':
            return sendViaMailgun(emailObj);
        case 'OFFICE365':
        case 'O365':
            return sendViaOffice365(emailObj);
        case 'MSGRAPH':
        case 'MICROSOFT':
        case 'OUTLOOK':
            return sendViaMicrosoftGraph(emailObj);
        default:
            throw new Error(`Unknown SMTP provider: ${provider}`);
    }
}

/**
 * Send email via Office 365 using ROPC (Resource Owner Password Credential) flow
 * This mimics direct SMTP auth using username/password
 * Requires: O365_EMAIL, O365_PASSWORD in Script Properties
 */
function sendViaOffice365(emailObj) {
    const props = PropertiesService.getScriptProperties();
    const userEmail = props.getProperty('O365_EMAIL') || CONFIG.SMTP.FROM_EMAIL || EMAIL_CONFIG.SENDER_ALIAS;
    const password = props.getProperty('O365_PASSWORD') || CONFIG.SMTP.API_KEY;
    const tenantId = props.getProperty('O365_TENANT_ID') || 'organizations';

    if (!userEmail || !password) {
        throw new Error('Office 365 credentials not configured (O365_EMAIL, O365_PASSWORD)');
    }

    console.log(`📧 Sending via Office365 as ${userEmail}`);

    // Get access token using ROPC flow (username/password)
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const tokenPayload = [
        `client_id=d3590ed6-52b3-4102-aeff-aad2292ab01c`, // Microsoft Office client ID
        `scope=https://graph.microsoft.com/.default`,
        `grant_type=password`,
        `username=${encodeURIComponent(userEmail)}`,
        `password=${encodeURIComponent(password)}`
    ].join('&');

    const tokenResponse = UrlFetchApp.fetch(tokenUrl, {
        method: 'post',
        contentType: 'application/x-www-form-urlencoded',
        payload: tokenPayload,
        muteHttpExceptions: true
    });

    if (tokenResponse.getResponseCode() !== 200) {
        const errorText = tokenResponse.getContentText();
        console.error(`❌ O365 token error: ${errorText}`);
        throw new Error(`Office 365 auth failed: ${errorText}`);
    }

    const tokenData = JSON.parse(tokenResponse.getContentText());
    const accessToken = tokenData.access_token;

    // Build email message for Graph API
    const message = {
        message: {
            subject: emailObj.subject,
            body: {
                contentType: emailObj.htmlBody ? 'HTML' : 'Text',
                content: emailObj.htmlBody || emailObj.body || ' '
            },
            toRecipients: [{ emailAddress: { address: emailObj.to } }],
            from: {
                emailAddress: { address: userEmail }
            }
        },
        saveToSentItems: true
    };

    if (emailObj.cc) {
        message.message.ccRecipients = [{ emailAddress: { address: emailObj.cc } }];
    }
    if (emailObj.bcc) {
        message.message.bccRecipients = [{ emailAddress: { address: emailObj.bcc } }];
    }

    // Send email via Graph API
    const sendUrl = 'https://graph.microsoft.com/v1.0/me/sendMail';
    const sendResponse = UrlFetchApp.fetch(sendUrl, {
        method: 'post',
        contentType: 'application/json',
        headers: {
            'Authorization': `Bearer ${accessToken}`
        },
        payload: JSON.stringify(message),
        muteHttpExceptions: true
    });

    const code = sendResponse.getResponseCode();
    if (code >= 200 && code < 300) {
        console.log(`✅ Email sent via Office365 to ${emailObj.to}`);
        return true;
    } else {
        throw new Error(`O365 send error ${code}: ${sendResponse.getContentText()}`);
    }
}

/**
 * Send email via SendGrid API
 */
function sendViaSendGrid(emailObj) {
    const apiKey = CONFIG.SMTP.API_KEY;
    if (!apiKey) throw new Error('SendGrid API key not configured');

    const payload = {
        personalizations: [{
            to: [{ email: emailObj.to }],
            cc: emailObj.cc ? [{ email: emailObj.cc }] : undefined,
            bcc: emailObj.bcc ? [{ email: emailObj.bcc }] : undefined
        }],
        from: {
            email: CONFIG.SMTP.FROM_EMAIL || EMAIL_CONFIG.SENDER_ALIAS,
            name: EMAIL_CONFIG.SENDER_NAME
        },
        subject: emailObj.subject,
        content: []
    };

    // Add plain text content
    if (emailObj.body) {
        payload.content.push({ type: 'text/plain', value: emailObj.body });
    }

    // Add HTML content
    if (emailObj.htmlBody) {
        payload.content.push({ type: 'text/html', value: emailObj.htmlBody });
    }

    // Ensure at least some content
    if (payload.content.length === 0) {
        payload.content.push({ type: 'text/plain', value: ' ' });
    }

    const response = UrlFetchApp.fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'post',
        contentType: 'application/json',
        headers: {
            'Authorization': `Bearer ${apiKey}`
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
    });

    const code = response.getResponseCode();
    if (code >= 200 && code < 300) {
        return true;
    } else {
        throw new Error(`SendGrid error ${code}: ${response.getContentText()}`);
    }
}

/**
 * Send email via Mailgun API
 */
function sendViaMailgun(emailObj) {
    const apiKey = CONFIG.SMTP.API_KEY;
    const domain = getDyn('MAILGUN_DOMAIN', 'mg.keswickchristian.org');
    if (!apiKey) throw new Error('Mailgun API key not configured');

    const formData = {
        from: `${EMAIL_CONFIG.SENDER_NAME} <${CONFIG.SMTP.FROM_EMAIL || EMAIL_CONFIG.SENDER_ALIAS}>`,
        to: emailObj.to,
        subject: emailObj.subject
    };

    if (emailObj.body) formData.text = emailObj.body;
    if (emailObj.htmlBody) formData.html = emailObj.htmlBody;
    if (emailObj.cc) formData.cc = emailObj.cc;
    if (emailObj.bcc) formData.bcc = emailObj.bcc;

    const response = UrlFetchApp.fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
        method: 'post',
        headers: {
            'Authorization': 'Basic ' + Utilities.base64Encode('api:' + apiKey)
        },
        payload: formData,
        muteHttpExceptions: true
    });

    const code = response.getResponseCode();
    if (code >= 200 && code < 300) {
        return true;
    } else {
        throw new Error(`Mailgun error ${code}: ${response.getContentText()}`);
    }
}

/**
 * Send email via Microsoft Graph API (Office 365/Outlook)
 * Requires Azure AD app with Mail.Send permission
 */
function sendViaMicrosoftGraph(emailObj) {
    const props = PropertiesService.getScriptProperties();
    const clientId = props.getProperty('MSGRAPH_CLIENT_ID');
    const clientSecret = props.getProperty('MSGRAPH_CLIENT_SECRET');
    const tenantId = props.getProperty('MSGRAPH_TENANT_ID');
    const userEmail = CONFIG.SMTP.FROM_EMAIL || EMAIL_CONFIG.SENDER_ALIAS;

    if (!clientId || !clientSecret || !tenantId) {
        throw new Error('Microsoft Graph credentials not configured (MSGRAPH_CLIENT_ID, MSGRAPH_CLIENT_SECRET, MSGRAPH_TENANT_ID)');
    }

    // Get access token using client credentials flow
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const tokenResponse = UrlFetchApp.fetch(tokenUrl, {
        method: 'post',
        contentType: 'application/x-www-form-urlencoded',
        payload: {
            client_id: clientId,
            client_secret: clientSecret,
            scope: 'https://graph.microsoft.com/.default',
            grant_type: 'client_credentials'
        },
        muteHttpExceptions: true
    });

    if (tokenResponse.getResponseCode() !== 200) {
        throw new Error(`MS Graph token error: ${tokenResponse.getContentText()}`);
    }

    const tokenData = JSON.parse(tokenResponse.getContentText());
    const accessToken = tokenData.access_token;

    // Build email message
    const message = {
        message: {
            subject: emailObj.subject,
            body: {
                contentType: emailObj.htmlBody ? 'HTML' : 'Text',
                content: emailObj.htmlBody || emailObj.body || ' '
            },
            toRecipients: [{ emailAddress: { address: emailObj.to } }]
        },
        saveToSentItems: true
    };

    if (emailObj.cc) {
        message.message.ccRecipients = [{ emailAddress: { address: emailObj.cc } }];
    }
    if (emailObj.bcc) {
        message.message.bccRecipients = [{ emailAddress: { address: emailObj.bcc } }];
    }

    // Send email via Graph API
    const sendUrl = `https://graph.microsoft.com/v1.0/users/${userEmail}/sendMail`;
    const sendResponse = UrlFetchApp.fetch(sendUrl, {
        method: 'post',
        contentType: 'application/json',
        headers: {
            'Authorization': `Bearer ${accessToken}`
        },
        payload: JSON.stringify(message),
        muteHttpExceptions: true
    });

    const code = sendResponse.getResponseCode();
    if (code >= 200 && code < 300) {
        return true;
    } else {
        throw new Error(`MS Graph send error ${code}: ${sendResponse.getContentText()}`);
    }
}

/**
 * Fallback: Send via Gmail/MailApp
 */
function sendViaGmail(emailObj) {
    try {
        const fromAlias = EMAIL_CONFIG.SENDER_ALIAS;

        const options = {
            htmlBody: emailObj.htmlBody,
            from: fromAlias,
            name: EMAIL_CONFIG.SENDER_NAME,
            attachments: emailObj.attachments,
            cc: emailObj.cc,
            bcc: emailObj.bcc,
            replyTo: emailObj.replyTo || fromAlias
        };

        GmailApp.sendEmail(emailObj.to, emailObj.subject, emailObj.body || '', options);
        console.log(`📧 Email sent via Gmail to ${emailObj.to} from ${fromAlias}`);
        return true;

    } catch (gmailError) {
        console.error(`❌ Gmail failed: ${gmailError.message}`);

        // Final fallback: MailApp without alias
        try {
            MailApp.sendEmail({
                to: emailObj.to,
                subject: emailObj.subject,
                body: emailObj.body || '',
                htmlBody: emailObj.htmlBody,
                cc: emailObj.cc,
                bcc: emailObj.bcc
            });
            console.log(`📧 Email sent via MailApp to ${emailObj.to}`);
            return true;
        } catch (mailError) {
            console.error(`❌ MailApp also failed: ${mailError.message}`);
            return false;
        }
    }
}

/**
 * Test email configuration
 */
function testEmailConfiguration() {
    const userEmail = Session.getActiveUser().getEmail();
    console.log(`🧪 Testing email configuration...`);
    console.log(`   SMTP Enabled: ${CONFIG.SMTP?.ENABLED}`);
    console.log(`   Provider: ${CONFIG.SMTP?.PROVIDER}`);
    console.log(`   From: ${CONFIG.SMTP?.FROM_EMAIL || EMAIL_CONFIG.SENDER_ALIAS}`);

    const result = sendSystemEmail({
        to: userEmail,
        subject: '[TEST] Budget System Email Configuration',
        body: 'This is a test to verify email configuration.',
        htmlBody: `
            <h2>Email Configuration Test</h2>
            <p>If you received this, email is working!</p>
            <ul>
                <li><strong>Provider:</strong> ${CONFIG.SMTP?.ENABLED ? CONFIG.SMTP?.PROVIDER : 'Gmail/MailApp'}</li>
                <li><strong>From:</strong> ${CONFIG.SMTP?.FROM_EMAIL || EMAIL_CONFIG.SENDER_ALIAS}</li>
                <li><strong>To:</strong> ${userEmail}</li>
            </ul>
        `
    });

    console.log(result ? '✅ Test email sent successfully!' : '❌ Test email failed!');
    return result;
}

/**
 * Setup Office 365 credentials for email sending
 * Run this once to configure the script properties
 *
 * Uses invoicing@keswickchristian.org as the sender account
 */
function setupOffice365Email() {
    const props = PropertiesService.getScriptProperties();

    // Set Office 365 credentials for invoicing account
    props.setProperty('O365_EMAIL', 'invoicing@keswickchristian.org');
    props.setProperty('O365_PASSWORD', 'bo@999paper');
    props.setProperty('O365_TENANT_ID', 'organizations');
    props.setProperty('SMTP_ENABLED', 'true');

    console.log('✅ Office 365 email credentials configured!');
    console.log('   Email: invoicing@keswickchristian.org');
    console.log('   Provider: OFFICE365');
    console.log('');
    console.log('Run testEmailConfiguration() to verify it works.');
}

/**
 * Quick setup helper - logs what credentials are needed
 */
function showSMTPSetupInstructions() {
    console.log(`
============================================================
SMTP CONFIGURATION INSTRUCTIONS
============================================================

To enable SMTP email sending, set these Script Properties:

1. For SendGrid:
   - SMTP_ENABLED = true
   - SMTP_PROVIDER = SENDGRID
   - SMTP_API_KEY = your_sendgrid_api_key

2. For Mailgun:
   - SMTP_ENABLED = true
   - SMTP_PROVIDER = MAILGUN
   - SMTP_API_KEY = your_mailgun_api_key
   - MAILGUN_DOMAIN = mg.yourdomain.com

3. For Microsoft Graph (Office 365/Outlook):
   - SMTP_ENABLED = true
   - SMTP_PROVIDER = MSGRAPH
   - MSGRAPH_CLIENT_ID = your_azure_app_client_id
   - MSGRAPH_CLIENT_SECRET = your_azure_app_client_secret
   - MSGRAPH_TENANT_ID = your_azure_tenant_id

To set Script Properties:
1. Go to Project Settings (gear icon)
2. Scroll to "Script Properties"
3. Add each property

============================================================
    `);
}
