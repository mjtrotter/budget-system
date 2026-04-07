"""Launch headed browser for manual login verification.

Opens 3 tabs:
  1. Budget Hub (Google Sheets)
  2. Apps Script home
  3. OWA inbox (Outlook)

Uses a persistent Chromium profile so cookies/sessions survive across runs.
Block until the user confirms they have logged into all three services.
"""

import os
from playwright.sync_api import sync_playwright
from conftest import (
    PROFILE_DIR,
    BUDGET_HUB,
    APPS_SCRIPT_HOME,
    OWA_URL,
)


def main() -> None:
    os.makedirs(PROFILE_DIR, exist_ok=True)

    with sync_playwright() as pw:
        context = pw.chromium.launch_persistent_context(
            user_data_dir=PROFILE_DIR,
            headless=False,
            viewport={"width": 1280, "height": 900},
            args=["--disable-blink-features=AutomationControlled"],
        )

        # Tab 1 — Budget Hub
        page1 = context.pages[0] if context.pages else context.new_page()
        page1.goto(BUDGET_HUB, wait_until="domcontentloaded")

        # Tab 2 — Apps Script
        page2 = context.new_page()
        page2.goto(APPS_SCRIPT_HOME, wait_until="domcontentloaded")

        # Tab 3 — OWA
        page3 = context.new_page()
        page3.goto(OWA_URL, wait_until="domcontentloaded")

        input(
            "\n========================================\n"
            "  Manual Login Required\n"
            "========================================\n"
            "Please log into all three services in the browser:\n"
            f"  1. Google Sheets  — {BUDGET_HUB}\n"
            f"  2. Apps Script    — {APPS_SCRIPT_HOME}\n"
            f"  3. Outlook (OWA)  — {OWA_URL}\n\n"
            "Press Enter after logging into all three services..."
        )

        print("Login session saved. You can close this script.")
        context.close()


if __name__ == "__main__":
    main()
