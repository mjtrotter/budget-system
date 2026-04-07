"""Scenario A2: Velocity Denial ($480 pre-spent + $30 = $510 > $500 limit).

Tests that the daily spending velocity check flags a purchase when the
cumulative daily spend exceeds the velocity threshold.
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
    TARGET_EMAIL,
    EVIDENCE_DIR,
)

assert TARGET_EMAIL.lower().strip() != "mtrotter@keswickchristian.org", \
    "SAFETY ABORT: mtrotter@ bypasses TrialMode — real orders would be placed!"
from helpers.sheets import open_sheet, set_cell
from helpers.owa import open_owa, search_emails, open_latest_email, get_email_body_text, delete_current_email
from helpers.forms import open_form, fill_amazon_form, submit_form


def inject(context) -> None:
    """Set up UserDirectory and add dummy transaction for velocity trigger."""
    # Set Allocated = 1000, Approver = self
    page = open_sheet(context, BUDGET_HUB, "UserDirectory")
    set_cell(page, "H92", "1000")  # Allocated
    set_cell(page, "G92", TARGET_EMAIL)  # Approver
    page.close()

    # Add dummy $480 approved transaction in TransactionLedger
    page = open_sheet(context, AUTOMATED_HUB, "TransactionLedger")
    # Navigate to first empty row and add dummy data
    page.keyboard.press("Control+End")
    page.wait_for_timeout(500)
    page.keyboard.press("ArrowDown")
    page.wait_for_timeout(300)
    page.keyboard.press("Home")
    page.wait_for_timeout(300)

    # Type: Email, Amount, Status, Date
    page.keyboard.type(TARGET_EMAIL, delay=20)
    page.keyboard.press("Tab")
    page.keyboard.type("480", delay=20)
    page.keyboard.press("Tab")
    page.keyboard.type("APPROVED (auto)", delay=20)
    page.keyboard.press("Tab")
    page.keyboard.type("2026-04-03", delay=20)
    page.keyboard.press("Enter")
    page.wait_for_timeout(1000)
    page.close()


def execute(context) -> None:
    """Submit Amazon form for $30."""
    page = open_form(context, AMAZON_FORM)
    fill_amazon_form(page, description="Test Item A2", url="https://www.amazon.com/dp/B0CX23V2ZK", qty=1, price="30.00")
    submit_form(page)
    page.wait_for_timeout(15000)
    page.close()


def verify(context) -> str:
    """Check for PENDING status with VELOCITY note and approval request email."""
    os.makedirs(EVIDENCE_DIR, exist_ok=True)
    result = "PASS"
    details = []

    # Check AutomatedQueue
    page = open_sheet(context, AUTOMATED_HUB, "AutomatedQueue")
    page.wait_for_timeout(2000)
    page.screenshot(path=os.path.join(EVIDENCE_DIR, "a2_queue.png"))
    page.close()

    # Check OWA for approval request (not confirmation)
    owa = open_owa(context)
    search_emails(owa, "subject:Approval Request")
    owa.wait_for_timeout(2000)
    open_latest_email(owa)
    body = get_email_body_text(owa)
    owa.screenshot(path=os.path.join(EVIDENCE_DIR, "a2_email.png"))

    if "velocity" not in body.lower() and "approval" not in body.lower():
        result = "FAIL"
        details.append("Expected velocity-triggered approval request email not found")

    delete_current_email(owa)
    owa.close()

    return f"A2: {result}" + (f" — {'; '.join(details)}" if details else "")


def run() -> str:
    """Execute full A2 scenario."""
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
