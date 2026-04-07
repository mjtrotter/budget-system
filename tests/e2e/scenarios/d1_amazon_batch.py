"""Scenario D1: Amazon Batch Invoicing.

Triggers the Amazon batching process and verifies that
invoices are generated for approved transactions.
"""

from __future__ import annotations

import os
import sys
from playwright.sync_api import sync_playwright

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from conftest import (
    PROFILE_DIR,
    BUDGET_HUB,
    WEBAPP_URL,
    EVIDENCE_DIR,
)

from helpers.sheets import open_sheet, read_cell, find_row_by_value
from scenarios.a1_auto_approval import execute as run_a1_execute


def execute(context) -> None:
    """Run A1 to get an approved item, then trigger batch."""
    # Ensure there is at least one approved Amazon item
    run_a1_execute(context)
    
    # Trigger Amazon Batch via WebApp backdoor
    page = context.new_page()
    page.goto(f"{WEBAPP_URL}?action=runAmazonBatch", wait_until="domcontentloaded")
    page.wait_for_timeout(10000) # Wait for batching logic to complete
    page.close()


def verify(context) -> str:
    """Check TransactionLedger for invoice details."""
    os.makedirs(EVIDENCE_DIR, exist_ok=True)
    result = "PASS"
    details = []

    page = open_sheet(context, BUDGET_HUB, "TransactionLedger")
    
    # Find the most recent Amazon transaction for test item
    # Since search starts at the top, we might find older ones.
    # But for a clean test suite, reset is called first.
    try:
        find_row_by_value(page, "Test Item A1")
        # Column K (idx 10) is InvoiceGenerated
        # Column L (idx 11) is InvoiceUrl
        # goto_cell doesn't tell us the row, but find_row_by_value leaves the cursor there.
        # We can read the current cell or use Name Box to confirm.
        
        # In Google Sheets, Ctrl+F selects the cell.
        # We can use read_cell with the Name Box value.
        name_box = page.locator("#t-name-box").first
        if not name_box.is_visible():
            name_box = page.locator(".waffle-name-box").first
            
        current_cell = name_box.input_value().upper()
        # Row number is at the end of current_cell string
        import re
        row_num = re.search(r"\d+", current_cell).group(0)
        
        gen_status = read_cell(page, f"K{row_num}")
        invoice_url = read_cell(page, f"L{row_num}")
        
        page.screenshot(path=os.path.join(EVIDENCE_DIR, "d1_ledger.png"))
        
        if gen_status.upper() != "YES":
            result = "FAIL"
            details.append(f"InvoiceGenerated status is '{gen_status}', expected 'YES'")
        
        if "drive.google.com" not in invoice_url.lower():
            result = "FAIL"
            details.append("Invoice URL is missing or invalid")
            
    except Exception as e:
        result = "FAIL"
        details.append(f"Could not verify ledger: {str(e)}")

    page.close()
    return f"D1: {result}" + (f" — {'; '.join(details)}" if details else "")


def run() -> str:
    with sync_playwright() as pw:
        context = pw.chromium.launch_persistent_context(
            user_data_dir=PROFILE_DIR,
            headless=False,
            channel="chrome",
            viewport={"width": 1280, "height": 900},
            args=["--disable-blink-features=AutomationControlled"],
        )
        try:
            execute(context)
            return verify(context)
        finally:
            context.close()


if __name__ == "__main__":
    print(run())
