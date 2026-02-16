"""
Amazon Cart Scraper using Playwright with Stealth
Extracts product data from Amazon carts and product pages
Uses playwright-stealth to avoid bot detection
"""

import re
import asyncio
import logging
import random
from typing import Dict, List, Optional, Any
from playwright.async_api import async_playwright, Browser, Page, TimeoutError as PlaywrightTimeout
from playwright_stealth import Stealth

logger = logging.getLogger(__name__)

# User agent rotation pool (Firefox user agents for Firefox browser)
USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0",
]


class AmazonCartScraper:
    """Scrapes Amazon cart and product data using Playwright"""

    def __init__(self):
        self.playwright = None
        self.browser: Optional[Browser] = None
        self.context = None
        # Stealth configuration
        self.stealth = Stealth(
            navigator_webdriver=True,
            chrome_runtime=True,
            navigator_plugins=True,
            navigator_permissions=True,
            navigator_languages=True,
            navigator_platform=True,
            navigator_vendor=True,
            webgl_vendor=True,
        )
        # Rotate user agent for each session
        self.user_agent = random.choice(USER_AGENTS)

    async def _init_browser(self):
        """Initialize browser and context"""
        if self.browser is None or not self.browser.is_connected():
            logger.info("Initializing browser...")
            try:
                # Close any existing resources first
                if self.context:
                    try:
                        await self.context.close()
                    except Exception:
                        pass
                    self.context = None
                if self.browser:
                    try:
                        await self.browser.close()
                    except Exception:
                        pass
                    self.browser = None
                if self.playwright:
                    try:
                        await self.playwright.stop()
                    except Exception:
                        pass
                    self.playwright = None

                self.playwright = await async_playwright().start()
                logger.info("Playwright started")

                # Use Firefox - better at avoiding Amazon bot detection than Chromium
                # playwright-stealth is Chromium-focused, but Firefox has fewer fingerprinting vectors
                self.browser = await self.playwright.firefox.launch(
                    headless=True,
                )
                logger.info("Firefox browser launched")

                # Rotate user agent for each session
                self.user_agent = random.choice(USER_AGENTS)

                self.context = await self.browser.new_context(
                    user_agent=self.user_agent,
                    viewport={'width': 1920, 'height': 1080},
                    locale='en-US',
                    timezone_id='America/New_York',
                    java_script_enabled=True,
                    has_touch=False,
                    is_mobile=False,
                )
                logger.info(f"Context created with UA: {self.user_agent[:50]}...")

            except Exception as e:
                logger.error(f"Failed to initialize browser: {e}")
                raise

    async def _get_browser(self) -> Browser:
        """Get or create browser instance"""
        await self._init_browser()
        return self.browser

    async def _create_page(self) -> Page:
        """Create a new page with stealth settings applied"""
        await self._init_browser()
        page = await self.context.new_page()

        # For Firefox, we skip playwright-stealth (designed for Chromium)
        # Firefox naturally has fewer fingerprinting vectors
        logger.info("Page created (Firefox - native stealth)")

        return page

    async def _simulate_human_behavior(self, page: Page):
        """Simulate human-like behavior on page"""
        try:
            # Random mouse movement
            x = random.randint(100, 800)
            y = random.randint(100, 600)
            await page.mouse.move(x, y, steps=random.randint(5, 15))

            # Random small delay
            await asyncio.sleep(random.uniform(0.5, 1.5))
        except Exception:
            pass  # Don't fail if simulation fails

    def _random_delay(self) -> float:
        """Get a random delay between requests"""
        return random.uniform(2.0, 5.0)

    def _parse_price(self, price_str: str) -> float:
        """Parse price string to float"""
        if not price_str:
            return 0.0

        # Remove currency symbols and whitespace
        cleaned = re.sub(r'[^\d.,]', '', price_str)

        # Handle comma as decimal separator (European format)
        if ',' in cleaned and '.' in cleaned:
            cleaned = cleaned.replace(',', '')
        elif ',' in cleaned:
            cleaned = cleaned.replace(',', '.')

        try:
            return float(cleaned)
        except ValueError:
            return 0.0

    def _extract_asin_from_url(self, url: str) -> Optional[str]:
        """Extract single ASIN from Amazon URL"""
        patterns = [
            r'/dp/([A-Z0-9]{10})',
            r'/gp/product/([A-Z0-9]{10})',
            r'/ASIN/([A-Z0-9]{10})',
        ]

        for pattern in patterns:
            match = re.search(pattern, url, re.IGNORECASE)
            if match:
                return match.group(1).upper()

        return None

    def _extract_asins_from_cart_url(self, cart_url: str) -> Dict[str, int]:
        """Extract ASINs and quantities from cart URL

        Cart URL format: amazon.com/gp/aws/cart/add.html?ASIN.1=XXX&Quantity.1=2&ASIN.2=YYY&Quantity.2=1

        Returns:
            Dict mapping ASIN to quantity
        """
        asins_qty = {}

        # Extract all ASIN.N=XXX patterns
        asin_matches = re.findall(r'ASIN\.(\d+)=([A-Z0-9]{10})', cart_url, re.IGNORECASE)

        for num, asin in asin_matches:
            asin = asin.upper()
            # Try to find corresponding quantity
            qty_match = re.search(rf'Quantity\.{num}=(\d+)', cart_url)
            qty = int(qty_match.group(1)) if qty_match else 1
            asins_qty[asin] = qty

        logger.info(f"Extracted {len(asins_qty)} ASINs from cart URL: {asins_qty}")
        return asins_qty

    async def scrape_cart_url(self, cart_url: str) -> Dict[str, Any]:
        """
        Scrape items from a shared Amazon cart URL

        Amazon blocks direct cart URL access for automated browsers, so we:
        1. First try to extract ASINs and quantities from the URL itself
        2. Then look up each ASIN individually

        Args:
            cart_url: Amazon cart URL (e.g., amazon.com/gp/aws/cart/add.html?...)

        Returns:
            Dict with 'items' list and 'subtotal'
        """
        logger.info(f"Scraping cart URL: {cart_url[:80]}...")

        # Strategy 1: Extract ASINs from URL parameters directly
        asins_qty = self._extract_asins_from_cart_url(cart_url)
        if asins_qty:
            logger.info(f"Extracted {len(asins_qty)} ASINs from URL, looking up each")
            return await self._lookup_asins_with_quantities(asins_qty)

        # Strategy 2: Try to load the page (may be blocked by Amazon)
        page = await self._create_page()
        items = []
        subtotal = 0.0

        try:
            await self._simulate_human_behavior(page)
            await page.goto(cart_url, wait_until='networkidle', timeout=30000)
            await asyncio.sleep(random.uniform(2, 4))

            current_url = page.url
            logger.info(f"Current URL: {current_url}")

            html = await page.content()

            # Check if we got an error page
            if "Something went wrong" in html or len(html) < 5000:
                logger.warning("Got error page, falling back to URL parsing")
                # Try to extract any ASINs from the original URL
                all_asins = re.findall(r'ASIN\.\d+=([A-Z0-9]{10})', cart_url, re.IGNORECASE)
                if all_asins:
                    return await self.lookup_asins([a.upper() for a in all_asins])
                return {'items': [], 'subtotal': 0.0, 'item_count': 0}

            # Try different selectors for cart items
            item_selectors = [
                'div[data-asin]',
                '.sc-list-item',
                '.a-section.a-spacing-mini',
                '[data-item-id]',
            ]

            cart_items = []
            for selector in item_selectors:
                cart_items = await page.query_selector_all(selector)
                if cart_items:
                    logger.info(f"Found {len(cart_items)} items with selector: {selector}")
                    break

            if not cart_items:
                # Extract ASINs from page HTML
                asin_matches = re.findall(r'data-asin="([A-Z0-9]{10})"', html)
                if asin_matches:
                    unique_asins = list(set(asin_matches))
                    logger.info(f"Found {len(unique_asins)} unique ASINs in page")
                    return await self.lookup_asins(unique_asins)

            # Process cart items
            for item_el in cart_items:
                try:
                    item_data = await self._extract_cart_item(item_el, page)
                    if item_data and item_data.get('asin'):
                        items.append(item_data)
                        subtotal += item_data.get('line_total', 0)
                except Exception as e:
                    logger.warning(f"Failed to extract item: {e}")

        except PlaywrightTimeout:
            logger.error("Timeout while scraping cart")
            # Fallback to URL parsing
            all_asins = re.findall(r'ASIN\.\d+=([A-Z0-9]{10})', cart_url, re.IGNORECASE)
            if all_asins:
                return await self.lookup_asins([a.upper() for a in all_asins])
            raise Exception("Cart page load timeout")
        except Exception as e:
            logger.error(f"Error scraping cart: {e}")
            raise
        finally:
            if not page.is_closed():
                await page.close()

        return {
            'items': items,
            'subtotal': subtotal,
            'item_count': len(items)
        }

    async def _lookup_asins_with_quantities(self, asins_qty: Dict[str, int]) -> Dict[str, Any]:
        """Look up ASINs and apply quantities from cart URL"""
        items = []

        for asin, qty in asins_qty.items():
            page = None
            try:
                page = await self._create_page()
                await self._simulate_human_behavior(page)
                item_data = await self._lookup_single_asin(page, asin)
                if item_data:
                    item_data['quantity'] = qty
                    item_data['line_total'] = item_data['unit_price'] * qty
                    items.append(item_data)
                await asyncio.sleep(self._random_delay())
            except Exception as e:
                logger.warning(f"Failed to lookup ASIN {asin}: {e}")
                items.append({
                    'asin': asin,
                    'title': f'Product {asin}',
                    'unit_price': 0.0,
                    'quantity': qty,
                    'line_total': 0.0,
                    'product_url': f'https://www.amazon.com/dp/{asin}'
                })
            finally:
                if page and not page.is_closed():
                    await page.close()

        subtotal = sum(item.get('line_total', 0) for item in items)

        return {
            'items': items,
            'subtotal': subtotal,
            'item_count': len(items)
        }

    async def _extract_cart_item(self, item_el, page: Page) -> Optional[Dict[str, Any]]:
        """Extract item data from a cart item element"""
        item = {}

        # Get ASIN
        asin = await item_el.get_attribute('data-asin')
        if not asin:
            item_id = await item_el.get_attribute('data-item-id')
            if item_id:
                asin = item_id.split('|')[0] if '|' in item_id else item_id

        if not asin:
            return None

        item['asin'] = asin

        # Get title
        title_selectors = [
            '.sc-product-title',
            '.a-truncate-cut',
            'span.a-size-medium',
            'a[href*="/dp/"]',
        ]

        for selector in title_selectors:
            try:
                title_el = await item_el.query_selector(selector)
                if title_el:
                    title = await title_el.inner_text()
                    if title and len(title) > 3:
                        item['title'] = title.strip()[:200]
                        break
            except Exception:
                continue

        if 'title' not in item:
            item['title'] = f"Product {asin}"

        # Get price
        price_selectors = [
            '.sc-product-price',
            '.a-price .a-offscreen',
            'span.a-price-whole',
        ]

        for selector in price_selectors:
            try:
                price_el = await item_el.query_selector(selector)
                if price_el:
                    price_text = await price_el.inner_text()
                    price = self._parse_price(price_text)
                    if price > 0:
                        item['unit_price'] = price
                        break
            except Exception:
                continue

        if 'unit_price' not in item:
            item['unit_price'] = 0.0

        # Get quantity
        qty_selectors = [
            'select[name*="quantity"] option[selected]',
            'input[name*="quantity"]',
            '.sc-quantity-textfield input',
        ]

        item['quantity'] = 1
        for selector in qty_selectors:
            try:
                qty_el = await item_el.query_selector(selector)
                if qty_el:
                    qty_val = await qty_el.get_attribute('value')
                    if not qty_val:
                        qty_val = await qty_el.inner_text()
                    if qty_val:
                        qty = int(re.sub(r'\D', '', qty_val) or 1)
                        if qty > 0:
                            item['quantity'] = qty
                            break
            except Exception:
                continue

        # Calculate line total
        item['line_total'] = item['unit_price'] * item['quantity']

        # Get image URL
        try:
            img_el = await item_el.query_selector('img')
            if img_el:
                item['image_url'] = await img_el.get_attribute('src')
        except Exception:
            pass

        # Build product URL
        item['product_url'] = f"https://www.amazon.com/dp/{asin}"

        return item

    async def lookup_asins(self, asins: List[str]) -> Dict[str, Any]:
        """
        Look up product details for a list of ASINs

        Args:
            asins: List of Amazon ASINs

        Returns:
            Dict with 'items' list and 'subtotal'
        """
        logger.info(f"Looking up {len(asins)} ASINs")

        items = []

        try:
            # Create a fresh page for each lookup to avoid stale state
            for asin in asins[:10]:  # Limit to 10 items
                page = None
                try:
                    page = await self._create_page()
                    await self._simulate_human_behavior(page)
                    item_data = await self._lookup_single_asin(page, asin)
                    if item_data:
                        items.append(item_data)
                    # Randomized delay between requests
                    await asyncio.sleep(self._random_delay())
                except Exception as e:
                    logger.warning(f"Failed to lookup ASIN {asin}: {e}")
                    import traceback
                    traceback.print_exc()
                    # Add minimal item data on failure
                    items.append({
                        'asin': asin,
                        'title': f'Product {asin}',
                        'unit_price': 0.0,
                        'quantity': 1,
                        'line_total': 0.0,
                        'product_url': f'https://www.amazon.com/dp/{asin}'
                    })
                finally:
                    if page and not page.is_closed():
                        try:
                            await page.close()
                        except Exception:
                            pass
        except Exception as e:
            logger.error(f"Error in lookup_asins: {e}")

        subtotal = sum(item.get('line_total', 0) for item in items)

        return {
            'items': items,
            'subtotal': subtotal,
            'item_count': len(items)
        }

    async def _lookup_single_asin(self, page: Page, asin: str) -> Optional[Dict[str, Any]]:
        """Look up a single ASIN"""
        url = f"https://www.amazon.com/dp/{asin}"
        logger.info(f"Looking up ASIN: {asin}")

        try:
            # Check if page is still valid
            if page.is_closed():
                logger.warning(f"Page was closed, creating new one for {asin}")
                page = await self._create_page()
                await self._simulate_human_behavior(page)

            logger.info(f"Navigating to {url}")
            await page.goto(url, wait_until='networkidle', timeout=30000)
            logger.info(f"Page loaded for {asin}")

            # Wait for product title to appear (indicates page fully loaded)
            try:
                await page.wait_for_selector('#productTitle', timeout=10000)
            except Exception:
                # If title doesn't appear, wait a bit and continue anyway
                await asyncio.sleep(random.uniform(1.5, 3.0))

            item = {'asin': asin, 'product_url': url}

            # Get title
            title_el = await page.query_selector('#productTitle')
            if title_el:
                item['title'] = (await title_el.inner_text()).strip()[:200]
            else:
                item['title'] = f'Product {asin}'

            # Get price
            price_selectors = [
                '.a-price .a-offscreen',
                '#priceblock_ourprice',
                '#priceblock_dealprice',
                'span.a-price-whole',
            ]

            for selector in price_selectors:
                try:
                    price_el = await page.query_selector(selector)
                    if price_el:
                        price_text = await price_el.inner_text()
                        price = self._parse_price(price_text)
                        if price > 0:
                            item['unit_price'] = price
                            break
                except Exception:
                    continue

            if 'unit_price' not in item:
                item['unit_price'] = 0.0

            item['quantity'] = 1
            item['line_total'] = item['unit_price']

            # Get image
            try:
                img_el = await page.query_selector('#landingImage, #imgBlkFront')
                if img_el:
                    item['image_url'] = await img_el.get_attribute('src')
            except Exception:
                pass

            return item

        except PlaywrightTimeout:
            logger.warning(f"Timeout looking up ASIN: {asin}")
            return None
        except Exception as e:
            logger.error(f"Error looking up ASIN {asin}: {e}")
            return None

    async def close(self):
        """Close browser and playwright"""
        if self.browser:
            await self.browser.close()
            self.browser = None
        if self.playwright:
            await self.playwright.stop()
            self.playwright = None
