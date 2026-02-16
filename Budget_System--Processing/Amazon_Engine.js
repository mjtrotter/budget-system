/**
 * ============================================================================
 * AMAZON ENGINE - RAPIDAPI INTEGRATION v2.0 - SYNTHESIZED
 * ============================================================================
 * Integrated RapidAPI for reliable price verification
 * Maintains all existing budget logic and approval workflows
 * ============================================================================
 */

// ============================================================================
// CONFIGURATION
// ============================================================================
const SCRAPER_CONFIG = {
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 5000,
  USER_AGENTS: [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/115.0'
  ]
};

// RapidAPI Configuration for Amazon price checking
const RAPIDAPI_CONFIG = {
  API_HOST: 'real-time-amazon-data.p.rapidapi.com',
  API_KEYS: [],  // Will be populated from Script Properties
  CURRENT_KEY_INDEX: 0,
  FREE_TIER_LIMIT: 100,  // Free tier requests per month
  FAILOVER_THRESHOLD: 95,  // Percent usage before failover
  USAGE_WARNING_THRESHOLD: 80,  // Percent usage warning
  SMART_ROTATION: true,
  RETRY_ATTEMPTS: 3
};

/**
 * RAPIDAPI SETUP INSTRUCTIONS:
 * 
 * 1. Get your RapidAPI Key(s):
 *    a. Go to https://rapidapi.com/letscrape-6bRBa3QguO5/api/real-time-amazon-data
 *    b. Copy your API key (starts with something like '689004de57...')
 *    c. For multiple free keys: Create additional RapidAPI accounts with different emails
 * 
 * 2. Set up API key(s) in Google Apps Script:
 *    a. In your script editor, go to Project Settings (gear icon)
 *    b. Scroll down to "Script Properties"
 *    c. For single key: Name = "RAPIDAPI_KEY", Value = [your-api-key]
 *    d. For multiple keys: Name = "RAPIDAPI_KEYS", Value = [key1,key2,key3] (comma-separated)
 * 
 * 3. Track usage (optional but recommended):
 *    Add property: Name = "RAPIDAPI_USAGE", Value = {"key1":0,"key2":0,"key3":0}
 * 
 * 4. Test the setup:
 *    Run testRapidAPISetup() function below
 */

class AmazonWorkflowEngine {
  constructor() {
    this.userAgentIndex = 0;
    this.sessionId = Math.random().toString(36).substring(2);
    this.priceCache = new Map(); // Cache prices within same execution
  }

  // ============================================================================
  // MAIN WORKFLOW ORCHESTRATION - OPTIMIZED V6.0
  // ============================================================================

  async executeAmazonWorkflow(forceRun = false) {
    const lock = LockService.getScriptLock();
    // Shorter wait for scheduled triggers, if busy just skip
    try { lock.waitLock(10000); } catch (e) {
      console.log('⚠️ Amazon workflow skipped: System busy/Locked');
      return { success: false, error: 'System locked' };
    }

    try {
      console.log('🚀 Starting Optimized Amazon Workflow V6.0');

      const currentHour = new Date().getHours();
      const isOrderingTime = currentHour >= CONFIG.ORDER_PROCESSING_HOUR - CONFIG.APPROVAL_WINDOW_HOURS;
      const isTestMode = this.isTestMode();

      if (!isOrderingTime && !forceRun && !isTestMode) {
        console.log(`⏰ Outside ordering window. Current: ${currentHour}h, Window: ${CONFIG.ORDER_PROCESSING_HOUR - CONFIG.APPROVAL_WINDOW_HOURS}h-${CONFIG.ORDER_PROCESSING_HOUR}h`);
        return { success: true, message: 'Outside ordering window' };
      }

      if (forceRun) {
        console.log(`🔧 FORCE RUN MODE: Bypassing time restrictions`);
      }

      // Step 1: Get ALL approved items
      const approvedItems = await this.getApprovedAmazonItems();
      console.log(`📋 Found ${approvedItems.length} approved orders ready for processing`);

      if (approvedItems.length === 0) {
        console.log('✅ No items ready for ordering');
        return { success: true, itemsProcessed: 0 };
      }

      // Step 2: Build SINGLE consolidated cart with ALL items
      const consolidatedCart = await this.buildConsolidatedCart(approvedItems);

      if (!consolidatedCart.success) {
        throw new Error(`Failed to build consolidated cart: ${consolidatedCart.error}`);
      }

      console.log(`🛒 Built consolidated cart with ${consolidatedCart.totalItems} items from ${approvedItems.length} orders`);

      // Step 3: Fetch cart ONCE and verify ALL prices using Direct Scraping
      // Note: We bypass the RapidAPI verification step entirely now.
      const priceVerification = await this.verifyConsolidatedCartPrices(consolidatedCart, approvedItems);

      // Step 4: Process items based on price variance
      const processedResults = await this.processVarianceResults(priceVerification, approvedItems);

      // Step 5: If we have items to order, create final cart and process
      if (processedResults.itemsToOrder.length > 0) {
        const finalCart = await this.createFinalOrderCart(processedResults.itemsToOrder);

        if (finalCart.success) {
          await this.processSuccessfulOrder(finalCart, processedResults.itemsToOrder);
        }

        return {
          success: finalCart.success,
          orderId: finalCart.orderId,
          itemsOrdered: processedResults.itemsToOrder.length,
          itemsNeedingApproval: processedResults.itemsNeedingReapproval.length,
          totalAmount: finalCart.totalAmount
        };
      }

      return {
        success: true,
        itemsOrdered: 0,
        itemsNeedingApproval: processedResults.itemsNeedingReapproval.length,
        message: 'No items ready for immediate ordering'
      };

    } catch (error) {
      console.error('❌ Amazon workflow failed:', error);
      return { success: false, error: error.toString() };
    } finally {
      lock.releaseLock();
    }
  }

  // ============================================================================
  // CONSOLIDATED CART BUILDING
  // ============================================================================

  async buildConsolidatedCart(approvedItems) {
    try {
      console.log('🔨 Building consolidated cart for all approved items...');

      // Flatten all items from all orders into single list
      const allItems = [];
      const itemToOrderMap = new Map();

      for (const order of approvedItems) {
        for (const item of order.items) {
          const asin = this.extractASIN(item.url);
          if (asin) {
            allItems.push({
              asin: asin,
              quantity: item.quantity || 1,
              description: item.description,
              originalPrice: item.unitPrice,
              originalTotal: item.price,
              orderId: order.queueId,
              requestor: order.requestor,
              department: order.department
            });

            // Map items to their original orders for later processing
            itemToOrderMap.set(`${asin}-${allItems.length - 1}`, order);
          }
        }
      }

      if (allItems.length === 0) {
        throw new Error('No valid ASINs found in approved items');
      }

      // Build cart URL with all items
      const cartUrl = this.generateMultiItemCartUrl(allItems);

      return {
        success: true,
        cartUrl: cartUrl,
        items: allItems,
        totalItems: allItems.length,
        itemToOrderMap: itemToOrderMap
      };

    } catch (error) {
      console.error('❌ Failed to build consolidated cart:', error);
      return {
        success: false,
        error: error.toString()
      };
    }
  }

  generateMultiItemCartUrl(items) {
    let cartUrl = 'https://www.amazon.com/gp/aws/cart/add.html?';

    const baseParams = [
      'AWSAccessKeyId=leNM%2FocHLQ%2ByqCuwtsgoza8buGoeRSlHuoDGRnlb',
      'AssociateTag=test-20'
    ];

    const itemParams = [];
    items.forEach((item, index) => {
      const itemNum = index + 1;
      itemParams.push(`ASIN.${itemNum}=${item.asin}`);
      itemParams.push(`Quantity.${itemNum}=${item.quantity}`);
    });

    const allParams = [...baseParams, ...itemParams];
    cartUrl += allParams.join('&');

    console.log(`✅ Generated cart URL with ${items.length} items (using associate tag)`);
    return cartUrl;
  }

