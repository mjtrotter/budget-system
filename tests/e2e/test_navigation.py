from playwright.sync_api import sync_playwright
from conftest import PROFILE_DIR, BUDGET_HUB
from helpers.sheets import open_sheet, goto_cell, read_cell
import time

def run():
    print("Running read-only navigation test for Row 92...")
    with sync_playwright() as pw:
        context = pw.chromium.launch_persistent_context(
            user_data_dir=PROFILE_DIR,
            headless=False,
            channel="chrome",
            viewport={"width": 1280, "height": 900},
            args=["--disable-blink-features=AutomationControlled"],
        )
        page = open_sheet(context, BUDGET_HUB, "UserDirectory")
        
        # Navigate to A92 (Email) and read it
        goto_cell(page, "A92")
        time.sleep(2)  # Give you a second to visually confirm it jumped to A92
        email_val = read_cell(page, "A92")
        print(f"Cell A92 contains: {email_val}")
        
        # Navigate to H92 (BudgetAllocated)
        goto_cell(page, "H92")
        time.sleep(2)
        alloc_val = read_cell(page, "H92")
        print(f"Cell H92 contains: {alloc_val}")
        
        # Navigate to J92 (BudgetEncumbered)
        goto_cell(page, "J92")
        time.sleep(2)
        encumb_val = read_cell(page, "J92")
        print(f"Cell J92 contains: {encumb_val}")

        print("Test complete. Browser closing.")
        context.close()

if __name__ == "__main__":
    run()