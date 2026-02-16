#!/usr/bin/env python3
"""
Test script for Amazon cart scraper
Uses a real Amazon cart URL format
"""

import asyncio
import json
from scraper.cart_scraper import AmazonCartScraper


async def test_asin_lookup():
    """Test ASIN lookup with real Amazon products"""
    print("\n" + "="*60)
    print("TESTING ASIN LOOKUP")
    print("="*60)

    # Real Amazon products (lab/school supplies)
    test_asins = [
        "B07ZPKN6YR",  # Amazon Basics USB-C Cable
        "B0787CJZQL",  # Microscope Slides
    ]

    print(f"\nLooking up {len(test_asins)} ASINs...")

    scraper = AmazonCartScraper()

    try:
        result = await scraper.lookup_asins(test_asins)

        print(f"\nSuccess: {result.get('item_count', 0)} items found")
        print(f"Subtotal: ${result.get('subtotal', 0):.2f}")

        for item in result.get('items', []):
            print(f"\n  ASIN: {item.get('asin')}")
            print(f"  Title: {item.get('title', 'N/A')[:60]}...")
            print(f"  Price: ${item.get('unit_price', 0):.2f}")

        return result

    except Exception as e:
        print(f"\nError: {e}")
        return None
    finally:
        await scraper.close()


async def test_cart_url():
    """Test cart URL scraping"""
    print("\n" + "="*60)
    print("TESTING CART URL SCRAPING")
    print("="*60)

    # Amazon "Add to Cart" URL format
    # This creates a cart with specified ASINs and quantities
    cart_url = (
        "https://www.amazon.com/gp/aws/cart/add.html?"
        "ASIN.1=B07ZPKN6YR&Quantity.1=2&"
        "ASIN.2=B0787CJZQL&Quantity.2=1"
    )

    print(f"\nCart URL: {cart_url[:60]}...")

    scraper = AmazonCartScraper()

    try:
        result = await scraper.scrape_cart_url(cart_url)

        print(f"\nSuccess: {result.get('item_count', 0)} items found")
        print(f"Subtotal: ${result.get('subtotal', 0):.2f}")

        for item in result.get('items', []):
            print(f"\n  ASIN: {item.get('asin')}")
            print(f"  Title: {item.get('title', 'N/A')[:60]}...")
            print(f"  Price: ${item.get('unit_price', 0):.2f}")
            print(f"  Qty: {item.get('quantity', 1)}")

        return result

    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()
        return None
    finally:
        await scraper.close()


async def main():
    print("\n" + "#"*60)
    print("# KESWICK CART SCRAPER - TEST SUITE")
    print("#"*60)

    # Test 1: ASIN Lookup
    asin_result = await test_asin_lookup()

    # Test 2: Cart URL
    print("\n\nWaiting 2 seconds before cart test...")
    await asyncio.sleep(2)
    cart_result = await test_cart_url()

    print("\n" + "="*60)
    print("TEST COMPLETE")
    print("="*60)


if __name__ == "__main__":
    asyncio.run(main())
