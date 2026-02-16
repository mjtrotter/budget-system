
/**
 * PHASE 3: AMAZON SCRAPER VERIFICATION
 * Tests the robustness of the "Cart URL" scraping approach without RapidAPI.
 */
function testAmazonScraperRobustness() {
    console.log('🧪 Starting Amazon Scraper Robustness Test...');

    const engine = new AmazonWorkflowEngine();

    // 1. Define Test Items (Real ASINs ensuring mixed categories)
    const testItems = [
        { asin: 'B08N5KWB9H', description: 'Tech: Webcam' },
        { asin: '0310771804', description: 'Book: Jesus Storybook Bible' },
        { asin: 'B075CYMYK6', description: 'Office: Sharpie Pens' }
    ];

    // 2. Build Cart URL
    console.log('🔗 Step 1: Generating Multi-Item Cart URL');
    const cartUrl = engine.generateMultiItemCartUrl(testItems.map(i => ({ asin: i.asin, quantity: 1 })));
    console.log(`   URL: ${cartUrl}`);

    // 3. Fetch Cart HTML
    console.log('🌐 Step 2: Fetching Cart HTML (Optimized Request)');
    // Start with a clean cache/session if possible (not applicable in strict Apps Script state)
    const response = engine.makeOptimizedCartRequest(cartUrl);
    const html = response.getContentText();

    if (response.getResponseCode() !== 200) {
        console.error(`❌ HTTP Error: ${response.getResponseCode()}`);
        return;
    }

    // 4. Parse Items
    console.log('🔍 Step 3: Parsing Cart Items');
    const parsedItems = engine.parseAllCartItems(html);

    // 5. Verification Logic
    console.log('📊 Step 4: Verification Results');
    console.log(`   Expected: ${testItems.length} items`);
    console.log(`   Found: ${parsedItems.length} items`);

    let passCount = 0;

    testItems.forEach(testItem => {
        const found = parsedItems.find(p => p.asin === testItem.asin);
        if (found) {
            console.log(`   ✅ Matched ${testItem.asin}: $${found.unitPrice} - "${found.title.substring(0, 30)}..."`);
            if (found.unitPrice > 0) passCount++;
        } else {
            console.error(`   ❌ Failed to find ${testItem.asin} (${testItem.description})`);
        }
    });

    if (passCount === testItems.length) {
        console.log('✅ TEST PASSED: All items scraped successfully.');
    } else {
        console.warn('⚠️ TEST FAILED: Some items missing. Check selectors or blocking.');
    }
}

function runAmazonScraperTest() {
    testAmazonScraperRobustness();
}
