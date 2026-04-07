from playwright.sync_api import sync_playwright
from conftest import PROFILE_DIR, BUDGET_HUB
from helpers.sheets import open_sheet, set_cell
import time
import os

def run():
    with sync_playwright() as pw:
        context = pw.chromium.launch_persistent_context(
            user_data_dir=PROFILE_DIR,
            headless=False,
            channel="chrome",
            viewport={"width": 1280, "height": 900},
            args=["--disable-blink-features=AutomationControlled"],
        )
        page = open_sheet(context, BUDGET_HUB, "UserDirectory")
        set_cell(page, "A1", "Email")
        print("Restored A1 to 'Email'")
        
        # Then, I should also restore the invoicing email back to A2.
        # It's currently #N/A as seen in the screenshot
        set_cell(page, "A2", "invoicing@keswickchristian.org")
        print("Restored A2 to 'invoicing@keswickchristian.org'")

        # Now I should probably test that set_cell works nicely.
        page.screenshot(path="evidence/sheet_fixed.png", full_page=True)
        context.close()

if __name__ == "__main__":
    run()