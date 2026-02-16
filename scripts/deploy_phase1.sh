#!/bin/bash
# Keswick Budget System - Phase 1 Deployment Script
# Run this script to deploy all code and then follow manual steps

set -e

echo "======================================"
echo "KESWICK BUDGET SYSTEM - PHASE 1 DEPLOY"
echo "======================================"
echo ""

# Directory paths
BUDGET_DIR="/Users/mjtrotter/SDK-1/apps/business/budget-system"
PROCESSING_DIR="$BUDGET_DIR/Budget_System--Processing"
INVOICING_DIR="$BUDGET_DIR/Budget_System--Invoicing Arm"

# Step 1: Push Processing Arm
echo "📦 Step 1: Pushing Processing Arm to Apps Script..."
cd "$PROCESSING_DIR"
clasp push -f
echo "✅ Processing Arm pushed"
echo ""

# Step 2: Push Invoicing Arm  
echo "📦 Step 2: Pushing Invoicing Arm to Apps Script..."
cd "$INVOICING_DIR"
clasp push -f
echo "✅ Invoicing Arm pushed"
echo ""

# Step 3: Open Apps Script for manual deployment
echo "🌐 Step 3: Opening Apps Script editor..."
open "https://script.google.com/home/projects/1HvQFOTy3ZmJIf8Tsz3NkMV5aXP5g95oyU9hs8xbs1Gcoweq9N2f9GhN7/edit"
echo ""

echo "======================================"
echo "MANUAL STEPS REQUIRED"
echo "======================================"
echo ""
echo "1. In the Apps Script editor that just opened:"
echo "   - Click on 'Main.gs' in the left sidebar"
echo "   - Select 'completePhase1Deployment' from the function dropdown"
echo "   - Click the Run button (▶️)"
echo "   - Authorize when prompted"
echo ""
echo "2. After successful deployment, test by submitting forms:"
echo "   - Amazon: https://docs.google.com/forms/d/1tCWHc5Li6XmTAVkVnmbXoiJIWENCrB2RS0kJCR6QUZ4/viewform"
echo "   - Field Trip: https://docs.google.com/forms/d/1KA7Oez-Anf7XUh41wYYlyNiHjEtcn7tzH0iAVEFOmRA/viewform"
echo ""
echo "3. Verify data appears in Hub sheets:"
echo "   - Automated Hub: https://docs.google.com/spreadsheets/d/1mGcKhEehd4OwqUy1_zN40SWJ7O_aL5ax-6B_oZDddfM/edit"
echo "   - Manual Hub: https://docs.google.com/spreadsheets/d/1-t7YnyVvk0vxqbKGNteNHOQ92XOJNme4eJPjxVRVI5M/edit"
echo ""
echo "4. Email notifications should arrive at: mtrotter@keswickchristian.org"
echo ""
echo "======================================"