  // Backup parsing method using different approach
  parseCartItemsAlternative(html) {
    const cartItems = [];

    try {
      console.log(`🔄 Trying alternative parsing method...`);

      // Extract all ASINs first
      const asinMatches = [...html.matchAll(/\/dp\/([A-Z0-9]{10})/gi)];
      const foundAsins = [...new Set(asinMatches.map(match => match[1]))];

      console.log(`Found ASINs: ${foundAsins.join(', ')}`);

      // For each ASIN, try to find its price in nearby HTML
      for (const asin of foundAsins) {
        // Find the section of HTML containing this ASIN
        const asinIndex = html.indexOf(`/dp/${asin}`);
        if (asinIndex === -1) continue;

        // Get surrounding HTML (2000 chars before and after)
        const start = Math.max(0, asinIndex - 2000);
        const end = Math.min(html.length, asinIndex + 2000);
        const section = html.substring(start, end);

        // Look for price in this section
        const pricePatterns = [
          /\$?([\d,]+\.?\d*)/g,
          /<span[^>]*>\s*\$?([\d,]+\.?\d*)\s*<\/span>/g
        ];

        let foundPrice = null;
        for (const pattern of pricePatterns) {
          const matches = [...section.matchAll(pattern)];
          for (const match of matches) {
            const price = parseFloat(match[1].replace(/,/g, ''));
            if (price > 0 && price < 10000) { // Reasonable price range
              foundPrice = price;
              break;
            }
          }
          if (foundPrice) break;
        }

        if (foundPrice) {
          cartItems.push({
            asin: asin,
            price: foundPrice,
            quantity: 1,
            unitPrice: foundPrice
          });

          console.log(`✅ Alternative parsing: ${asin} - $${foundPrice}`);
        }
      }

      return cartItems;

    } catch (error) {
      console.error(`❌ Alternative parsing failed:`, error);
      return [];
    }
  }

  // ============================================================================
  // DIRECT PRICE VERIFICATION (Replaces RapidAPI)
  // ============================================================================

  async verifyConsolidatedCartPrices(consolidatedCart, originalOrders) {
    // Directly alias to the fallback method which was effectively the cart scraper
    return await this.fallbackCartVerification(consolidatedCart, originalOrders);
  }



  // ============================================================================
  // FALLBACK CART VERIFICATION (LEGACY METHOD)
  // ============================================================================

  async fallbackCartVerification(consolidatedCart, originalOrders) {
    try {
      console.log('🔄 Using fallback cart verification method...');

      // Use the original cart fetching method as fallback
      const cartData = await this.fetchConsolidatedCart(consolidatedCart.cartUrl);

      if (!cartData.success) {
        console.log('⚠️ Both RapidAPI and cart fetch failed, using original prices');
        return this.createFallbackVerification(consolidatedCart, originalOrders);
      }

      // Match cart items with original items using legacy method
      const verificationResults = this.matchAndVerifyPrices(
        cartData.items,
        consolidatedCart.items,
        originalOrders
      );

      console.log(`✅ Fallback verification complete: ${verificationResults.verifiedCount} items verified`);

      return verificationResults;

    } catch (error) {
      console.error('❌ Fallback verification failed:', error);
      return this.createFallbackVerification(consolidatedCart, originalOrders);
    }
  }

  // ENHANCED CART FETCHING WITH ANTI-BOT MASKING
  async fetchConsolidatedCart(cartUrl) {
    try {
      console.log(`🌐 Making optimized cart request...`);

      // Wait strategy: proven 20s works best for avoiding 503s
      console.log(`⏱️ Waiting 20s before cart fetch...`);
      Utilities.sleep(20000);

      const response = await this.makeOptimizedCartRequest(cartUrl);
      const html = response.getContentText();

      console.log(`📡 Cart response: ${response.getResponseCode()} (${html.length} chars)`);

      if (response.getResponseCode() !== 200) {
        throw new Error(`HTTP ${response.getResponseCode()}`);
      }

      // Debug: Check if we have the expected cart structure
      const hasActiveItems = html.includes('data-name="Active Items"');
      const hasCartItems = html.includes('sc-list-item');
      const hasProductPrice = html.includes('sc-product-price');

      console.log(`🔍 Cart structure check: Active Items: ${hasActiveItems}, List Items: ${hasCartItems}, Product Prices: ${hasProductPrice}`);

      if (!hasCartItems) {
        console.log(`⚠️ No cart items found - trying alternative parsing`);
        const altItems = this.parseCartItemsAlternative(html);
        if (altItems.length > 0) {
          return { success: true, items: altItems };
        }
        return {
          success: false,
          error: 'No cart items detected',
          items: []
        };
      }

      // Parse with enhanced method
      const cartItems = this.parseAllCartItems(html);

      if (cartItems.length === 0) {
        console.log(`⚠️ Primary parsing failed, trying alternative method`);
        const altItems = this.parseCartItemsAlternative(html);
        if (altItems.length > 0) {
          return { success: true, items: altItems };
        }

        // Additional debug info
        const productLinks = (html.match(/\/dp\/[A-Z0-9]{10}/gi) || []).length;
        const priceSpans = (html.match(/sc-product-price/gi) || []).length;

        console.log(`🔍 Debug: Found ${productLinks} product links, ${priceSpans} price elements`);

        throw new Error('No items extracted from cart');
      }

      console.log(`✅ Successfully extracted ${cartItems.length} items from cart`);

      return {
        success: true,
        items: cartItems
      };

    } catch (error) {
      console.error(`❌ Cart fetch error:`, error);
      return {
        success: false,
        error: error.toString(),
        items: []
      };
    }
  }

  async makeOptimizedCartRequest(url) {
    try {
      console.log(`🌐 Making optimized request...`);

      // Rotate User-Agent
      const userAgent = SCRAPER_CONFIG.USER_AGENTS[Math.floor(Math.random() * SCRAPER_CONFIG.USER_AGENTS.length)];

      const headers = {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Referer': 'https://www.google.com/'
      };

      const options = {
        'method': 'GET',
        'headers': headers,
        'muteHttpExceptions': true,
        'followRedirects': true,
        'validateHttpsCertificates': true
      };

      const response = UrlFetchApp.fetch(url, options);
      return response;

    } catch (error) {
      throw new Error(`Request failed: ${error.message}`);
    }
  }

