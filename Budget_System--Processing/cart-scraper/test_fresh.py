#!/usr/bin/env python3
"""Fresh test with known-good ASINs, watching for CAPTCHA"""

import asyncio
from playwright.async_api import async_playwright

# ASINs that WORKED in earlier tests
KNOWN_GOOD = [
    "B07ZPKN6YR",  # iPhone - worked
    "B00006IE7F",  # BIC pens - worked  
    "B00MNV8E0C",  # AA batteries - worked
    "B00LH3DMUO",  # AAA batteries - worked
]

async def test_fresh():
    print("\n" + "="*60)
    print("  FRESH SESSION TEST - Known Good ASINs")
    print("="*60 + "\n")
    
    playwright = await async_playwright().start()
    browser = await playwright.firefox.launch(headless=True)
    context = await browser.new_context(
        user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0",
        viewport={'width': 1920, 'height': 1080},
    )
    
    results = []
    
    for i, asin in enumerate(KNOWN_GOOD):
        page = await context.new_page()
        print(f"  [{i+1}/{len(KNOWN_GOOD)}] {asin}: ", end="", flush=True)
        
        try:
            await page.goto(f"https://www.amazon.com/dp/{asin}", wait_until='networkidle', timeout=30000)
            await asyncio.sleep(2)
            
            html = await page.content()
            
            # Check for blocking
            if "robot" in html.lower() or "captcha" in html.lower():
                print("❌ CAPTCHA BLOCKED!")
                results.append({"asin": asin, "status": "captcha"})
            elif len(html) < 5000:
                print("❌ BLOCKED (short page)")
                results.append({"asin": asin, "status": "blocked"})
            else:
                # Try to get price
                price_el = await page.query_selector('.a-price .a-offscreen')
                if price_el:
                    price = await price_el.inner_text()
                    print(f"✅ {price}")
                    results.append({"asin": asin, "status": "success", "price": price})
                else:
                    # Check if product unavailable
                    if "Currently unavailable" in html:
                        print("⚠️ Unavailable")
                        results.append({"asin": asin, "status": "unavailable"})
                    else:
                        print("⚠️ No price element found")
                        results.append({"asin": asin, "status": "no_price"})
        
        except Exception as e:
            print(f"❌ Error: {e}")
            results.append({"asin": asin, "status": "error", "error": str(e)})
        
        finally:
            await page.close()
        
        # Delay between requests
        if i < len(KNOWN_GOOD) - 1:
            await asyncio.sleep(3)
    
    await browser.close()
    await playwright.stop()
    
    # Summary
    success = len([r for r in results if r["status"] == "success"])
    captcha = len([r for r in results if r["status"] == "captcha"])
    
    print("\n" + "-"*60)
    print(f"  Success: {success}/{len(KNOWN_GOOD)}")
    print(f"  CAPTCHA blocked: {captcha}/{len(KNOWN_GOOD)}")
    
    if captcha > 0:
        print("\n  ⚠️ CAPTCHA is the problem - Amazon is blocking after N requests")
    elif success == len(KNOWN_GOOD):
        print("\n  ✅ All requests succeeded!")
    print("="*60 + "\n")

asyncio.run(test_fresh())
