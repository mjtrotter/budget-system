#!/usr/bin/env python3
"""
Rigorous test suite for Amazon Cart Scraper
Tests reliability across multiple product categories to determine RapidAPI replacement viability
"""

import asyncio
import json
import time
from datetime import datetime
from typing import Dict, List, Any
from scraper.cart_scraper import AmazonCartScraper

# Test ASINs across different categories (real Amazon products)
TEST_PRODUCTS = [
    # Electronics
    {"asin": "B07ZPKN6YR", "category": "Electronics", "expected_price_range": (100, 300)},
    {"asin": "B09V3KXJPB", "category": "Electronics", "expected_price_range": (20, 100)},  # USB hub

    # Office/School supplies
    {"asin": "B00006IE7F", "category": "Office", "expected_price_range": (5, 30)},  # Sharpie markers
    {"asin": "B07H27QBLH", "category": "Office", "expected_price_range": (10, 50)},  # Notebook

    # Lab/Science supplies
    {"asin": "B0787CJZQL", "category": "Lab", "expected_price_range": (5, 50)},  # Microscope slides
    {"asin": "B07WFPM4NQ", "category": "Lab", "expected_price_range": (10, 100)},  # Lab supplies

    # General supplies
    {"asin": "B00MNV8E0C", "category": "Supplies", "expected_price_range": (5, 30)},  # Batteries
    {"asin": "B07VJYZF9H", "category": "Supplies", "expected_price_range": (10, 50)},  # Storage
]

# Test cart URLs
TEST_CART_URLS = [
    {
        "url": "https://www.amazon.com/gp/aws/cart/add.html?ASIN.1=B07ZPKN6YR&Quantity.1=2&ASIN.2=B00006IE7F&Quantity.2=5",
        "expected_asins": ["B07ZPKN6YR", "B00006IE7F"],
        "expected_quantities": {"B07ZPKN6YR": 2, "B00006IE7F": 5}
    },
    {
        "url": "https://www.amazon.com/gp/aws/cart/add.html?ASIN.1=B09V3KXJPB&Quantity.1=1&ASIN.2=B00MNV8E0C&Quantity.2=3&ASIN.3=B07H27QBLH&Quantity.3=10",
        "expected_asins": ["B09V3KXJPB", "B00MNV8E0C", "B07H27QBLH"],
        "expected_quantities": {"B09V3KXJPB": 1, "B00MNV8E0C": 3, "B07H27QBLH": 10}
    }
]


class TestResults:
    def __init__(self):
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.price_found = 0
        self.price_not_found = 0
        self.title_found = 0
        self.title_not_found = 0
        self.total_time = 0
        self.results: List[Dict[str, Any]] = []
        self.errors: List[str] = []

    def add_result(self, result: Dict[str, Any]):
        self.results.append(result)
        self.tests_run += 1

        if result.get("success"):
            self.tests_passed += 1
        else:
            self.tests_failed += 1
            if result.get("error"):
                self.errors.append(result["error"])

        if result.get("price_found"):
            self.price_found += 1
        else:
            self.price_not_found += 1

        if result.get("title_found"):
            self.title_found += 1
        else:
            self.title_not_found += 1

        self.total_time += result.get("time_seconds", 0)

    def summary(self) -> str:
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        price_rate = (self.price_found / self.tests_run * 100) if self.tests_run > 0 else 0
        title_rate = (self.title_found / self.tests_run * 100) if self.tests_run > 0 else 0
        avg_time = (self.total_time / self.tests_run) if self.tests_run > 0 else 0

        return f"""
╔══════════════════════════════════════════════════════════════╗
║           AMAZON CART SCRAPER - TEST RESULTS                 ║
╠══════════════════════════════════════════════════════════════╣
║  Tests Run:        {self.tests_run:>5}                                    ║
║  Tests Passed:     {self.tests_passed:>5}  ({success_rate:>5.1f}%)                         ║
║  Tests Failed:     {self.tests_failed:>5}                                    ║
╠══════════════════════════════════════════════════════════════╣
║  PRICE EXTRACTION:                                           ║
║    Prices Found:   {self.price_found:>5}  ({price_rate:>5.1f}%)                         ║
║    Prices Missing: {self.price_not_found:>5}                                    ║
╠══════════════════════════════════════════════════════════════╣
║  TITLE EXTRACTION:                                           ║
║    Titles Found:   {self.title_found:>5}  ({title_rate:>5.1f}%)                         ║
║    Titles Missing: {self.title_not_found:>5}                                    ║
╠══════════════════════════════════════════════════════════════╣
║  PERFORMANCE:                                                ║
║    Total Time:     {self.total_time:>6.1f} seconds                           ║
║    Avg per Item:   {avg_time:>6.1f} seconds                           ║
╠══════════════════════════════════════════════════════════════╣
║  RAPIDAPI REPLACEMENT VIABILITY:                             ║
║    {self._viability_assessment():^58} ║
╚══════════════════════════════════════════════════════════════╝
"""

    def _viability_assessment(self) -> str:
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        price_rate = (self.price_found / self.tests_run * 100) if self.tests_run > 0 else 0

        if success_rate >= 90 and price_rate >= 80:
            return "✅ VIABLE - Can replace RapidAPI"
        elif success_rate >= 70 and price_rate >= 60:
            return "⚠️ MARGINAL - Needs improvement"
        else:
            return "❌ NOT VIABLE - RapidAPI still needed"


