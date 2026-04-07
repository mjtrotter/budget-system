"""Scenario C1: Warehouse supply request.

Tests that a Warehouse request correctly routes to the 
Principal (TARGET_EMAIL) and requires a manual approval click.
"""

from __future__ import annotations

import os
import sys
from playwright.sync_api import sync_playwright

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from conftest import (
    PROFILE_DIR,
    BUDGET_HUB,
    MANUAL_HUB,
    WAREHOUSE_FORM,
    TARGET_EMAIL,
    EVIDENCE_DIR,
)

# Safety: target email must be correct
assert TARGET_EMAIL.lower().strip() != "mtrotter@keswickchristian.org", \
    "SAFETY ABORT: mtrotter@ bypasses TrialMode"

from helpers.sheets import open_sheet, set_cell
from helpers.owa import (
    open_owa, 
    search_emails, 
    open_latest_email, 
    click_approval_link,
    delete_current_email
)
from helpers.forms import open_form, fill_warehouse_form, submit_form


def inject(context) -> None:
    """Set up for C1: Teacher with $500 budget."""
    page = open_sheet(context, BUDGET_HUB, "UserDirectory")
    set_cell(page, "D92", "Teacher")
    set_cell(page, "G92", TARGET_EMAIL)
    set_cell(page, "H92", "500")
    set_cell(page, "I92", "0")
    set_cell(page, "M92", "TRUE")
    page.close()


def execute(context) -> None:
    """Submit Warehouse form for item W-101."""
    page = open_form(context, WAREHOUSE_FORM)
    fill_warehouse_form(page, catalog_id="W-101", qty=2)
    submit_form(page)
    page.wait_for_timeout(15000)
    page.close()


def verify(context) -> str:
    """Check OWA and click Approve."""
    os.makedirs(EVIDENCE_DIR, exist_ok=True)
    result = "PASS"
    details = []

    owa = open_owa(context)
    search_emails(owa, "subject:Approval")
    owa.wait_for_timeout(3000)
    open_latest_email(owa)
    
    owa.screenshot(path=os.path.join(EVIDENCE_DIR, "c1_email.png"))
    
    if click_approval_link(owa):
        owa.wait_for_timeout(5000)
        owa.screenshot(path=os.path.join(EVIDENCE_DIR, "c1_approval_landed.png"))
        
        body_landed = owa.locator("body").inner_text().lower()
        if "approved" not in body_landed:
            result = "FAIL"
            details.append("Warehouse approval landing page failed")
    else:
        result = "FAIL"
        details.append("Warehouse approval link not found in email")

    owa.close()
    return f"C1: {result}" + (f" — {'; '.join(details)}" if details else "")


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
            inject(context)
            execute(context)
            return verify(context)
        finally:
            context.close()


if __name__ == "__main__":
    print(run())
