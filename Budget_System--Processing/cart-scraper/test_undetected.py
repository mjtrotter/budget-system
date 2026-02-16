#!/usr/bin/env python3
"""
Test with undetected-playwright - designed to bypass bot detection
"""

import asyncio
from undetected_playwright.async_api import async_playwright, Malenia

CART_URL = (
    "https://www.amazon.com/gp/aws/cart/add.html?"
    "ASIN.1=B07ZPKN6YR&Quantity.1=2&"
    "ASIN.2=B00006IE7F&Quantity.2=5"
)

async def test_undetected():
    print("\n" + "="*60)
    print("  UNDETECTED-PLAYWRIGHT TEST")
    print("="*60 + "\n")
    
    async with async_playwright() as p:
        # Use Malenia to apply stealth patches
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        
        # Apply stealth
        await Malenia.apply_stealth(context)
        
        page = await context.new_page()
        
        print(f"Loading cart URL...")
        await page.goto(CART_URL, wait_until='networkidle', timeout=60000)
        await asyncio.sleep(3)
        
        title = await page.title()
        url = page.url
        html = await page.content()
        
        print(f"Title: {title}")
        print(f"URL: {url[:60]}...")
        print(f"Size: {len(html)} bytes")
        
        if "Something went wrong" in html:
            print("\n❌ Blocked")
        elif "/ap/signin" in url:
            print("\n⚠️ Sign-in required")
        elif len(html) < 10000:
            print("\n❌ Blocked (short page)")
        else:
            print("\n✅ SUCCESS!")
            
            # Find cart items
            items = await page.query_selector_all('[data-asin]')
            print(f"Cart items: {len(items)}")
            
            prices = await page.query_selector_all('.a-price .a-offscreen')
            print(f"Prices: {len(prices)}")
            for i, p in enumerate(prices[:5]):
                text = await p.inner_text()
                print(f"  {i+1}: {text}")
        
        await browser.close()

asyncio.run(test_undetected())
