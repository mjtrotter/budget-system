/**
 * ============================================================================
 * PLAYWRIGHT CART SCRAPER - APPS SCRIPT INTEGRATION
 * ============================================================================
 * Copy this code into your Apps Script Amazon_Engine.js or Config.gs
 * This provides a backup scraping service when RapidAPI fails
 * ============================================================================
 */

// Add to your CONFIG object:
const PLAYWRIGHT_SCRAPER_CONFIG = {
  // Replace with your Cloud Run URL after deployment
  SERVICE_URL: 'https://keswick-cart-scraper-XXXXXX-uc.a.run.app',
  API_KEY: 'keswick-cart-scraper-2024',
  TIMEOUT_MS: 60000,  // 60 second timeout
  ENABLED: true       // Set to false to disable
};

/**
 * Fetch cart data using the Playwright scraper service
 * Use this as a backup when direct fetching or RapidAPI fails
 *
 * @param {string} cartUrl - Amazon cart URL to scrape
 * @return {Object} Result with items array and subtotal
 */
function fetchCartFromPlaywrightService(cartUrl) {
  if (!PLAYWRIGHT_SCRAPER_CONFIG.ENABLED) {
    console.log('⚠️ Playwright scraper is disabled');
    return { success: false, error: 'Service disabled' };
  }

  console.log('🎭 Attempting Playwright scraper service...');

  try {
    const payload = {
      mode: 'cart_url',
      cart_url: cartUrl
    };

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PLAYWRIGHT_SCRAPER_CONFIG.API_KEY}`
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
      timeout: PLAYWRIGHT_SCRAPER_CONFIG.TIMEOUT_MS
    };

    const response = UrlFetchApp.fetch(
      `${PLAYWRIGHT_SCRAPER_CONFIG.SERVICE_URL}/scrape-cart`,
      options
    );

    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (statusCode !== 200) {
      console.error(`❌ Playwright service returned ${statusCode}: ${responseText}`);
      return {
        success: false,
        error: `HTTP ${statusCode}`,
        statusCode: statusCode
      };
    }

    const result = JSON.parse(responseText);

    if (result.success) {
      console.log(`✅ Playwright scraper found ${result.item_count} items, subtotal: $${result.cart_subtotal}`);

      // Transform to match expected format
      return {
        success: true,
        items: result.items.map(item => ({
          asin: item.asin,
          title: item.title,
          price: item.unit_price,
          quantity: item.quantity,
          subtotal: item.line_total,
          imageUrl: item.image_url,
          productUrl: item.product_url
        })),
        subtotal: result.cart_subtotal,
        itemCount: result.item_count
      };
    } else {
      console.error(`❌ Playwright scraper failed: ${result.error}`);
      return { success: false, error: result.error };
    }

  } catch (error) {
    console.error(`❌ Playwright service error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Lookup product details for ASINs using Playwright scraper
 *
 * @param {Array<string>} asins - List of ASINs to look up
 * @return {Object} Result with items array
 */
function lookupASINsFromPlaywrightService(asins) {
  if (!PLAYWRIGHT_SCRAPER_CONFIG.ENABLED) {
    console.log('⚠️ Playwright scraper is disabled');
    return { success: false, error: 'Service disabled' };
  }

  console.log(`🎭 Looking up ${asins.length} ASINs via Playwright service...`);

  try {
    const payload = {
      mode: 'asin_list',
      asins: asins
    };

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PLAYWRIGHT_SCRAPER_CONFIG.API_KEY}`
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
      timeout: PLAYWRIGHT_SCRAPER_CONFIG.TIMEOUT_MS
    };

    const response = UrlFetchApp.fetch(
      `${PLAYWRIGHT_SCRAPER_CONFIG.SERVICE_URL}/scrape-cart`,
      options
    );

    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (statusCode !== 200) {
      console.error(`❌ Playwright service returned ${statusCode}`);
      return { success: false, error: `HTTP ${statusCode}` };
    }

    const result = JSON.parse(responseText);

    if (result.success) {
      console.log(`✅ Playwright scraper looked up ${result.item_count} items`);
      return {
        success: true,
        items: result.items.map(item => ({
          asin: item.asin,
          title: item.title,
          price: item.unit_price,
          quantity: item.quantity || 1,
          subtotal: item.line_total,
          imageUrl: item.image_url,
          productUrl: item.product_url
        })),
        subtotal: result.cart_subtotal,
        itemCount: result.item_count
      };
    } else {
      return { success: false, error: result.error };
    }

  } catch (error) {
    console.error(`❌ Playwright service error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Test the Playwright scraper service connection
 * Run this manually to verify the service is working
 */
function testPlaywrightScraperService() {
  console.log('🧪 Testing Playwright Scraper Service...\n');

  // Test 1: Health check
  console.log('1️⃣ Testing health endpoint...');
  try {
    const response = UrlFetchApp.fetch(
      `${PLAYWRIGHT_SCRAPER_CONFIG.SERVICE_URL}/health`,
      { muteHttpExceptions: true }
    );

    const statusCode = response.getResponseCode();
    if (statusCode === 200) {
      console.log('   ✅ Health check passed');
    } else {
      console.log(`   ❌ Health check failed: HTTP ${statusCode}`);
      return;
    }
  } catch (error) {
    console.error(`   ❌ Cannot reach service: ${error.message}`);
    console.log('   👉 Make sure the Cloud Run service is deployed');
    return;
  }

  // Test 2: ASIN lookup
  console.log('\n2️⃣ Testing ASIN lookup...');
  const testAsin = 'B07ZPKN6YR';  // Amazon Basics USB Cable
  const asinResult = lookupASINsFromPlaywrightService([testAsin]);

  if (asinResult.success && asinResult.items.length > 0) {
    console.log('   ✅ ASIN lookup successful');
    console.log(`   📦 Product: ${asinResult.items[0].title}`);
    console.log(`   💰 Price: $${asinResult.items[0].price}`);
  } else {
    console.log(`   ⚠️ ASIN lookup returned: ${JSON.stringify(asinResult)}`);
  }

  console.log('\n🎉 Playwright scraper service test complete!');
}

/**
 * INTEGRATION POINT:
 *
 * To use this in your fallbackCartVerification method, add this before
 * returning the fallback verification:
 *
 * ```javascript
 * async fallbackCartVerification(consolidatedCart, originalOrders) {
 *   try {
 *     console.log('🔄 Using fallback cart verification method...');
 *
 *     // TRY PLAYWRIGHT SCRAPER FIRST
 *     const playwrightResult = fetchCartFromPlaywrightService(consolidatedCart.cartUrl);
 *     if (playwrightResult.success) {
 *       console.log('✅ Playwright scraper succeeded');
 *       return this.matchAndVerifyPrices(
 *         playwrightResult.items,
 *         consolidatedCart,
 *         originalOrders
 *       );
 *     }
 *     console.log('⚠️ Playwright scraper failed, falling back to direct fetch...');
 *
 *     // Original fetch logic continues here...
 *     const cartData = await this.fetchConsolidatedCart(consolidatedCart.cartUrl);
 *     // ...rest of method
 *   }
 * }
 * ```
 */
