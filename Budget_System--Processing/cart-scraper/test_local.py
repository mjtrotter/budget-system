#!/usr/bin/env python3
"""
Local test script for the cart scraper
Run with: python test_local.py
"""

import asyncio
import json
from scraper.cart_scraper import AmazonCartScraper


async def test_asin_lookup():
    """Test ASIN lookup functionality"""
    print("\n=== Testing ASIN Lookup ===")

    scraper = AmazonCartScraper()

    # Test with a known ASIN (Amazon Basics product)
    test_asins = ["B07ZPKN6YR"]  # Amazon Basics USB Cable

    try:
        result = await scraper.lookup_asins(test_asins)
        print(f"Result: {json.dumps(result, indent=2)}")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await scraper.close()


async def test_cart_url():
    """Test cart URL scraping (requires a valid cart URL)"""
    print("\n=== Testing Cart URL Scraping ===")

    # Example cart URL format (you'll need a real one to test)
    test_url = "https://www.amazon.com/gp/aws/cart/add.html?ASIN.1=B07ZPKN6YR&Quantity.1=2"

    scraper = AmazonCartScraper()

    try:
        result = await scraper.scrape_cart_url(test_url)
        print(f"Result: {json.dumps(result, indent=2)}")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await scraper.close()


async def main():
    """Run tests"""
    print("Keswick Cart Scraper - Local Tests")
    print("=" * 40)

    await test_asin_lookup()
    # await test_cart_url()  # Uncomment to test cart URLs


if __name__ == "__main__":
    asyncio.run(main())
