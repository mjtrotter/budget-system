#!/usr/bin/env python3
"""Test undetected-playwright with correct imports"""

import asyncio
from playwright.async_api import async_playwright
from undetected_playwright import stealth_async

CART_URL = (
    "https://www.amazon.com/gp/aws/cart/add.html?"
    "ASIN.1=B07ZPKN6YR&Quantity.1=2&"
    "ASIN.2=B00006IE7F&Quantity.2=5"
)

async def test():
    print("\n" + "="*60)
    print("  UNDETECTED-PLAYWRIGHT TEST")
    print("="*60 + "\n")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()
        
        # Apply stealth patches
        await stealth_async(page)
        
        print("Loading cart URL with stealth...")
        await page.goto(CART_URL, wait_until='networkidle', timeout=60000)
        await asyncio.sleep(3)
        
        title = await page.title()
        url = page.url
        html = await page.content()
        
        print(f"Title: {title}")
        print(f"URL: {url[:60]}...")
        print(f"Size: {len(html)} bytes")
        
        if "Something went wrong" in html or len(html) < 10000:
            print("\n❌ Still blocked")
        elif "/ap/signin" in url:
            print("\n⚠️ Sign-in required")  
        else:
            print("\n✅ SUCCESS!")
            prices = await page.query_selector_all('.a-price .a-offscreen')
            for i, p in enumerate(prices[:5]):
                text = await p.inner_text()
                print(f"  Price {i+1}: {text}")
        
        await browser.close()

asyncio.run(test())
