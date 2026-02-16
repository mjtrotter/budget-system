#!/usr/bin/env python3
"""
Test with HEADED browser (visible window) - not headless
This is much harder for Amazon to detect as automation
"""

import asyncio
from playwright.async_api import async_playwright

CART_URL = (
    "https://www.amazon.com/gp/aws/cart/add.html?"
    "ASIN.1=B07ZPKN6YR&Quantity.1=2&"
    "ASIN.2=B00006IE7F&Quantity.2=5"
)

async def test_headed():
    print("\n" + "="*60)
    print("  HEADED BROWSER TEST (Visible Window)")
    print("="*60 + "\n")
    
    playwright = await async_playwright().start()
    
    # Launch with headless=FALSE - shows actual browser window
    browser = await playwright.chromium.launch(
        headless=False,  # VISIBLE BROWSER
        args=['--disable-blink-features=AutomationControlled']
    )
    
    context = await browser.new_context(
        viewport={'width': 1280, 'height': 800},
    )
    
    page = await context.new_page()
    
    print(f"Loading cart URL in visible browser...")
    print(f"URL: {CART_URL[:50]}...\n")
    
    await page.goto(CART_URL, wait_until='networkidle', timeout=60000)
    await asyncio.sleep(5)  # Let page fully render
    
    title = await page.title()
    url = page.url
    
    print(f"Page title: {title}")
    print(f"Final URL: {url[:60]}...")
    
    html = await page.content()
    print(f"Page size: {len(html)} bytes")
    
    if "Something went wrong" in html or "Sorry" in title:
        print("\n❌ Still blocked")
    elif "Sign in" in title or "/ap/signin" in url:
        print("\n⚠️ Redirected to sign-in")
    else:
        print("\n✅ Page loaded!")
        
        # Try to find prices
        prices = await page.query_selector_all('.a-price .a-offscreen')
        print(f"Found {len(prices)} price elements")
        
        for i, p in enumerate(prices[:5]):
            text = await p.inner_text()
            print(f"  Price {i+1}: {text}")
    
    print("\nBrowser will close in 10 seconds...")
    await asyncio.sleep(10)
    
    await browser.close()
    await playwright.stop()

asyncio.run(test_headed())