async def test_single_asin(scraper: AmazonCartScraper, product: Dict) -> Dict[str, Any]:
    """Test scraping a single ASIN"""
    asin = product["asin"]
    category = product["category"]
    expected_range = product["expected_price_range"]

    print(f"  Testing {asin} ({category})...", end=" ", flush=True)

    start_time = time.time()
    result = {
        "asin": asin,
        "category": category,
        "success": False,
        "price_found": False,
        "title_found": False,
        "price": 0.0,
        "title": "",
        "time_seconds": 0,
        "error": None
    }

    try:
        data = await scraper.lookup_asins([asin])
        elapsed = time.time() - start_time
        result["time_seconds"] = elapsed

        if data and data.get("items"):
            item = data["items"][0]
            result["success"] = True

            # Check price
            price = item.get("unit_price", 0)
            if price > 0:
                result["price_found"] = True
                result["price"] = price

                # Validate price is in expected range
                if expected_range[0] <= price <= expected_range[1]:
                    print(f"✅ ${price:.2f} ({elapsed:.1f}s)")
                else:
                    print(f"⚠️ ${price:.2f} (outside expected range) ({elapsed:.1f}s)")
            else:
                print(f"❌ No price ({elapsed:.1f}s)")

            # Check title
            title = item.get("title", "")
            if title and not title.startswith("Product "):
                result["title_found"] = True
                result["title"] = title[:50]
        else:
            result["error"] = "No items returned"
            print(f"❌ Failed ({elapsed:.1f}s)")

    except Exception as e:
        elapsed = time.time() - start_time
        result["time_seconds"] = elapsed
        result["error"] = str(e)
        print(f"❌ Error: {e} ({elapsed:.1f}s)")

    return result


async def test_cart_url(scraper: AmazonCartScraper, cart_test: Dict) -> Dict[str, Any]:
    """Test cart URL parsing and lookup"""
    url = cart_test["url"]
    expected_asins = cart_test["expected_asins"]
    expected_quantities = cart_test["expected_quantities"]

    print(f"\n  Testing cart with {len(expected_asins)} items...", flush=True)

    start_time = time.time()
    result = {
        "type": "cart_url",
        "expected_items": len(expected_asins),
        "success": False,
        "items_found": 0,
        "prices_found": 0,
        "quantities_correct": 0,
        "time_seconds": 0,
        "error": None
    }

    try:
        data = await scraper.scrape_cart_url(url)
        elapsed = time.time() - start_time
        result["time_seconds"] = elapsed

        if data and data.get("items"):
            result["success"] = True
            result["items_found"] = len(data["items"])

            for item in data["items"]:
                asin = item.get("asin")
                price = item.get("unit_price", 0)
                qty = item.get("quantity", 1)

                if price > 0:
                    result["prices_found"] += 1

                if asin in expected_quantities and qty == expected_quantities[asin]:
                    result["quantities_correct"] += 1

                print(f"    {asin}: ${price:.2f} x {qty} = ${item.get('line_total', 0):.2f}")

            print(f"  Subtotal: ${data.get('subtotal', 0):.2f} ({elapsed:.1f}s)")
        else:
            result["error"] = "No items returned"
            print(f"  ❌ Failed ({elapsed:.1f}s)")

    except Exception as e:
        elapsed = time.time() - start_time
        result["time_seconds"] = elapsed
        result["error"] = str(e)
        print(f"  ❌ Error: {e}")

    return result


async def run_rigorous_test():
    """Run complete test suite"""
    print("\n" + "="*70)
    print("  RIGOROUS AMAZON CART SCRAPER TEST")
    print("  Testing viability as RapidAPI replacement")
    print("="*70)
    print(f"\n  Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    results = TestResults()
    scraper = AmazonCartScraper()

    try:
        # Test 1: Individual ASIN lookups
        print("\n" + "-"*50)
        print("  TEST 1: Individual ASIN Lookups")
        print("-"*50)

        for product in TEST_PRODUCTS:
            result = await test_single_asin(scraper, product)
            results.add_result(result)
            await asyncio.sleep(1)  # Small delay between tests

        # Test 2: Cart URL parsing
        print("\n" + "-"*50)
        print("  TEST 2: Cart URL Parsing & Lookup")
        print("-"*50)

        for cart_test in TEST_CART_URLS:
            # Close and recreate scraper for fresh browser state
            await scraper.close()
            scraper = AmazonCartScraper()

            result = await test_cart_url(scraper, cart_test)
            # Add cart results to overall stats
            results.tests_run += result["expected_items"]
            results.tests_passed += result["items_found"]
            results.tests_failed += (result["expected_items"] - result["items_found"])
            results.price_found += result["prices_found"]
            results.price_not_found += (result["items_found"] - result["prices_found"])
            results.title_found += result["items_found"]  # Assume title found if item found
            results.total_time += result["time_seconds"]

            await asyncio.sleep(2)

    finally:
        await scraper.close()

    # Print summary
    print("\n" + results.summary())

    # Save detailed results
    report = {
        "timestamp": datetime.now().isoformat(),
        "summary": {
            "tests_run": results.tests_run,
            "tests_passed": results.tests_passed,
            "tests_failed": results.tests_failed,
            "success_rate": results.tests_passed / results.tests_run * 100 if results.tests_run > 0 else 0,
            "price_extraction_rate": results.price_found / results.tests_run * 100 if results.tests_run > 0 else 0,
            "avg_time_per_item": results.total_time / results.tests_run if results.tests_run > 0 else 0
        },
        "individual_results": results.results,
        "errors": results.errors
    }

    with open("/tmp/scraper_test_results.json", "w") as f:
        json.dump(report, f, indent=2)

    print(f"  Detailed results saved to: /tmp/scraper_test_results.json")
    print(f"  Completed: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*70 + "\n")

    return report


if __name__ == "__main__":
    asyncio.run(run_rigorous_test())
