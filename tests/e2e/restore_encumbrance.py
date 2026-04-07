from playwright.sync_api import sync_playwright
from conftest import PROFILE_DIR, BUDGET_HUB
from helpers.sheets import open_sheet, set_cell, read_cell
import time

def run():
    print("Restoring Encumbrance Formula for Row 92...")
    with sync_playwright() as pw:
        context = pw.chromium.launch_persistent_context(
            user_data_dir=PROFILE_DIR,
            headless=False,
            channel="chrome",
            viewport={"width": 1280, "height": 900},
            args=["--disable-blink-features=AutomationControlled"],
        )
        page = open_sheet(context, BUDGET_HUB, "UserDirectory")
        
        # The Encumbrance formula
        # Sum of 'Amount' (Col F) where 'Requestor' (Col B) is A92 and 'Status' (Col H) is "PENDING"
        # Across both Sync_Automated and Sync_Manual
        formula = '=SUMIFS(Sync_Automated!F:F, Sync_Automated!B:B, A92, Sync_Automated!H:H, "PENDING") + SUMIFS(Sync_Manual!F:F, Sync_Manual!B:B, A92, Sync_Manual!H:H, "PENDING")'
        
        set_cell(page, "J92", formula)
        
        # Wait a moment for Google Sheets to evaluate it
        time.sleep(3)
        
        # Read the result
        result = read_cell(page, "J92")
        print(f"Formula inserted successfully into J92.")
        print(f"New evaluated value is: {result}")
        
        context.close()

if __name__ == "__main__":
    run()