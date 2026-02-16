#!/usr/bin/env python3
"""
Try going to Amazon homepage first, then a product page
to see if that works without triggering blocks
"""

import asyncio
from playwright.async_api import async_playwright
from undetected_playwright import stealth_async

async def test():
    print("\n" + "="*60)
    print("  DIRECT AMAZON ACCESS TEST")
    print("="*60 + "\n")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
        )
        page = await context.new_page()
        await stealth_async(page)
        
        # Step 1: Go to Amazon homepage
        print("1. Loading Amazon homepage...")
        await page.goto("https://www.amazon.com", wait_until='networkidle', timeout=30000)
        await asyncio.sleep(2)
        
        title = await page.title()
        print(f"   Title: {title[:50]}...")
        
        if "Sorry" in title or len(await page.content()) < 10000:
            print("   ❌ Blocked on homepage")
            await browser.close()
            return
        
        print("   ✅ Homepage loaded")
        
        # Step 2: Go to a product page
        print("\n2. Loading product page (B07ZPKN6YR)...")
        await page.goto("https://www.amazon.com/dp/B07ZPKN6YR", wait_until='networkidle', timeout=30000)
        await asyncio.sleep(3)
        
        title = await page.title()
        html = await page.content()
        print(f"   Title: {title[:50]}...")
        print(f"   Size: {len(html)} bytes")
        
        if "Sorry" in title or len(html) < 10000:
            print("   ❌ Blocked on product page")
        else:
            # Try to get price
            price_el = await page.query_selector('.a-price .a-offscreen')
            if price_el:
                price = await price_el.inner_text()
                print(f"   ✅ Price found: {price}")
            else:
                print("   ⚠️ No price element")
                
            # Get product title
            prod_title = await page.query_selector('#productTitle')
            if prod_title:
                t = await prod_title.inner_text()
                print(f"   ✅ Product: {t.strip()[:50]}...")
        
        await browser.close()

asyncio.run(test())
