#!/usr/bin/env python3
"""
CORRECT APPROACH: Load ONE cart URL, scrape ALL items from that single page
No multiple requests - just one page load with all the data
"""

import asyncio
from playwright.async_api import async_playwright

# Single cart URL with multiple items
CART_URL = (
    "https://www.amazon.com/gp/aws/cart/add.html?"
    "ASIN.1=B07ZPKN6YR&Quantity.1=2&"
    "ASIN.2=B00006IE7F&Quantity.2=5&"
    "ASIN.3=B00MNV8E0C&Quantity.3=3"
)

async def test_single_cart_load():
    print("\n" + "="*60)
    print("  CORRECT APPROACH: Single Cart URL Load")
    print("="*60)
    print(f"\nCart URL: {CART_URL[:60]}...")
    print("\nExpected: 3 items on ONE page\n")
    
    playwright = await async_playwright().start()
    browser = await playwright.firefox.launch(headless=True)
    context = await browser.new_context(
        user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0",
        viewport={'width': 1920, 'height': 1080},
    )
    page = await context.new_page()
    
    print("Loading cart page (ONE request)...")
    await page.goto(CART_URL, wait_until='networkidle', timeout=60000)
    await asyncio.sleep(3)
    
    final_url = page.url
    print(f"Final URL: {final_url[:60]}...")
    
    # Screenshot
    await page.screenshot(path='/tmp/cart_single_load.png', full_page=True)
    print("Screenshot: /tmp/cart_single_load.png")
    
    html = await page.content()
    print(f"Page size: {len(html)} bytes")
    
    # Check for issues
    if "robot" in html.lower() or "captcha" in html.lower():
        print("\n❌ CAPTCHA detected!")
    elif "Something went wrong" in html:
        print("\n❌ Error page - Amazon blocked the cart URL")
    elif len(html) < 10000:
        print("\n⚠️ Page seems too short")
    else:
        print("\n✅ Page loaded successfully!")
        
        # Try to find cart items
        cart_items = await page.query_selector_all('[data-asin]')
        print(f"\nFound {len(cart_items)} items with data-asin")
        
        # Look for cart-specific selectors
        sc_items = await page.query_selector_all('.sc-list-item')
        print(f"Found {len(sc_items)} .sc-list-item elements")
        
        # Find all prices on page
        prices = await page.query_selector_all('.a-price .a-offscreen')
        print(f"Found {len(prices)} price elements")
        
        for i, p in enumerate(prices[:10]):
            try:
                text = await p.inner_text()
                print(f"  Price {i+1}: {text}")
            except:
                pass
        
        # Check for subtotal
        subtotal = await page.query_selector('#sc-subtotal-amount-activecart')
        if subtotal:
            text = await subtotal.inner_text()
            print(f"\nCart subtotal: {text}")
    
    await browser.close()
    await playwright.stop()
    
    print("\n" + "="*60 + "\n")

asyncio.run(test_single_cart_load())
