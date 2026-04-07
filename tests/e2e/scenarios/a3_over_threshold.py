"""Scenario A3: Amazon Over Threshold ($250).

Tests that a purchase over the auto-approval threshold ($200) triggers
an approval email to the Principal (TARGET_EMAIL) and requires a click.
"""

from __future__ import annotations

import os
import sys
from playwright.sync_api import sync_playwright

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from conftest import (
    PROFILE_DIR,
    BUDGET_HUB,
    AUTOMATED_HUB,
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
    click_approval_link,
    delete_current_email
)
from helpers.forms import open_form, fill_amazon_form, submit_form


def inject(context) -> None:
    """Set up for A3: Teacher with $1000 budget."""
    page = open_sheet(context, BUDGET_HUB, "UserDirectory")
    set_cell(page, "D92", "Teacher")
    set_cell(page, "G92", TARGET_EMAIL)
    set_cell(page, "H92", "1000")
    set_cell(page, "I92", "0")
    set_cell(page, "M92", "TRUE")
    page.close()


def execute(context) -> None:
    """Submit Amazon form for $250."""
    page = open_form(context, AMAZON_FORM)
    fill_amazon_form(page, description="Test Item A3 ($250)", url="https://www.amazon.com/dp/B0CX23V2ZK", qty=1, price="250.00")
    submit_form(page)
    page.wait_for_timeout(15000)
    page.close()


def verify(context) -> str:
    """Find approval email and click Approve."""
    os.makedirs(EVIDENCE_DIR, exist_ok=True)
    result = "PASS"
    details = []

    # Check OWA for approval request
    owa = open_owa(context)
    search_emails(owa, "subject:Approval")
    owa.wait_for_timeout(3000)
    open_latest_email(owa)
    
    owa.screenshot(path=os.path.join(EVIDENCE_DIR, "a3_email_before.png"))
    
    # Click approval link
    if click_approval_link(owa):
        owa.wait_for_timeout(5000)
        owa.screenshot(path=os.path.join(EVIDENCE_DIR, "a3_approval_landed.png"))
        
        body_landed = owa.locator("body").inner_text().lower()
        if "approved" not in body_landed:
            result = "FAIL"
            details.append("Approval landing page did not reflect success")
    else:
        result = "FAIL"
        details.append("Could not find approval link in email")

    # Cleanup: go back to OWA and delete
    owa.goto(OWA_URL)
    search_emails(owa, "subject:Approval")
    open_latest_email(owa)
    delete_current_email(owa)
    owa.close()

    return f"A3: {result}" + (f" — {'; '.join(details)}" if details else "")


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
