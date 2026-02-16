/**
 * ============================================================================
 * PEX CARD INTEGRATION BRIDGE
 * ============================================================================
 * Ported from SIS-Finance/PEXService.ts
 * Adapts PEX API interactions for Google Apps Script environment.
 * 
 * Dependencies:
 * - PropertiesService (PEX_APP_ID, PEX_APP_SECRET, PEX_ADMIN_TOKEN)
 * - UrlFetchApp (API calls)
 * - Automated Hub (PEXCards sheet)
 * ============================================================================
 */

class PEXBridge {
  constructor() {
    this.baseUrl = 'https://coreapi.pexcard.com/v4';
    this.props = PropertiesService.getScriptProperties();
    this.cache = CacheService.getScriptCache();
    
    // Configuration
    this.TOKEN_CACHE_KEY = 'PEX_ACCESS_TOKEN';
    this.TOKEN_EXPIRY_BUFFER = 300; // 5 minutes buffer
  }

  // =========================================================================
  // AUTHENTICATION
  // =========================================================================

  /**
   * authenticate
   * Obtains a valid auth token either from cache or via API login
   */
  authenticate() {
    // 1. Try Cache
    const cachedToken = this.cache.get(this.TOKEN_CACHE_KEY);
    if (cachedToken) {
      return cachedToken;
    }

    // 2. Try Properties (Long-lived token)
    const storedToken = this.props.getProperty('PEX_ADMIN_TOKEN');
    if (storedToken) {
      // Validate it first? For now assume it's valid if manually set
      return storedToken;
    }

    // 3. Login via API (if App ID/Secret provided)
    const appId = this.props.getProperty('PEX_APP_ID');
    const appSecret = this.props.getProperty('PEX_APP_SECRET');

    if (!appId || !appSecret) {
      console.error('PEX Credentials missing in Script Properties');
      throw new Error('PEX Authentication Failed: Missing Credentials');
    }

    return this.login(appId, appSecret);
  }

  /**
   * Exchange credentials for token
   */
  login(appId, appSecret) {
    const credentials = Utilities.base64Encode(`${appId}:${appSecret}`);
    
    const options = {
      method: 'post',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json'
      },
      muteHttpExceptions: true
    };

    try {
      const response = UrlFetchApp.fetch(`${this.baseUrl}/Token`, options);
      const code = response.getResponseCode();
      const content = response.getContentText();

      if (code === 200) {
        const data = JSON.parse(content);
        const token = data.Token;
        // Cache for 20 minutes (API tokens usually last longer, but safe side)
        this.cache.put(this.TOKEN_CACHE_KEY, token, 1200); 
        return token;
      } else {
        throw new Error(`PEX Login Failed: ${code} - ${content}`);
      }
    } catch (e) {
      console.error('PEX Login Error', e);
      throw e;
    }
  }

  /**
   * Helper to get standard headers
   */
  getHeaders() {
    const token = this.authenticate();
    return {
      'Authorization': `token ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  // =========================================================================
  // CARD OPERATIONS
  // =========================================================================

  /**
   * fundCard
   * Adds funds to a specific card
   * @param {string} pexAccountId - The internal PEX Account ID (not card number)
   * @param {number} amount - Amount to fund
   * @param {string} note - Reason for funding
   */
  fundCard(pexAccountId, amount, note = '') {
    if (!pexAccountId) throw new Error('Missing PEX Account ID');
    if (amount <= 0) throw new Error('Invalid funding amount');

    const url = `${this.baseUrl}/Card/Fund/${pexAccountId}`;
    const payload = {
      Amount: amount,
      Note: note
    };

    const options = {
      method: 'post',
      headers: this.getHeaders(),
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    try {
      const response = UrlFetchApp.fetch(url, options);
      const code = response.getResponseCode();
      
      if (code === 200) {
        const result = JSON.parse(response.getContentText());
        console.log(`Funded card ${pexAccountId} with $${amount}`);
        return { success: true, balance: result.AvailableBalance };
      } else {
        console.error(`Funding failed: ${response.getContentText()}`);
        return { success: false, error: response.getContentText() };
      }
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * getCardDetails
   * Fetches current balance and status
   */
  getCardDetails(pexAccountId) {
    const url = `${this.baseUrl}/Details/AccountDetails/${pexAccountId}`;
    const options = {
      method: 'get',
      headers: this.getHeaders(),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    if (response.getResponseCode() === 200) {
      return JSON.parse(response.getContentText());
    }
    return null;
  }

  // =========================================================================
  // TRANSACTION SYNC
  // =========================================================================

  /**
   * fetchTransactions
   * frequent call to get recent spend
   */
  fetchTransactions(startDate, endDate) {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 24 * 60 * 60 * 1000); // Default 24h
    const end = endDate ? new Date(endDate) : new Date();

    // /Details/TransactionList is an alternative if NetworkTransactions is too restricted
    // But PEXService.ts used NetworkTransactions which usually gives settled data.
    // Let's use TransactionList for broader view including pending.
    
    // Note: PEX API structure for bulk transactions usually requires iterating cards or using a Business Admin endpoint.
    // Using /Business/Transactions if available, otherwise iterate known cards.
    // For now, let's assume we maintain a list of ACTIVE cards in our Sheet.
    
    return this.syncAllCards(start, end);
  }

  syncAllCards(startDate, endDate) {
    const activeCards = this.getActiveCardsFromSheet(); // We need to implement this
    const allTransactions = [];

    activeCards.forEach(card => {
      const txns = this.getCardTransactions(card.pexAccountId, startDate, endDate);
      allTransactions.push(...txns);
    });

    return allTransactions;
  }

  getCardTransactions(pexAccountId, startDate, endDate) {
    // Format dates as ISO
    const startIso = startDate.toISOString();
    const endIso = endDate.toISOString();

    const url = `${this.baseUrl}/Details/TransactionList/${pexAccountId}?StartDate=${startIso}&EndDate=${endIso}`;
    
    const options = {
        method: 'get',
        headers: this.getHeaders(),
        muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    if (response.getResponseCode() === 200) {
        const data = JSON.parse(response.getContentText());
        return data.TransactionList || [];
    }
    return [];
  }

  // =========================================================================
  // DATA HELPERS
  // =========================================================================

  /**
   * Reads PEXCards from the Automated Hub
   * Expected Columns: Email, PEXAccountId, CardData...
   */
  getActiveCardsFromSheet() {
    const hub = SpreadsheetApp.openById(CONFIG.AUTOMATED_HUB_ID);
    const sheet = hub.getSheetByName('PEXCards');
    if (!sheet) {
      console.warn('PEXCards sheet not found.');
      return [];
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const cards = [];

    // Simple parser
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        // Assume Col A=Email, B=PEXAccountId, C=Status
        if (row[1] && row[2] !== 'Terminated') {
            cards.push({
                email: row[0],
                pexAccountId: row[1],
                status: row[2]
            });
        }
    }
    return cards;
  }
}

// Global Export
function getPEXBridge() {
  return new PEXBridge();
}
