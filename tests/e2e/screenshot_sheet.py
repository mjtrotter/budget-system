from playwright.sync_api import sync_playwright
from conftest import PROFILE_DIR, BUDGET_HUB
import time
import os

def run():
    print("Opening browser to take a screenshot of Google Sheets...")
    os.makedirs("evidence", exist_ok=True)
    with sync_playwright() as pw:
        context = pw.chromium.launch_persistent_context(
            user_data_dir=PROFILE_DIR,
            headless=False,
            channel="chrome",
            viewport={"width": 1280, "height": 900},
            args=["--disable-blink-features=AutomationControlled"],
        )
        page = context.new_page()
        page.goto(BUDGET_HUB, wait_until="domcontentloaded")
        page.wait_for_timeout(5000) # wait for data to load
        
        tab = page.locator("text=UserDirectory").first
        tab.click()
        page.wait_for_timeout(5000)

        # Take a screenshot
        screenshot_path = "evidence/sheet_debug.png"
        page.screenshot(path=screenshot_path, full_page=True)
        print(f"Screenshot saved to {screenshot_path}")
        
        context.close()

if __name__ == "__main__":
    run()