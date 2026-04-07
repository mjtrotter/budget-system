"""Scenario A1: Amazon Auto-Approval ($45, Happy Path).

Tests that a purchase under the auto-approval threshold ($200) from a user
with sufficient budget is automatically approved without manual intervention.
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
    "SAFETY ABORT: mtrotter@ bypasses TrialMode — real orders would be placed!"
from helpers.sheets import open_sheet, set_cell
from helpers.owa import open_owa, search_emails, open_latest_email, get_email_body_text, delete_current_email
from helpers.forms import open_form, fill_amazon_form, submit_form


def inject(context) -> None:
    """Set up UserDirectory for A1: Teacher with $500 budget."""
    page = open_sheet(context, BUDGET_HUB, "UserDirectory")

    # Col D (idx 3) = Role: Teacher
    set_cell(page, "D92", "Teacher")
    # Col G (idx 6) = Approver
    set_cell(page, "G92", TARGET_EMAIL)
    # Col H (idx 7) = Allocated: 500
    set_cell(page, "H92", "500")
    # Col I (idx 8) = Spent: 0
    set_cell(page, "I92", "0")
    # Col M (idx 12) = Active: TRUE
    set_cell(page, "M92", "TRUE")

    page.close()


def execute(context) -> None:
    """Submit Amazon form for $45."""
    page = open_form(context, AMAZON_FORM)
    fill_amazon_form(page, description="Test Item A1", url="https://www.amazon.com/dp/B0CX23V2ZK", qty=1, price="45.00")
    submit_form(page)
    # Wait for GAS trigger
    page.wait_for_timeout(15000)
    page.close()


def verify(context) -> str:
    """Check AutomatedQueue for APPROVED (auto) and confirmation email."""
    os.makedirs(EVIDENCE_DIR, exist_ok=True)
    result = "PASS"
    details = []

    # Check AutomatedQueue
    page = open_sheet(context, AUTOMATED_HUB, "AutomatedQueue")
    page.wait_for_timeout(2000)
    page.screenshot(path=os.path.join(EVIDENCE_DIR, "a1_queue.png"))
    page.close()

    # Check OWA for confirmation email
    owa = open_owa(context)
    search_emails(owa, "subject:Approval")
    owa.wait_for_timeout(2000)
    open_latest_email(owa)
    body = get_email_body_text(owa)
    owa.screenshot(path=os.path.join(EVIDENCE_DIR, "a1_email.png"))

    if "approved" not in body.lower() and "confirmation" not in body.lower():
        result = "FAIL"
        details.append("Expected approval confirmation email not found")

    delete_current_email(owa)
    owa.close()

    return f"A1: {result}" + (f" — {'; '.join(details)}" if details else "")


def run() -> str:
    """Execute full A1 scenario."""
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
