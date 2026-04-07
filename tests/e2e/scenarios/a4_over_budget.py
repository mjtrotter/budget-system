"""Scenario A4: Amazon Over Budget ($45 attempt on $10 budget).

Tests that a purchase that exceeds the available budget limit 
triggers an over-budget notification/approval request.
"""

from __future__ import annotations

import os
import sys
from playwright.sync_api import sync_playwright

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from conftest import (
    PROFILE_DIR,
    BUDGET_HUB,
    AMAZON_FORM,
    OWA_URL,
    TARGET_EMAIL,
    EVIDENCE_DIR,
)

# Safety: abort if target email would bypass Amazon TrialMode
assert TARGET_EMAIL.lower().strip() != "mtrotter@keswickchristian.org", \
    "SAFETY ABORT: mtrotter@ bypasses TrialMode"

from helpers.sheets import open_sheet, set_cell
from helpers.owa import (
    open_owa, 
    search_emails, 
    open_latest_email, 
    get_email_body_text, 
    delete_current_email
)
from helpers.forms import open_form, fill_amazon_form, submit_form


def inject(context) -> None:
    """Set up for A4: Teacher with only $10 budget."""
    page = open_sheet(context, BUDGET_HUB, "UserDirectory")
    set_cell(page, "D92", "Teacher")
    set_cell(page, "G92", TARGET_EMAIL)
    set_cell(page, "H92", "10") # Only $10
    set_cell(page, "I92", "0")
    set_cell(page, "M92", "TRUE")
    page.close()


def execute(context) -> None:
    """Submit Amazon form for $45."""
    page = open_form(context, AMAZON_FORM)
    fill_amazon_form(page, description="Test Item A4 (Over Budget)", url="https://www.amazon.com/dp/B0CX23V2ZK", qty=1, price="45.00")
    submit_form(page)
    page.wait_for_timeout(15000)
    page.close()


def verify(context) -> str:
    """Check OWA for Over Budget notification."""
    os.makedirs(EVIDENCE_DIR, exist_ok=True)
    result = "PASS"
    details = []

    owa = open_owa(context)
    # Search for "over budget" or "Approval" since it might route to admin
    search_emails(owa, "over budget")
    owa.wait_for_timeout(3000)
    
    if owa.locator("div[role='option']").count() == 0:
        # Fallback search
        search_emails(owa, "Approval")
        owa.wait_for_timeout(2000)

    if owa.locator("div[role='option']").count() > 0:
        open_latest_email(owa)
        body = get_email_body_text(owa).lower()
        owa.screenshot(path=os.path.join(EVIDENCE_DIR, "a4_email.png"))
        
        if "over budget" not in body and "exceeds" not in body:
            result = "FAIL"
            details.append("Email notification text did not mention over budget condition")
        
        delete_current_email(owa)
    else:
        result = "FAIL"
        details.append("No notification email found in OWA")

    owa.close()
    return f"A4: {result}" + (f" — {'; '.join(details)}" if details else "")


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
