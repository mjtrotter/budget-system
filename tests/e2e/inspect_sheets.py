from playwright.sync_api import sync_playwright
from conftest import PROFILE_DIR, BUDGET_HUB
import time
import os

def run():
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
        page.wait_for_timeout(5000)
        
        # Print all inputs
        inputs = page.locator("input").all()
        for i, el in enumerate(inputs):
            print(f"Input {i}: id={el.get_attribute('id')}, class={el.get_attribute('class')}, aria-label={el.get_attribute('aria-label')}")
            
        context.close()

if __name__ == "__main__":
    run()