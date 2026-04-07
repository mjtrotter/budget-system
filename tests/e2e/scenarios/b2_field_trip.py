"""Scenario B2: Field Trip Request ($450).

Tests that a Field Trip request correctly routes to the 
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
    FIELD_TRIP_FORM,
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
from helpers.forms import open_form, fill_field_trip_form, submit_form


def inject(context) -> None:
    """Set up for B2: Teacher with $2000 budget."""
    page = open_sheet(context, BUDGET_HUB, "UserDirectory")
    set_cell(page, "D92", "Teacher")
    set_cell(page, "G92", TARGET_EMAIL)
    set_cell(page, "H92", "2000")
    set_cell(page, "I92", "0")
    set_cell(page, "M92", "TRUE")
    page.close()


def execute(context) -> None:
    """Submit Field Trip form for $450."""
    page = open_form(context, FIELD_TRIP_FORM)
    fill_field_trip_form(page, destination="Test Museum B2", trip_date="2026-05-15", students=45, transportation="Bus", total_cost="450.00")
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
    
    owa.screenshot(path=os.path.join(EVIDENCE_DIR, "b2_email.png"))
    
    if click_approval_link(owa):
        owa.wait_for_timeout(5000)
        owa.screenshot(path=os.path.join(EVIDENCE_DIR, "b2_approval_landed.png"))
        
        body_landed = owa.locator("body").inner_text().lower()
        if "approved" not in body_landed:
            result = "FAIL"
            details.append("Field Trip approval landing page failed")
    else:
        result = "FAIL"
        details.append("Field Trip approval link not found in email")

    owa.close()
    return f"B2: {result}" + (f" — {'; '.join(details)}" if details else "")


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
