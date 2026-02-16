#!/usr/bin/env python3
"""Debug WHY prices are failing - take screenshots and dump HTML"""

import asyncio
from playwright.async_api import async_playwright

# Products that FAILED to get prices
FAILING = ["B07NJHG7P7", "B09JFL3FY6", "B07RM8V5XP"]

async def debug():
    playwright = await async_playwright().start()
    browser = await playwright.firefox.launch(headless=True)
    context = await browser.new_context(
        user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0",
        viewport={'width': 1920, 'height': 1080},
    )
    page = await context.new_page()
    
    for asin in FAILING:
        print(f"\n{'='*60}")
        print(f"DEBUGGING: {asin}")
        print('='*60)
        
        url = f"https://www.amazon.com/dp/{asin}"
        print(f"URL: {url}")
        
        await page.goto(url, wait_until='networkidle', timeout=60000)
        await asyncio.sleep(3)
        
        # Take screenshot
        screenshot_path = f"/tmp/amazon_{asin}.png"
        await page.screenshot(path=screenshot_path, full_page=False)
        print(f"Screenshot: {screenshot_path}")
        
        # Check final URL (did it redirect?)
        final_url = page.url
        if asin not in final_url:
            print(f"⚠️ REDIRECTED to: {final_url}")
        
        # Get page title
        title = await page.title()
        print(f"Page title: {title[:60]}...")
        
        # Check for common issues
        html = await page.content()
        html_len = len(html)
        print(f"HTML length: {html_len} bytes")
        
        if html_len < 10000:
            print("⚠️ Page seems too short - might be blocked")
        
        if "robot" in html.lower() or "captcha" in html.lower():
            print("⚠️ CAPTCHA/Robot check detected!")
        
        if "Page Not Found" in html or "Sorry!" in html:
            print("⚠️ Error page!")
        
        if "Currently unavailable" in html:
            print("⚠️ Product UNAVAILABLE")
        
        # Try to find ANY price on page
        all_prices = await page.query_selector_all('.a-price')
        print(f"Found {len(all_prices)} .a-price elements")
        
        for i, price_el in enumerate(all_prices[:5]):
            try:
                text = await price_el.inner_text()
                print(f"  Price {i}: '{text.strip()}'")
            except:
                pass
        
        # Check for the specific product title element
        title_el = await page.query_selector('#productTitle')
        if title_el:
            product_title = await title_el.inner_text()
            print(f"Product title: {product_title.strip()[:60]}...")
        else:
            print("⚠️ No #productTitle found!")
            # Try alternate
            h1 = await page.query_selector('h1')
            if h1:
                h1_text = await h1.inner_text()
                print(f"H1 text: {h1_text.strip()[:60]}...")
    
    await browser.close()
    await playwright.stop()
    
    print("\n" + "="*60)
    print("Check the screenshots in /tmp/amazon_*.png")
    print("="*60)

asyncio.run(debug())
