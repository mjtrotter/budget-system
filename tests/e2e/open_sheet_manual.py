from playwright.sync_api import sync_playwright
from conftest import PROFILE_DIR, BUDGET_HUB
import time

def run():
    print("Opening browser for 120 seconds. Please inspect the Google Sheet...")
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
        time.sleep(120)
        context.close()

if __name__ == "__main__":
    run()