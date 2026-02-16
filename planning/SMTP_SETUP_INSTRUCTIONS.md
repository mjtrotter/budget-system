# SMTP Setup Instructions (Outlook -> Gmail)

To ensure the Budget System sends emails as `invoicing@keswickchristian.org` using the Microsoft Outlook servers, you must configure the **Gmail "Send Mail As"** setting in the Google Account that will run the script.

## Why this is needed
Google Apps Script cannot directly connect to external SMTP servers (like Outlook's) via code due to security restrictions. However, it *can* use "Aliases" configured in the Gmail account itself.

## Configuration Steps

1.  **Log in to Gmail** with the account that owns the script.
2.  Click the **Gear Icon** (Settings) -> **See all settings**.
3.  Go to the **Accounts** (or "Accounts and Import") tab.
4.  Under **"Send mail as:"**, click **"Add another email address"**.
5.  In the popup window:
    *   **Name**: Keswick Budget System
    *   **Email address**: `invoicing@keswickchristian.org`
    *   **Treat as an alias**: Checked (usually best)
    *   Click **Next Step**.
6.  **SMTP Server Settings** (Use the Microsoft credentials you have):
    *   **SMTP Server**: `smtp.office365.com`
    *   **Port**: `587`
    *   **Username**: `invoicing@keswickchristian.org`
    *   **Password**: [Your Microsoft Account Password]
    *   **Secured connection using TLS**: Selected (Recommended)
7.  Click **Add Account**.
8.  Gmail will send a verification code to that Outlook inbox. Log in to Outlook, get the code, and verify.

## Verification
Once verified, run the `testEmailConfiguration()` function in `Email_Sender_Utility.js` to confirm emails are arriving with the correct "From" address.
