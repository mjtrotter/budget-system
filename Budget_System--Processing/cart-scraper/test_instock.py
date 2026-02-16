#!/usr/bin/env python3
"""Test with confirmed in-stock Amazon Basics products"""

import asyncio
from scraper.cart_scraper import AmazonCartScraper

# Amazon Basics products - typically always in stock
INSTOCK_PRODUCTS = [
    "B07ZPKN6YR",  # iPhone (worked before)
    "B00006IE7F",  # BIC pens (worked before)
    "B00MNV8E0C",  # Amazon Basics batteries (worked before)
    "B01M7YDVJZ",  # Amazon Basics USB cable
    "B07NJHG7P7",  # Amazon Basics notebook
    "B09JFL3FY6",  # Amazon Basics scissors
    "B07RM8V5XP",  # Amazon Basics pencils
    "B00LH3DMUO",  # Amazon Basics stapler
]

async def test_instock():
    print("\n" + "="*60)
    print("  TESTING IN-STOCK AMAZON BASICS PRODUCTS")
    print("="*60 + "\n")
    
    scraper = AmazonCartScraper()
    prices_found = 0
    prices_missing = 0
    
    try:
        for asin in INSTOCK_PRODUCTS:
            print(f"  {asin}: ", end="", flush=True)
            result = await scraper.lookup_asins([asin])
            
            if result and result.get("items"):
                item = result["items"][0]
                price = item.get("unit_price", 0)
                title = item.get("title", "")[:40]
                
                if price > 0:
                    prices_found += 1
                    print(f"✅ ${price:.2f} - {title}...")
                else:
                    prices_missing += 1
                    print(f"❌ No price - {title}...")
            else:
                prices_missing += 1
                print("❌ No data")
            
            await asyncio.sleep(2)
    
    finally:
        await scraper.close()
    
    total = prices_found + prices_missing
    rate = prices_found / total * 100 if total > 0 else 0
    
    print("\n" + "-"*60)
    print(f"  RESULTS: {prices_found}/{total} prices found ({rate:.1f}%)")
    
    if rate >= 80:
        print("  ✅ VIABLE for in-stock products")
    elif rate >= 60:
        print("  ⚠️ MARGINAL - needs improvement")
    else:
        print("  ❌ NOT VIABLE")
    print("="*60 + "\n")

asyncio.run(test_instock())