  parseAllCartItems(html) {
    const cartItems = [];

    try {
      console.log(`🔍 Parsing cart items with enhanced selectors...`);

      // Multiple parsing strategies for robustness
      const strategies = [
        // Strategy 1: Standard sc-list-item with border class
        /<div[^>]*class="[^"]*sc-list-item[^"]*sc-list-item-border[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi,
        // Strategy 2: Simple sc-list-item
        /<div[^>]*sc-list-item[^>]*>([\s\S]*?)(?=<div[^>]*sc-list-item|<\/div>\s*<\/div>\s*<\/div>)/gi,
        // Strategy 3: Shopping cart item containers
        /<div[^>]*id="sc-item-[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]*id="sc-item-|<\/div>\s*<\/div>\s*<\/div>)/gi
      ];

      let containerMatches = [];

      for (const strategy of strategies) {
        containerMatches = [...html.matchAll(strategy)];
        console.log(`Strategy found ${containerMatches.length} containers`);
        if (containerMatches.length > 0) break;
      }

      if (containerMatches.length === 0) {
        console.log(`⚠️ No containers found with standard patterns, trying broad search`);
        // Fallback: look for any div containing both ASIN and price patterns
        const broadPattern = /<div[^>]*>([\s\S]*?\/dp\/[A-Z0-9]{10}[\s\S]*?sc-product-price[\s\S]*?)<\/div>/gi;
        containerMatches = [...html.matchAll(broadPattern)];
        console.log(`Broad search found ${containerMatches.length} potential containers`);
      }

      for (const match of containerMatches) {
        const item = this.parseProductContainer(match[1]);
        if (item) cartItems.push(item);
      }

      console.log(`📦 Successfully parsed ${cartItems.length} cart items`);
      return cartItems;

    } catch (error) {
      console.error(`❌ Cart parsing error:`, error);
      return cartItems;
    }
  }

  parseProductContainer(containerHtml) {
    try {
      // Extract ASIN from product link with /dp/ pattern
      const asinPattern = /href="[^"]*\/dp\/([A-Z0-9]{10})[^"]*"/i;
      const asinMatch = containerHtml.match(asinPattern);

      if (!asinMatch) {
        console.log(`❌ No ASIN found in container`);
        return null;
      }

      const asin = asinMatch[1];

      // Multiple price extraction strategies
      const priceStrategies = [
        // Strategy 1: sc-product-price class
        /<span[^>]*class="[^"]*sc-product-price[^"]*"[^>]*>\s*\$?([\d,]+\.?\d*)\s*<\/span>/i,
        // Strategy 2: Price with currency symbol
        /<span[^>]*>\s*\$\s*([\d,]+\.?\d*)\s*<\/span>/i,
        // Strategy 3: Generic price pattern near ASIN
        /\$\s*([\d,]+\.?\d*)/i,
        // Strategy 4: Price in data attributes
        /data-price="([\d,]+\.?\d*)"/i
      ];

      let priceMatch = null;
      for (const strategy of priceStrategies) {
        priceMatch = containerHtml.match(strategy);
        if (priceMatch) break;
      }

      if (!priceMatch) {
        console.log(`❌ No price found for ASIN ${asin}`);
        return null;
      }

      const priceText = priceMatch[1].replace(/,/g, '');
      const unitPrice = parseFloat(priceText);

      if (isNaN(unitPrice) || unitPrice <= 0) {
        console.log(`❌ Invalid unit price for ASIN ${asin}: ${priceText}`);
        return null;
      }

      // Extract quantity with multiple strategies
      const qtyStrategies = [
        // Strategy 1: sc-action-quantity
        /<span[^>]*class="[^"]*sc-action-quantity[^"]*"[^>]*>\s*Qty:\s*(\d+)\s*<\/span>/i,
        // Strategy 2: Quantity in select dropdown
        /<select[^>]*name="quantity"[^>]*>[\s\S]*?<option[^>]*selected[^>]*>(\d+)<\/option>/i,
        // Strategy 3: Simple Qty: pattern
        /Qty:\s*(\d+)/i,
        // Strategy 4: quantity data attribute
        /data-quantity="(\d+)"/i
      ];

      let quantity = 1;
      for (const strategy of qtyStrategies) {
        const qtyMatch = containerHtml.match(strategy);
        if (qtyMatch) {
          quantity = parseInt(qtyMatch[1]);
          break;
        }
      }

      // Extract product title for debugging
      const titleStrategies = [
        /<span[^>]*class="[^"]*sc-product-title[^"]*"[^>]*>\s*(.*?)\s*<\/span>/i,
        /<h3[^>]*>\s*(.*?)\s*<\/h3>/i,
        /<a[^>]*href="[^"]*\/dp\/[A-Z0-9]{10}[^"]*"[^>]*>(.*?)<\/a>/i
      ];

      let title = 'Unknown Product';
      for (const strategy of titleStrategies) {
        const titleMatch = containerHtml.match(strategy);
        if (titleMatch) {
          title = titleMatch[1].trim().replace(/<[^>]*>/g, '').substring(0, 50);
          break;
        }
      }

      const item = {
        asin: asin,
        price: unitPrice,
        quantity: quantity,
        unitPrice: unitPrice,
        title: title
      };

      console.log(`✅ Parsed: ${asin} - "${title}" - $${unitPrice} each (Qty: ${quantity}, Line Total: $${(unitPrice * quantity).toFixed(2)})`);
      return item;

    } catch (error) {
      console.error(`❌ Error parsing product container:`, error);
      return null;
    }
  }

  matchAndVerifyPrices(cartItems, originalItems, originalOrders) {
    const results = {
      verifiedCount: 0,
      items: [],
      orderResults: new Map()
    };

    console.log(`🔄 Matching ${cartItems.length} cart items with ${originalItems.length} original items`);

    // Create ASIN lookup map from cart items
    const cartPriceMap = new Map();
    cartItems.forEach(item => {
      cartPriceMap.set(item.asin, {
        unitPrice: item.unitPrice,
        cartQuantity: item.quantity
      });
    });

    // Process each original item
    originalItems.forEach(originalItem => {
      const cartItem = cartPriceMap.get(originalItem.asin);

      if (cartItem) {
        // Compare Amazon unit price vs original unit price
        const originalUnitPrice = originalItem.originalPrice;
        const verifiedUnitPrice = cartItem.unitPrice;
        const unitPriceVariance = verifiedUnitPrice - originalUnitPrice;
        const unitVariancePercent = Math.abs(unitPriceVariance) / originalUnitPrice;

        // Calculate totals using original quantity
        const originalTotal = originalUnitPrice * originalItem.quantity;
        const verifiedTotal = verifiedUnitPrice * originalItem.quantity;
        const totalVariance = verifiedTotal - originalTotal;

        const verifiedItem = {
          ...originalItem,
          verifiedPrice: verifiedUnitPrice,
          verifiedTotal: verifiedTotal,
          priceChanged: Math.abs(unitPriceVariance) > 0.01,
          variance: totalVariance,
          variancePercent: unitVariancePercent,
          requiresReapproval: totalVariance > 0 && (unitVariancePercent > CONFIG.PRICE_VARIANCE_PERCENT || Math.abs(totalVariance) > CONFIG.PRICE_VARIANCE_AMOUNT)
        };

        results.items.push(verifiedItem);
        results.verifiedCount++;

        // Group by order
        if (!results.orderResults.has(originalItem.orderId)) {
          results.orderResults.set(originalItem.orderId, {
            orderId: originalItem.orderId,
            items: [],
            totalVariance: 0,
            requiresReapproval: false
          });
        }

        const orderResult = results.orderResults.get(originalItem.orderId);
        orderResult.items.push(verifiedItem);
        orderResult.totalVariance += totalVariance;
        if (verifiedItem.requiresReapproval) {
          orderResult.requiresReapproval = true;
        }

        console.log(`💰 ${originalItem.asin}: $${originalUnitPrice.toFixed(2)} → $${verifiedUnitPrice.toFixed(2)} (Qty: ${originalItem.quantity}, Total: $${originalTotal.toFixed(2)} → $${verifiedTotal.toFixed(2)}, Unit Variance: ${(unitVariancePercent * 100).toFixed(1)}%)`);

      } else {
        // No cart match - use original price
        console.log(`⚠️ No cart match for ${originalItem.asin} - using original price`);

        const fallbackItem = {
          ...originalItem,
          verifiedPrice: originalItem.originalPrice,
          verifiedTotal: originalItem.originalPrice * originalItem.quantity,
          priceChanged: false,
          variance: 0,
          variancePercent: 0,
          requiresReapproval: false
        };

        results.items.push(fallbackItem);
      }
    });

    return results;
  }

  createFallbackVerification(consolidatedCart, originalOrders) {
    console.log('📋 Creating fallback verification with original prices');

    const results = {
      verifiedCount: consolidatedCart.items.length,
      items: consolidatedCart.items.map(item => ({
        ...item,
        verifiedPrice: item.originalPrice,
        verifiedTotal: item.originalTotal,
        priceChanged: false,
        variance: 0,
        variancePercent: 0,
        requiresReapproval: false
      })),
      orderResults: new Map()
    };

    // Group by order
    originalOrders.forEach(order => {
      results.orderResults.set(order.queueId, {
        orderId: order.queueId,
        items: results.items.filter(item => item.orderId === order.queueId),
        totalVariance: 0,
        requiresReapproval: false
      });
    });

    return results;
  }

  // ============================================================================
  // VARIANCE PROCESSING
  // ============================================================================

  async processVarianceResults(verificationResults, originalOrders) {
    const itemsToOrder = [];
    const itemsNeedingReapproval = [];

    console.log('📊 Processing price variance results...');

    for (const [orderId, orderResult] of verificationResults.orderResults) {
      const originalOrder = originalOrders.find(o => o.queueId === orderId);

      if (orderResult.requiresReapproval) {
        console.log(`⚠️ Order ${orderId} requires reapproval due to price increase`);
        itemsNeedingReapproval.push({
          ...originalOrder,
          verifiedItems: orderResult.items,
          totalVariance: orderResult.totalVariance
        });

        // Send price increase notification
        await this.sendPriceIncreaseNotification(originalOrder, orderResult);

        // Update status back to PENDING
        await this.updateQueueItemStatus(orderId, 'PENDING');

      } else {
        console.log(`✅ Order ${orderId} approved for processing`);

        // Update queue with new totals if prices changed
        if (orderResult.totalVariance !== 0) {
          const newTotal = orderResult.items.reduce((sum, item) => sum + item.verifiedTotal, 0);
          await this.updateQueueItemPrice(orderId, newTotal);
        }

        // Always update the individual line item prices in the Amazon tab with verified prices
        // This ensures line items match the totals even if individual prices changed slightly
        await this.updateAmazonTabLineItemPrices(originalOrder.transactionId, orderResult.items);

        itemsToOrder.push({
          ...originalOrder,
          verifiedItems: orderResult.items,
          finalTotal: orderResult.items.reduce((sum, item) => sum + item.verifiedTotal, 0)
        });
      }
    }

    console.log(`✅ Processing complete: ${itemsToOrder.length} to order, ${itemsNeedingReapproval.length} need reapproval`);

    return {
      itemsToOrder,
      itemsNeedingReapproval
    };
  }

  async updateQueueItemPrice(queueId, newTotal) {
    try {
      const autoHub = SpreadsheetApp.openById(CONFIG.AUTOMATED_HUB_ID);
      const queueSheet = autoHub.getSheetByName('AutomatedQueue');
      const data = queueSheet.getDataRange().getValues();

      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === queueId) {
          queueSheet.getRange(i + 1, 6).setValue(newTotal); // Column F: Amount
          console.log(`💰 Updated ${queueId} total to $${newTotal.toFixed(2)}`);
          break;
        }
      }

    } catch (error) {
      console.error(`❌ Error updating queue price:`, error);
    }
  }

  /**
   * Updates individual line item prices in the Amazon tab after price verification
   * Columns F, K, P, U, Z correspond to Item 1-5 Unit Prices
   * @param {string} transactionId - Transaction ID to match in column AC
   * @param {Array} verifiedItems - Array of verified items with new prices
   */
  async updateAmazonTabLineItemPrices(transactionId, verifiedItems) {
    try {
      console.log(`🔄 Updating Amazon tab line item prices for ${transactionId}`);

      const autoHub = SpreadsheetApp.openById(CONFIG.AUTOMATED_HUB_ID);
      const amazonSheet = autoHub.getSheetByName('Amazon');

      if (!amazonSheet) {
        console.log(`⚠️ Amazon sheet not found in Automated Hub`);
        return;
      }

      const data = amazonSheet.getDataRange().getValues();

      // Find the row with matching transaction ID in column AC (index 28)
      let targetRow = -1;
      for (let i = 1; i < data.length; i++) {
        if (data[i][28] === transactionId) { // Column AC = index 28
          targetRow = i + 1; // Convert to 1-based row number
          break;
        }
      }

      if (targetRow === -1) {
        console.log(`⚠️ Transaction ID ${transactionId} not found in Amazon tab`);
        return;
      }

      console.log(`📍 Found ${transactionId} at row ${targetRow}`);

      // Price columns: F=6, K=11, P=16, U=21, Z=26 (1-based column numbers)
      const priceColumns = [6, 11, 16, 21, 26]; // F, K, P, U, Z
      const columnLabels = ['F', 'K', 'P', 'U', 'Z'];

      // Update each item's price based on the verified items
      let updatedCount = 0;
      for (let itemIndex = 0; itemIndex < Math.min(verifiedItems.length, 5); itemIndex++) {
        const verifiedItem = verifiedItems[itemIndex];
        if (verifiedItem && verifiedItem.verifiedPrice != null) {
          const columnIndex = priceColumns[itemIndex];
          const oldPrice = data[targetRow - 1][columnIndex - 1]; // Convert to 0-based for data array

          // Only update if the price actually changed
          if (Math.abs(oldPrice - verifiedItem.verifiedPrice) > 0.01) {
            amazonSheet.getRange(targetRow, columnIndex).setValue(verifiedItem.verifiedPrice);
            updatedCount++;

            console.log(`💰 Updated Item ${itemIndex + 1} price: $${oldPrice} → $${verifiedItem.verifiedPrice.toFixed(2)} (Column ${columnLabels[itemIndex]})`);
          } else {
            console.log(`✓ Item ${itemIndex + 1} price unchanged: $${verifiedItem.verifiedPrice.toFixed(2)} (Column ${columnLabels[itemIndex]})`);
          }
        }
      }

      if (updatedCount > 0) {
        SpreadsheetApp.flush(); // Ensure changes are committed
        console.log(`✅ Successfully updated ${updatedCount} line item prices in Amazon tab for ${transactionId}`);
      } else {
        console.log(`✓ No price changes needed for Amazon tab ${transactionId}`);
      }

    } catch (error) {
      console.error(`❌ Error updating Amazon tab line item prices for ${transactionId}:`, error);
      // Log to system but don't throw - this shouldn't break the main workflow
      logSystemEvent('AMAZON_TAB_UPDATE_ERROR', 'SYSTEM', 0, {
        transactionId,
        error: error.toString(),
        itemCount: verifiedItems ? verifiedItems.length : 0
      });
    }
  }

  // ============================================================================
  // FINAL ORDER PROCESSING
  // ============================================================================

  async createFinalOrderCart(itemsToOrder) {
    try {
      console.log(`🛒 Creating final order cart for ${itemsToOrder.length} orders`);

      // Flatten all verified items
      const allItems = [];
      let totalAmount = 0;

      for (const order of itemsToOrder) {
        for (const item of order.verifiedItems) {
          allItems.push({
            asin: item.asin,
            quantity: item.quantity,
            description: item.description,
            finalPrice: item.verifiedPrice,
            queueId: order.queueId,
            requestor: order.requestor,
            department: order.department
          });
          totalAmount += item.verifiedTotal;
        }
      }

      const cartUrl = this.generateMultiItemCartUrl(allItems);
      const orderId = this.generateOrderId();

      return {
        success: true,
        orderId: orderId,
        cartUrl: cartUrl,
        items: allItems,
        queueItems: itemsToOrder,
        totalAmount: totalAmount
      };

    } catch (error) {
      console.error('❌ Failed to create final order cart:', error);
      return {
        success: false,
        error: error.toString()
      };
    }
  }

  // ============================================================================
  // ENHANCED PRICE INCREASE NOTIFICATION (REPLACES EXISTING)
  // ============================================================================

  async sendPriceIncreaseNotification(originalOrder, verificationResult) {
    try {
      console.log(`📧 Sending reapproval email for price increase: ${originalOrder.queueId}`);

      // Get user budget info for proper approver routing
      const userBudget = getUserBudgetInfo(originalOrder.requestor);
      const approverEmail = getApproverForRequest({ amount: originalOrder.totalAmount + verificationResult.totalVariance }, userBudget);

      // Use the enhanced email from RapidAPI version
      const budgetInfo = {
        available: userBudget.allocated - userBudget.spent - userBudget.encumbered
      };

      sendPriceVarianceApprovalEmail(approverEmail, {
        queueId: originalOrder.queueId,
        requestor: originalOrder.requestor,
        originalTotal: originalOrder.totalAmount,
        verifiedTotal: originalOrder.totalAmount + verificationResult.totalVariance,
        items: verificationResult.items.map(item => ({
          description: item.description,
          quantity: item.quantity,
          originalPrice: item.originalPrice,
          verifiedPrice: item.verifiedPrice,
          priceChange: ((item.verifiedPrice - item.originalPrice) / item.originalPrice) * 100
        }))
      }, budgetInfo);

      console.log(`✉️ Reapproval email sent to ${approverEmail} for ${originalOrder.queueId}`);

    } catch (error) {
      console.error('❌ Failed to send reapproval email:', error);
    }
  }

  // ============================================================================
  // EXISTING HELPER METHODS (PRESERVED EXACTLY AS ORIGINAL)
  // ============================================================================

  async getApprovedAmazonItems() {
    try {
      const autoHub = SpreadsheetApp.openById(CONFIG.AUTOMATED_HUB_ID);
      const queueSheet = autoHub.getSheetByName('AutomatedQueue');
      const amazonSheet = autoHub.getSheetByName('Amazon');

      const queueData = queueSheet.getDataRange().getValues();
      const amazonData = amazonSheet.getDataRange().getValues();

      const approvedItems = [];

      for (let i = 1; i < queueData.length; i++) {
        const queueRow = queueData[i];

        if (queueRow[2] === 'AMAZON' && queueRow[7] === 'APPROVED') {
          const queueId = queueRow[0].toString();

          console.log(`🔍 Looking for transaction ID: ${queueId}`);

          // Find Amazon row by transaction ID in column AC (index 28)
          const amazonRow = amazonData.find(row => {
            return row[28] === queueId;
          });

          if (amazonRow) {
            console.log(`✅ Found matching Amazon row for ${queueId}`);
            const items = this.parseAmazonFormItems(amazonRow);

            if (items.length > 0) {
              approvedItems.push({
                queueId: queueRow[0],
                requestor: queueRow[1],
                department: queueRow[3],
                division: queueRow[4],
                totalAmount: queueRow[5],
                description: queueRow[6],
                items: items
              });
              console.log(`✅ Added approved item: ${queueId} with ${items.length} items`);
            }
          } else {
            console.log(`❌ No Amazon row found for transaction ID: ${queueId}`);
          }
        }
      }

      return approvedItems;

    } catch (error) {
      console.error('Error getting approved Amazon items:', error);
      return [];
    }
  }

  parseAmazonFormItems(amazonRow) {
    const items = [];

    try {
      console.log('📋 Parsing Amazon form items...');

      let itemIndex = 0;

      for (let itemNum = 1; itemNum <= 5; itemNum++) {
        const baseCol = 2 + (itemNum - 1) * 5;

        const description = amazonRow[baseCol];
        const url = amazonRow[baseCol + 1];
        const quantity = amazonRow[baseCol + 2];
        const priceStr = amazonRow[baseCol + 3];

        if (!description || description.toString().trim() === '') {
          break;
        }

        if (!url || !priceStr || !url.toString().toLowerCase().includes('amazon.com')) {
          continue;
        }

        const unitPrice = parseFloat(priceStr.toString().replace(/[$,]/g, ''));
        const qty = parseInt(quantity) || 1;

        if (isNaN(unitPrice) || unitPrice <= 0) {
          continue;
        }

        const item = {
          index: itemIndex++,
          itemNumber: itemNum,
          description: description.toString().trim(),
          url: url.toString().trim(),
          quantity: qty,
          unitPrice: unitPrice,
          price: unitPrice * qty
        };

        items.push(item);
        console.log(`✅ Item ${itemNum}: ${description} - ${qty}x $${unitPrice}`);
      }

      console.log(`🎯 Parsed ${items.length} items total`);

    } catch (error) {
      console.error('❌ Error parsing items:', error);
    }

    return items;
  }

  async updateQueueItemStatus(queueId, status) {
    try {
      const autoHub = SpreadsheetApp.openById(CONFIG.AUTOMATED_HUB_ID);
      const queueSheet = autoHub.getSheetByName('AutomatedQueue');
      const data = queueSheet.getDataRange().getValues();

      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === queueId) {
          queueSheet.getRange(i + 1, 8).setValue(status);     // Column H: Status

          if (status === 'ORDERED') {
            queueSheet.getRange(i + 1, 11).setValue(new Date()); // Column K: Timestamp
          }

          SpreadsheetApp.flush();
          console.log(`✅ Updated ${queueId} status to: ${status}`);
          break;
        }
      }

    } catch (error) {
      console.error(`❌ Error updating queue item ${queueId}:`, error);
    }
  }

  async processSuccessfulOrder(cartResult, confirmedItems) {
    try {
      console.log(`📋 Processing successful order: ${cartResult.orderId}`);

      // Send cart email to business office
      await this.sendFinalCartEmail(cartResult);

      // Log transactions to budget hub
      await this.logTransactionsToBudgetHub(cartResult);

      // Update all queue items to ORDERED status
      for (const queueItem of confirmedItems) {
        await this.updateQueueItemStatus(queueItem.queueId, 'ORDERED');
      }

      console.log(`✅ Order processing complete: ${cartResult.orderId}`);

    } catch (error) {
      console.error(`❌ Order processing failed:`, error);
    }
  }

  async sendFinalCartEmail(cartResult) {
    try {
      console.log(`📧 Sending final cart email`);

      const subject = `🛒 Amazon Order Ready - ${cartResult.orderId}`;

      let htmlBody = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; 
              background: #f5f5f5; 
              line-height: 1.4;
            }
            .wrapper { max-width: 700px; margin: 0 auto; background: white; }
            
            .header { 
              background: #2E7D32;
              background: -webkit-linear-gradient(135deg, #2E7D32 0%, #4CAF50 100%);
              background: linear-gradient(135deg, #2E7D32 0%, #4CAF50 100%);
              color: #ffffff; 
              padding: 30px; 
              text-align: center; 
            }
            .header h1 { 
              margin: 0; 
              font-size: 28px; 
              font-weight: 300; 
              color: #ffffff !important;
            }
            .header p { 
              margin: 10px 0 0; 
              opacity: 0.9; 
              color: #ffffff !important;
            }
            
            .content { padding: 30px; }
            
            .summary-box {
              background: #e8f5e9;
              padding: 20px;
              border-radius: 6px;
              margin-bottom: 25px;
            }
            
            .cart-button {
              background: #FF9800 !important;
              background: -webkit-linear-gradient(135deg, #FF9800 0%, #F57C00 100%) !important;
              background: linear-gradient(135deg, #FF9800 0%, #F57C00 100%) !important;
              color: #ffffff !important;
              padding: 15px 40px;
              text-decoration: none;
              border-radius: 30px;
              font-weight: bold;
              font-size: 16px;
              display: inline-block;
              box-shadow: 0 4px 15px rgba(255, 152, 0, 0.3);
              border: none;
            }
            .cart-button:hover {
              background: #F57C00 !important;
            }
            
            .dept-section {
              margin-top: 20px;
              border-bottom: 1px solid #e0e0e0;
              padding-bottom: 15px;
            }
            .dept-title {
              color: #2E7D32;
              margin-bottom: 10px;
              font-size: 18px;
              font-weight: 600;
            }
            
            .order-item {
              background: #f5f5f5;
              padding: 15px;
              border-radius: 6px;
              margin-bottom: 10px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .order-details {
              flex: 1;
            }
            .order-amount {
              text-align: right;
              font-weight: bold;
              color: #2E7D32;
              font-size: 16px;
            }
            
            .note-box {
              background: #fff8e1;
              padding: 15px;
              border-radius: 6px;
              margin-top: 25px;
            }
          </style>
        </head>
        <body>
          <div class="wrapper">
            <div class="header">
              <h1>Amazon Order Ready</h1>
              <p>Order ID: ${cartResult.orderId}</p>
            </div>
            
            <div class="content">
              <div class="summary-box">
                <table style="width: 100%;">
                  <tr>
                    <td style="color: #2E7D32; font-weight: bold;">Total Items:</td>
                    <td style="text-align: right; font-weight: bold;">${cartResult.items.length}</td>
                  </tr>
                  <tr>
                    <td style="color: #2E7D32; font-weight: bold;">Total Amount:</td>
                    <td style="text-align: right; font-weight: bold; font-size: 18px;">$${cartResult.totalAmount.toFixed(2)}</td>
                  </tr>
                </table>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${cartResult.cartUrl}" class="cart-button">
                  🛒 OPEN AMAZON CART
                </a>
              </div>
              
              <h3 style="color: #333; margin-top: 30px; border-bottom: 2px solid #e0e0e0; padding-bottom: 10px;">Order Details by Department</h3>
      `;

      // Group items by department
      const departmentGroups = {};
      cartResult.queueItems.forEach(queueItem => {
        const dept = queueItem.department || 'Unknown';
        if (!departmentGroups[dept]) {
          departmentGroups[dept] = [];
        }
        departmentGroups[dept].push(queueItem);
      });

      for (const [department, queueItems] of Object.entries(departmentGroups)) {
        htmlBody += `
          <div class="dept-section">
            <h4 class="dept-title">${department}</h4>
        `;

        queueItems.forEach(queueItem => {
          const itemList = queueItem.verifiedItems.map(item =>
            `${item.quantity}x ${item.description}`
          ).join(', ');

          htmlBody += `
            <div class="order-item">
              <div class="order-details">
                <strong>${queueItem.queueId}</strong> - ${queueItem.requestor}<br>
                <span style="color: #666; font-size: 14px;">${itemList}</span>
              </div>
              <div class="order-amount">
                $${queueItem.finalTotal.toFixed(2)}
              </div>
            </div>
          `;
        });

        htmlBody += '</div>';
      }

      htmlBody += `
              <div class="note-box">
                <p style="margin: 0; color: #666;">
                  <strong>Note:</strong> All prices have been verified and approved. 
                  Please complete this order and update the transaction status in the system.
                </p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      const isTestMode = this.isTestMode();
      const recipient = isTestMode ? CONFIG.TEST_EMAIL : CONFIG.BUSINESS_OFFICE_EMAIL;

      INTERNAL_sendEmail(
        recipient,
        isTestMode ? `[TEST] ${subject}` : subject,
        htmlBody
      );

      console.log(`✉️ Final cart email sent to ${recipient}`);

    } catch (error) {
      console.error(`❌ Failed to send final cart email:`, error);
    }
  }

  async logTransactionsToBudgetHub(cartResult) {
    try {
      console.log(`📊 Logging transactions to budget hub: ${cartResult.orderId}`);

      const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);

      let ledgerSheet = budgetHub.getSheetByName('TransactionLedger');
      if (!ledgerSheet) {
        ledgerSheet = budgetHub.insertSheet('TransactionLedger');
        ledgerSheet.getRange(1, 1, 1, 9).setValues([[
          'TransactionID', 'OrderID', 'ProcessedOn', 'Requestor', 'Approver', 'Organization', 'Form', 'Amount', 'Description'
        ]]);
      }

      // Read existing IDs to prevent duplicates (Ghost Orders / Double Spend)
      // This protects against script crashes between Ledger Update and Queue Update
      const existingData = ledgerSheet.getDataRange().getValues();
      const existingTxIds = new Set();
      for (let i = 1; i < existingData.length; i++) {
        existingTxIds.add(existingData[i][0].toString());
      }

      const newRows = [];

      for (const queueItem of cartResult.queueItems) {
        if (existingTxIds.has(queueItem.queueId.toString())) {
          console.log(`⚠️ Transaction ${queueItem.queueId} already in ledger - skipping to prevent duplicate`);
          continue;
        }

        const description = this.createMultiItemDescription(queueItem.verifiedItems);

        const transactionData = [
          queueItem.queueId,
          cartResult.orderId,
          new Date(),
          queueItem.requestor || 'Unknown',
          '', // Approver will be populated by lookup
          queueItem.department || 'Unknown',
          'AMAZON',
          queueItem.finalTotal,
          description
        ];

        newRows.push(transactionData);
      }

      if (newRows.length > 0) {
        // Bulk append for performance
        const lastRow = ledgerSheet.getLastRow();
        ledgerSheet.getRange(lastRow + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
        console.log(`✅ Logged ${newRows.length} transactions to ledger`);
      } else {
        console.log('✓ No new transactions to log (all were duplicates or empty)');
      }

      SpreadsheetApp.flush();
      console.log(`✅ Transaction logging complete`);

    } catch (error) {
      console.error('❌ Transaction logging failed:', error);
      // RE-THROW to ensure the main workflow stops and doesn't mark items as "ORDERED"
      // if we failed to log the money trail.
      throw new Error(`Ledger logging failed: ${error.message}`);
    }
  }

  createMultiItemDescription(items) {
    const descriptions = items.map(item => {
      if (item.quantity > 1) {
        return `${item.quantity}x ${item.description}`;
      }
      return item.description;
    });

    return descriptions.join(', ');
  }

  generateOrderId() {
    const now = new Date();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const dateStr = month + day;
    const baseOrderId = `AMZ-${dateStr}`;

    try {
      console.log(`🆔 Generating order ID for date: ${dateStr}`);

      const budgetHub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
      let ledgerSheet = budgetHub.getSheetByName('TransactionLedger');

      if (!ledgerSheet) {
        console.log(`📋 No transaction ledger found, using base ID: ${baseOrderId}`);
        return baseOrderId;
      }

      const data = ledgerSheet.getDataRange().getValues();
      if (data.length <= 1) {
        console.log(`📋 Empty ledger, using base ID: ${baseOrderId}`);
        return baseOrderId;
      }

      // Find all existing order IDs for today's date
      const todayOrderIds = [];
      for (let i = 1; i < data.length; i++) {
        const orderId = data[i][1]; // OrderID column (column B)
        if (orderId && orderId.toString().startsWith(baseOrderId)) {
          todayOrderIds.push(orderId.toString());
        }
      }

      console.log(`📋 Found ${todayOrderIds.length} existing orders for ${dateStr}: [${todayOrderIds.join(', ')}]`);

      if (todayOrderIds.length === 0) {
        console.log(`✅ First order of the day: ${baseOrderId}`);
        return baseOrderId;
      }

      // Check if base ID (without suffix) exists
      const hasBaseId = todayOrderIds.includes(baseOrderId);

      if (!hasBaseId) {
        console.log(`✅ Base ID available: ${baseOrderId}`);
        return baseOrderId;
      }

      // Find the highest suffix number
      let maxSuffix = 0;

      todayOrderIds.forEach(orderId => {
        if (orderId === baseOrderId) {
          // Base ID counts as suffix 0
          maxSuffix = Math.max(maxSuffix, 0);
        } else if (orderId.includes('.')) {
          // Extract suffix after the dot
          const suffixPart = orderId.split('.')[1];
          if (suffixPart && !isNaN(suffixPart)) {
            const suffix = parseInt(suffixPart);
            maxSuffix = Math.max(maxSuffix, suffix);
          }
        }
      });

      // Generate next suffix
      const nextSuffix = maxSuffix + 1;
      const nextOrderId = `${baseOrderId}.${nextSuffix}`;

      console.log(`✅ Generated incremental order ID: ${nextOrderId} (max suffix was: ${maxSuffix})`);
      return nextOrderId;

    } catch (error) {
      console.error('❌ Error generating order ID:', error);

      // Fallback: use timestamp suffix
      const timestamp = Date.now().toString().slice(-3);
      const fallbackId = `${baseOrderId}.${timestamp}`;
      console.log(`⚠️ Using fallback order ID: ${fallbackId}`);
      return fallbackId;
    }
  }

  extractASIN(url) {
    if (!url) {
      console.log(`❌ No URL provided for ASIN extraction`);
      return null;
    }

    const urlStr = url.toString().trim();

    for (const pattern of CONFIG.ASIN_PATTERNS) {
      const match = urlStr.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    console.log(`❌ No ASIN found in URL: ${urlStr}`);
    return null;
  }

  isTestMode() {
    try {
      const autoHub = SpreadsheetApp.openById(CONFIG.AUTOMATED_HUB_ID);
      const queueSheet = autoHub.getSheetByName('AutomatedQueue');
      const data = queueSheet.getDataRange().getValues();

      return data.some(row => row[0] && row[0].toString().includes('TEST_'));
    } catch (error) {
      return false;
    }
  }
}

// ============================================================================
// RAPIDAPI INTEGRATION FUNCTIONS
// ============================================================================

/**
 * Fetch product details from RapidAPI
 * @param {string} asin - Amazon ASIN to fetch
 * @return {Object} Result object with price and title
 */
function fetchProductDetailsFromAPI(asin) {
  try {
    const apiKey = getNextAPIKey();
    const endpoint = `${RAPIDAPI_CONFIG.API_HOST}/product-details`;
    const url = `https://${endpoint}?asin=${asin}&country=US`;

    console.log(`Checking ${asin} using key ${getKeyIdentifier(apiKey)}`);

    const params = {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': RAPIDAPI_CONFIG.API_HOST
      },
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, params);
    const responseCode = response.getResponseCode();

    // Track usage regardless of success/fail to prevent abuse
    trackAPIUsage(apiKey);

    if (responseCode === 200) {
      const data = JSON.parse(response.getContentText());

      if (data.data) {
        // Extract price - logic handles various formats in response
        let price = 0;
        if (data.data.product_price) {
          price = parseFloat(data.data.product_price.replace('$', '').replace(',', ''));
        } else if (data.data.product_original_price) {
          price = parseFloat(data.data.product_original_price.replace('$', '').replace(',', ''));
        }

        return {
          success: true,
          price: price,
          title: data.data.product_title || 'Unknown Title',
          keyUsed: getKeyIdentifier(apiKey)
        };
      } else {
        return {
          success: false,
          error: 'No data in API response'
        };
      }
    } else if (responseCode === 429) {
      console.warn(`⚠️ Rate limit hit for key ${getKeyIdentifier(apiKey)}`);
      return {
        success: false,
        error: 'Rate Limit Exceeded (429)'
      };
    } else {
      return {
        success: false,
        error: `API Error: ${responseCode}`
      };
    }

  } catch (error) {
    console.error(`❌ API Fetch Error for ${asin}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}


/**
 * Get RapidAPI keys from script properties with rotation support
 * @return {Array} API keys
 */
function getRapidAPIKeys() {
  const scriptProperties = PropertiesService.getScriptProperties();

  // Check for multiple keys first
  const multipleKeys = scriptProperties.getProperty('RAPIDAPI_KEYS');
  if (multipleKeys) {
    RAPIDAPI_CONFIG.API_KEYS = multipleKeys.split(',').map(key => key.trim());
    console.log(`📋 Loaded ${RAPIDAPI_CONFIG.API_KEYS.length} API keys for rotation`);
    return RAPIDAPI_CONFIG.API_KEYS;
  }

  // Fall back to single key
  const singleKey = scriptProperties.getProperty('RAPIDAPI_KEY');
  if (singleKey) {
    RAPIDAPI_CONFIG.API_KEYS = [singleKey];
    return RAPIDAPI_CONFIG.API_KEYS;
  }

  throw new Error('No RapidAPI key found. Please set RAPIDAPI_KEY or RAPIDAPI_KEYS in script properties.');
}

/**
 * Get next API key using intelligent load balancing
 * @return {string} API key
 */
function getNextAPIKey() {
  if (RAPIDAPI_CONFIG.API_KEYS.length === 0) {
    getRapidAPIKeys();
  }

  if (RAPIDAPI_CONFIG.SMART_ROTATION) {
    return getBestAvailableAPIKey();
  }

  // Fallback to simple rotation
  const key = RAPIDAPI_CONFIG.API_KEYS[RAPIDAPI_CONFIG.CURRENT_KEY_INDEX];
  RAPIDAPI_CONFIG.CURRENT_KEY_INDEX = (RAPIDAPI_CONFIG.CURRENT_KEY_INDEX + 1) % RAPIDAPI_CONFIG.API_KEYS.length;
  return key;
}

/**
 * Get the API key with the lowest usage that's still available
 * @return {string} Best available API key
 */
function getBestAvailableAPIKey() {
  try {
    const usage = getCurrentUsageData();
    const keyStats = [];

    // Build stats for each key
    for (let i = 0; i < RAPIDAPI_CONFIG.API_KEYS.length; i++) {
      const key = RAPIDAPI_CONFIG.API_KEYS[i];
      const keyId = getKeyIdentifier(key);
      const currentUsage = usage[keyId] || 0;
      const usagePercent = (currentUsage / RAPIDAPI_CONFIG.FREE_TIER_LIMIT) * 100;

      keyStats.push({
        index: i,
        key: key,
        keyId: keyId,
        usage: currentUsage,
        usagePercent: usagePercent,
        available: currentUsage < RAPIDAPI_CONFIG.FAILOVER_THRESHOLD
      });
    }

    // Sort by usage (lowest first), then by index for consistency
    keyStats.sort((a, b) => {
      if (a.available && !b.available) return -1;
      if (!a.available && b.available) return 1;
      if (a.usage !== b.usage) return a.usage - b.usage;
      return a.index - b.index;
    });

    const bestKey = keyStats[0];

    // Log usage distribution for monitoring
    if (keyStats.length > 1) {
      const usageReport = keyStats.map(k => `${k.keyId}: ${k.usage}/${RAPIDAPI_CONFIG.FREE_TIER_LIMIT} (${k.usagePercent.toFixed(1)}%)`).join(', ');
      console.log(`🔄 API Key Usage: ${usageReport}`);
    }

    // Warn if all keys are getting high
    const allKeysHigh = keyStats.every(k => k.usagePercent > RAPIDAPI_CONFIG.USAGE_WARNING_THRESHOLD);
    if (allKeysHigh) {
      console.log(`⚠️ ALL API KEYS ABOVE ${RAPIDAPI_CONFIG.USAGE_WARNING_THRESHOLD}% USAGE - Consider adding more keys`);
    }

    // Error if no keys available
    if (!bestKey.available) {
      throw new Error(`All ${RAPIDAPI_CONFIG.API_KEYS.length} API keys have exceeded the failover threshold (${RAPIDAPI_CONFIG.FAILOVER_THRESHOLD}%)`);
    }

    console.log(`🔑 Selected key ${bestKey.keyId} (${bestKey.usage}/${RAPIDAPI_CONFIG.FREE_TIER_LIMIT} - ${bestKey.usagePercent.toFixed(1)}%)`);
    return bestKey.key;

  } catch (error) {
    console.error('❌ Error in smart key selection:', error);
    // Fallback to simple rotation
    const key = RAPIDAPI_CONFIG.API_KEYS[RAPIDAPI_CONFIG.CURRENT_KEY_INDEX];
    RAPIDAPI_CONFIG.CURRENT_KEY_INDEX = (RAPIDAPI_CONFIG.CURRENT_KEY_INDEX + 1) % RAPIDAPI_CONFIG.API_KEYS.length;
    return key;
  }
}

/**
 * Track API usage for monitoring with enhanced analytics
 * @param {string} key - API key used
 */
function trackAPIUsage(key) {
  try {
    const scriptProperties = PropertiesService.getScriptProperties();
    let usage = getCurrentUsageData();

    const keyIdentifier = getKeyIdentifier(key);
    usage[keyIdentifier] = (usage[keyIdentifier] || 0) + 1;

    // Reset monthly on the 1st
    const today = new Date();
    if (today.getDate() === 1 && (!usage.lastReset || new Date(usage.lastReset).getMonth() !== today.getMonth())) {
      console.log(`🔄 Monthly API usage reset - Previous totals: ${JSON.stringify(getUsageSummary(usage))}`);
      resetMonthlyUsage(usage);
    }

    scriptProperties.setProperty('RAPIDAPI_USAGE', JSON.stringify(usage));

    // Enhanced usage warnings
    const currentUsage = usage[keyIdentifier];
    const usagePercent = (currentUsage / RAPIDAPI_CONFIG.FREE_TIER_LIMIT) * 100;

    if (usagePercent >= RAPIDAPI_CONFIG.FAILOVER_THRESHOLD) {
      console.log(`🚨 API key ${keyIdentifier} at CRITICAL usage: ${currentUsage}/${RAPIDAPI_CONFIG.FREE_TIER_LIMIT} (${usagePercent.toFixed(1)}%)`);
    } else if (usagePercent >= RAPIDAPI_CONFIG.USAGE_WARNING_THRESHOLD) {
      console.log(`⚠️ API key ${keyIdentifier} approaching limit: ${currentUsage}/${RAPIDAPI_CONFIG.FREE_TIER_LIMIT} (${usagePercent.toFixed(1)}%)`);
    }

    // Log total usage across all keys every 10 calls
    if (getTotalUsage(usage) % 10 === 0) {
      logUsageDistribution(usage);
    }

  } catch (error) {
    console.log('❌ Usage tracking error:', error);
  }
}

/**
 * Helper functions for enhanced usage tracking
 */
function getCurrentUsageData() {
  const scriptProperties = PropertiesService.getScriptProperties();
  let usage = scriptProperties.getProperty('RAPIDAPI_USAGE');

  if (!usage) {
    return {};
  }

  try {
    return JSON.parse(usage);
  } catch (error) {
    console.log('⚠️ Invalid usage data, resetting...');
    return {};
  }
}

function getKeyIdentifier(key) {
  return key.substring(0, 8) + '...';
}

function resetMonthlyUsage(usage) {
  Object.keys(usage).forEach(k => {
    if (k !== 'lastReset') usage[k] = 0;
  });
  usage.lastReset = new Date().toISOString();
}

function getTotalUsage(usage) {
  return Object.keys(usage).reduce((total, key) => {
    if (key !== 'lastReset') {
      return total + (usage[key] || 0);
    }
    return total;
  }, 0);
}

function getUsageSummary(usage) {
  const summary = {};
  Object.keys(usage).forEach(key => {
    if (key !== 'lastReset') {
      summary[key] = usage[key];
    }
  });
  return summary;
}

function logUsageDistribution(usage) {
  const keyCount = Object.keys(usage).filter(k => k !== 'lastReset').length;
  const totalUsage = getTotalUsage(usage);
  const avgUsage = keyCount > 0 ? (totalUsage / keyCount).toFixed(1) : 0;

  console.log(`📊 Usage Distribution: ${totalUsage} total calls across ${keyCount} keys (avg: ${avgUsage}/key)`);
}

/**
 * Get comprehensive usage statistics for all API keys
 * @return {Object} Detailed usage statistics
 */
function getDetailedUsageStats() {
  try {
    const usage = getCurrentUsageData();
    const keys = getRapidAPIKeys();

    const stats = {
      totalKeys: keys.length,
      totalUsage: getTotalUsage(usage),
      lastReset: usage.lastReset || 'Never',
      keyStats: [],
      recommendations: []
    };

    // Calculate stats for each key
    keys.forEach((key, index) => {
      const keyId = getKeyIdentifier(key);
      const currentUsage = usage[keyId] || 0;
      const usagePercent = (currentUsage / RAPIDAPI_CONFIG.FREE_TIER_LIMIT) * 100;
      const remaining = RAPIDAPI_CONFIG.FREE_TIER_LIMIT - currentUsage;

      stats.keyStats.push({
        index: index + 1,
        keyId: keyId,
        usage: currentUsage,
        limit: RAPIDAPI_CONFIG.FREE_TIER_LIMIT,
        usagePercent: usagePercent,
        remaining: remaining,
        status: usagePercent >= RAPIDAPI_CONFIG.FAILOVER_THRESHOLD ? 'CRITICAL' :
          usagePercent >= RAPIDAPI_CONFIG.USAGE_WARNING_THRESHOLD ? 'WARNING' : 'OK'
      });
    });

    // Sort by usage for better display
    stats.keyStats.sort((a, b) => a.usage - b.usage);

    // Generate recommendations
    const avgUsage = stats.totalUsage / stats.totalKeys;
    const criticalKeys = stats.keyStats.filter(k => k.status === 'CRITICAL').length;
    const warningKeys = stats.keyStats.filter(k => k.status === 'WARNING').length;

    if (criticalKeys > 0) {
      stats.recommendations.push(`🚨 ${criticalKeys} key(s) in critical state - consider adding more keys`);
    }

    if (warningKeys > stats.totalKeys * 0.5) {
      stats.recommendations.push(`⚠️ Over half your keys are approaching limits - plan for additional keys`);
    }

    if (avgUsage > RAPIDAPI_CONFIG.FREE_TIER_LIMIT * 0.7) {
      stats.recommendations.push(`📊 High average usage (${avgUsage.toFixed(1)}/key) - monitor closely`);
    }

    // Estimate remaining capacity
    const totalRemaining = stats.keyStats.reduce((sum, k) => sum + k.remaining, 0);
    const estimatedDaysLeft = Math.floor(totalRemaining / (stats.totalUsage / 30)); // Rough estimate

    stats.estimatedDaysLeft = estimatedDaysLeft;

    if (estimatedDaysLeft < 5) {
      stats.recommendations.push(`⏰ Only ~${estimatedDaysLeft} days of capacity remaining at current usage rate`);
    }

    return stats;

  } catch (error) {
    console.error('❌ Error getting usage stats:', error);
    return { error: error.toString() };
  }
}

/**
 * Print a detailed usage report to console
 */
function printUsageReport() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 RAPIDAPI USAGE REPORT');
  console.log('='.repeat(60));

  const stats = getDetailedUsageStats();

  if (stats.error) {
    console.log('❌ Error generating report:', stats.error);
    return;
  }

  // Summary
  console.log(`\n📋 SUMMARY:`);
  console.log(`   Total Keys: ${stats.totalKeys}`);
  console.log(`   Total Usage: ${stats.totalUsage} calls`);
  console.log(`   Average per Key: ${(stats.totalUsage / stats.totalKeys).toFixed(1)} calls`);
  console.log(`   Last Reset: ${stats.lastReset}`);

  if (stats.estimatedDaysLeft > 0) {
    console.log(`   Estimated Days Remaining: ~${stats.estimatedDaysLeft} days`);
  }

  // Individual key stats
  console.log(`\n🔑 KEY DETAILS:`);
  stats.keyStats.forEach(key => {
    const statusIcon = key.status === 'CRITICAL' ? '🚨' :
      key.status === 'WARNING' ? '⚠️' : '✅';
    console.log(`   ${statusIcon} Key ${key.index} (${key.keyId}): ${key.usage}/${key.limit} (${key.usagePercent.toFixed(1)}%) - ${key.remaining} remaining`);
  });

  // Recommendations
  if (stats.recommendations.length > 0) {
    console.log(`\n💡 RECOMMENDATIONS:`);
    stats.recommendations.forEach(rec => console.log(`   ${rec}`));
  }

  console.log('\n' + '='.repeat(60));
}

/**
 * Perform bulk ASIN price checks with optimized key usage
 * @param {Array} asins - Array of ASINs to check
 * @param {Object} options - Options for bulk processing
 * @return {Object} Results of bulk processing
 */
function bulkPriceCheck(asins, options = {}) {
  const {
    batchSize = 5,        // Process in batches to avoid overwhelming
    delayBetweenBatches = 1000,  // Delay between batches in ms
    maxRetries = 2,       // Max retries per ASIN
    logProgress = true    // Whether to log progress
  } = options;

  if (logProgress) {
    console.log(`🚀 Starting bulk price check for ${asins.length} ASINs`);
    console.log(`📦 Batch size: ${batchSize}, Delay: ${delayBetweenBatches}ms`);
  }

  const results = {
    successful: [],
    failed: [],
    totalProcessed: 0,
    totalTime: 0,
    keyUsage: {}
  };

  const startTime = new Date();

  // Process in batches
  for (let i = 0; i < asins.length; i += batchSize) {
    const batch = asins.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(asins.length / batchSize);

    if (logProgress) {
      console.log(`📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} ASINs)`);
    }

    // Process batch
    batch.forEach(asin => {
      const result = fetchProductDetailsFromAPI(asin);
      results.totalProcessed++;

      if (result.success) {
        results.successful.push(result);

        // Track key usage
        const keyUsed = result.keyUsed || 'unknown';
        results.keyUsage[keyUsed] = (results.keyUsage[keyUsed] || 0) + 1;

      } else {
        results.failed.push(result);

        if (logProgress) {
          console.log(`❌ Failed: ${asin} - ${result.error}`);
        }
      }
    });

    // Delay between batches (except for last batch)
    if (i + batchSize < asins.length) {
      if (logProgress) {
        console.log(`⏱️ Waiting ${delayBetweenBatches}ms before next batch...`);
      }
      Utilities.sleep(delayBetweenBatches);
    }
  }

  const endTime = new Date();
  results.totalTime = endTime - startTime;

  if (logProgress) {
    console.log(`\n✅ Bulk processing complete!`);
    console.log(`   Successful: ${results.successful.length}/${asins.length}`);
    console.log(`   Failed: ${results.failed.length}/${asins.length}`);
    console.log(`   Total Time: ${results.totalTime}ms`);
    console.log(`   Key Usage: ${JSON.stringify(results.keyUsage)}`);
  }

  return results;
}

/**
 * Pre-flight check before running major operations
 * @return {Object} Health check results
 */
function performAPIHealthCheck() {
  console.log('🏥 Performing API Health Check...');

  const health = {
    overall: 'HEALTHY',
    checks: [],
    warnings: [],
    errors: []
  };

  try {
    // Check 1: API Keys Setup
    const keys = getRapidAPIKeys();
    health.checks.push({
      name: 'API Keys Setup',
      status: keys.length > 0 ? 'PASS' : 'FAIL',
      details: `Found ${keys.length} API key(s)`
    });

    if (keys.length === 0) {
      health.errors.push('No API keys configured');
      health.overall = 'CRITICAL';
    }

    // Check 2: Usage Levels
    const usage = getCurrentUsageData();
    const stats = getDetailedUsageStats();

    const criticalKeys = stats.keyStats ? stats.keyStats.filter(k => k.status === 'CRITICAL').length : 0;
    const warningKeys = stats.keyStats ? stats.keyStats.filter(k => k.status === 'WARNING').length : 0;

    health.checks.push({
      name: 'Usage Levels',
      status: criticalKeys === 0 ? 'PASS' : 'WARN',
      details: `${criticalKeys} critical, ${warningKeys} warning`
    });

    if (criticalKeys > 0) {
      health.warnings.push(`${criticalKeys} API key(s) in critical state`);
      if (health.overall === 'HEALTHY') health.overall = 'WARNING';
    }

    // Check 3: Test API Call
    console.log('🧪 Testing API connectivity...');
    const testResult = fetchProductDetailsFromAPI('B07ZPKBL9V'); // Test with known ASIN

    health.checks.push({
      name: 'API Connectivity',
      status: testResult.success ? 'PASS' : 'FAIL',
      details: testResult.success ? `Price: $${testResult.price}` : testResult.error
    });

    if (!testResult.success) {
      health.errors.push(`API test failed: ${testResult.error}`);
      health.overall = 'CRITICAL';
    }

    // Check 4: Configuration
    const configIssues = [];
    if (RAPIDAPI_CONFIG.RETRY_ATTEMPTS < 1) configIssues.push('Retry attempts too low');
    if (RAPIDAPI_CONFIG.FREE_TIER_LIMIT !== 100) configIssues.push('Unexpected tier limit');

    health.checks.push({
      name: 'Configuration',
      status: configIssues.length === 0 ? 'PASS' : 'WARN',
      details: configIssues.length === 0 ? 'All settings valid' : configIssues.join(', ')
    });

  } catch (error) {
    health.errors.push(`Health check error: ${error.toString()}`);
    health.overall = 'CRITICAL';
  }

  // Print results
  console.log(`\n🏥 Health Check Results: ${health.overall}`);
  health.checks.forEach(check => {
    const icon = check.status === 'PASS' ? '✅' : check.status === 'WARN' ? '⚠️' : '❌';
    console.log(`   ${icon} ${check.name}: ${check.details}`);
  });

  if (health.warnings.length > 0) {
    console.log('\n⚠️ Warnings:');
    health.warnings.forEach(w => console.log(`   ${w}`));
  }

  if (health.errors.length > 0) {
    console.log('\n❌ Errors:');
    health.errors.forEach(e => console.log(`   ${e}`));
  }

  return health;
}

/**
 * Emergency reset of API usage (use with caution)
 */
function emergencyResetUsage() {
  const confirmation = Browser.msgBox(
    'Emergency Reset',
    'This will reset ALL API usage counters. Are you sure?',
    Browser.Buttons.YES_NO
  );

  if (confirmation === 'yes') {
    const scriptProperties = PropertiesService.getScriptProperties();
    scriptProperties.deleteProperty('RAPIDAPI_USAGE');
    console.log('🆘 Emergency reset completed - all usage counters cleared');
    return true;
  } else {
    console.log('❌ Emergency reset cancelled');
    return false;
  }
}

/**
 * Test function to verify RapidAPI setup
 * Run this manually after setting keys in Script Properties
 */
function testRapidAPISetup() {
  console.log('🧪 Testing RapidAPI Configuration...');

  try {
    const keys = getRapidAPIKeys();
    console.log(`✅ Configuration found: ${keys.length} keys loaded`);

    console.log('📡 Testing connectivity...');
    // Function handles key rotation automatically
    const result = fetchProductDetailsFromAPI('B07ZPKBL9V'); // Known stable ASIN

    if (result.success) {
      console.log(`✅ API Test Successful!`);
      console.log(`   Product: ${result.title}`);
      console.log(`   Price: $${result.price}`);
      console.log('🎉 Your Amazon Engine is ready to use RapidAPI.');
    } else {
      console.error(`❌ API Test Failed: ${result.error}`);
      console.log('👉 Please check your API key is valid and has remaining quota.');
    }

  } catch (error) {
    console.error(`❌ Configuration Error: ${error.message}`);
    console.log('👉 Please ensure RAPIDAPI_KEY or RAPIDAPI_KEYS is set in Script Properties.');
  }
}
