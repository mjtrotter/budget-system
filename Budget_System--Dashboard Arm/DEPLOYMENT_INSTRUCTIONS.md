# Keswick Budget Dashboard - Phase 1 Deployment Runbook

## Overview
This document provides the specific manual steps required to finalize the deployment of the Keswick Budget Dashboard (Dashboard Arm). Make sure you are logged in as **invoicing@keswickchristian.org**.

## Prerequisites
- **Account:** `invoicing@keswickchristian.org`
- **RapidAPI Key:** You must have your RapidAPI key ready.

## Files in This System
1. **Dashboard_BE.gs** - Backend service.
2. **Dashboard_API.gs** - API layer.
3. **Dashboard_UI.html** - Frontend.
4. **appsscript.json** - Manifest.

## Step-by-Step Deployment Guide

### Step 1: Create the Dashboard Project
1.  Go to [script.google.com](https://script.google.com).
2.  Click **New Project**.
3.  Name it: `Budget System - Dashboard Arm`.
4.  **Important**: Click the Gear icon (Project Settings) > General > Enable "Show 'appsscript.json' manifest file in editor".

### Step 2: Push the Code
*Since browser automation is limited, you will copy/paste the code manually or use `clasp` if you have it configured locally with the new script ID.*

**Manual Copy Method:**
1.  **appsscript.json**: Overwrite with content from local `appsscript.json`.
2.  **Dashboard_BE.gs**: Create script file, paste content from local `Dashboard_BE`.
3.  **Dashboard_API.gs**: Create script file, paste content from local `Dashboard_API`.
4.  **Dashboard_UI.html**: Create HTML file, paste content from local `Dashboard_UI.html`.
5.  **Delete** the default `Code.gs` if you haven't used it.

### Step 3: Configure Privacy & Integrations
1.  **Script Properties (RapidAPI)**:
    *   File > Project Settings > Script Properties > **Add script property**.
    *   **Property**: `RAPIDAPI_KEY`
    *   **Value**: *[Your Amazon Data RapidAPI Key]*
    *   Click **Save**.

2.  **Permissions**:
    *   Run the function `testConnection()` in `Dashboard_BE.gs` (or any simple function) to trigger the authorization flow.
    *   Review and Grant permissions for Sheets, Email, and External Calls.

### Step 4: Deploy as Web App
1.  Click **Deploy** > **New deployment**.
2.  **Select type**: Web app.
3.  **Configuration**:
    *   **Description**: `Phase 1 Beta`
    *   **Execute as**: `Me` (`invoicing@keswickchristian.org`)
    *   **Who has access**: `Anyone within Keswick Christian School`
4.  Click **Deploy**.
5.  **Copy the Web App URL**.

### Step 5: Verification
1.  Open the Web App URL.
2.  It should auto-login as `mtrotter@keswickchristian.org` (or your current user if different) if tested from that account, OR strictly `mtrotter` if running in the Test Mode configuration.
3.  **Check**:
    *   **KPIs**: Are numbers appearing (System Budget, Spending)?
    *   **Transactions**: Do you see the mock or real transactions?
    *   **Debug Console**: Click the bug icon in the bottom right. Check for "✅ Service initialized".

## Troubleshooting

### "Google Script API not available"
*   Ensure you are accessing the **deployed URL** (`/exec`), not the dev URL (`/dev`), although dev works for testing.

### "Dashboard shows only demo data"
*   This means the **Hub Sheets** are empty or not accessible.
*   Check the Execution Logs in the Apps Script Editor for "Error getting organization budgets".

### Amazon/Pricing Issues
*   If prices aren't showing or updating in the spreadsheets during testing, check that `RAPIDAPI_KEY` is set in Script Properties.