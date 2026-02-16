# Project Status: Keswick Budget System

## Current State: READY FOR DEPLOYMENT (Phase 2 Complete)
Migrated from monorepo to standalone repo (`budget-system`). Core processing engines (Amazon, Budget, Communication) are refactored and configured.

## Recent Changes
- **2026-02-04**: 
    - **Migration**: Complete move to `Budget_System--Processing`.
    - **Amazon Engine**: Refactored to "Cart URL" approach (Removed RapidAPI).
    - **Form & Drive**: Corrected Form IDs in Config. Created `create_drive_assets.js` setup script.
    - **SMTP**: Implemented `Email_Sender_Utility.js` using Gmail Aliases for Outlook routing.
    - **Phase 3 (E2E)**: Implemented nightly invoicing (`runNightlyInvoiceBatch`) and full E2E simulation (`True_E2E.js`). Verified Amazon Ledger integration.

## Next Actions (User)
1.  **Deploy**: Push `Budget_System--Processing` content to Google Apps Script.
2.  **Setup**: Run `createBudgetSystemAssets()` from `create_drive_assets.js`.
3.  **Configure**: Set Script Properties (`SMTP_CONFIGURED`, `TEST_MODE`).
4.  **Publish**: Ensure "Amazon Request Form" is Published.

## Known TODOs / Future Phases
- **Invoicing Engine**: `Invoicing_Engine.gs` exists but is not fully integrated in `Main.gs` (marked as TODO).
- **Maintenance**: `runDailyMaintenance` and `runWeeklyCleanup` in `Main.gs` are placeholders.
- **Web App**: `WebApp.html` exists but deployment verification is needed.

## Notes
- Original code preserved in `SDK-1` monorepo.
- `Communication_SMTP.js` was deleted (replaced by utility).
