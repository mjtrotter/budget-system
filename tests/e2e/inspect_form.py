from playwright.sync_api import sync_playwright
from conftest import PROFILE_DIR, AMAZON_FORM

def run():
    with sync_playwright() as pw:
        context = pw.chromium.launch_persistent_context(
            user_data_dir=PROFILE_DIR,
            headless=False,
            viewport={"width": 1280, "height": 900},
        )
        page = context.new_page()
        page.goto(AMAZON_FORM, wait_until="domcontentloaded")
        page.wait_for_timeout(3000)
        
        # Get all question titles
        headings = page.locator("[role='heading']").all()
        for h in headings:
            print("Question:", h.inner_text().strip())
        
        # Get all inputs
        inputs = page.locator("input[type='text'], input[type='url'], input[type='number'], textarea").all()
        print(f"Found {len(inputs)} visible text inputs")
        for i, el in enumerate(inputs):
            if el.is_visible():
                print(f"Input {i}: type={el.evaluate('el => el.type')}, aria-label={el.get_attribute('aria-label')}")
        
        radios = page.locator("[role='radio']").all()
        print(f"Found {len(radios)} radio buttons")
        for r in radios:
            if r.is_visible():
                print("Radio:", r.get_attribute("aria-label"), r.get_attribute("data-value"))
        
        context.close()

if __name__ == "__main__":
    run()