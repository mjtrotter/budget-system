/**
 * ============================================================================
 * STRIPE DESIGNATED FUNDS MANAGER
 * ============================================================================
 * Manages collections for trips, fees, and donations via Stripe.
 * Features:
 * - Create Payment Links (Checkout Sessions)
 * - Poll for recent payments (Reconciliation)
 * 
 * Dependencies:
 * - PropertiesService (STRIPE_SECRET_KEY)
 * - UrlFetchApp
 * ============================================================================
 */

class StripeManager {
  constructor() {
    this.baseUrl = 'https://api.stripe.com/v1';
    this.props = PropertiesService.getScriptProperties();
    this.secretKey = this.props.getProperty('STRIPE_SECRET_KEY');
    
    if (!this.secretKey) {
      console.warn('STRIPE_SECRET_KEY not found in Script Properties');
    }
  }

  getHeaders() {
    return {
      'Authorization': `Bearer ${this.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    };
  }

  /**
   * createPaymentLink
   * Generates a reusable or one-time payment link for an event
   * @param {string} name - Event name (e.g. "Washington DC Trip")
   * @param {number} amountCents - Amount in CENTS (e.g. 50000 for $500.00)
   * @param {object} metadata - Custom data (e.g. { budgetCode: 'TRIP-DC-2026' })
   */
  createPaymentLink(name, amountCents, metadata = {}) {
    // 1. Create Price Object
    const pricePayload = {
      'currency': 'usd',
      'unit_amount': amountCents.toString(),
      'product_data[name]': name
    };
    
    // Add Metadata to product
    Object.keys(metadata).forEach(key => {
      pricePayload[`product_data[metadata][${key}]`] = metadata[key];
    });

    const price = this._post('/prices', pricePayload);
    if (!price || !price.id) throw new Error('Failed to create Stripe Price');

    // 2. Create Payment Link
    const linkPayload = {
      'line_items[0][price]': price.id,
      'line_items[0][quantity]': '1',
      'metadata[budgetCode]': metadata.budgetCode || '', // Pass through for reconciliation
      'after_completion[type]': 'hosted_confirmation',
      'after_completion[hosted_confirmation][custom_message]': `Thank you for your payment for ${name}.`
    };

    const link = this._post('/payment_links', linkPayload);
    return link ? link.url : null;
  }

  /**
   * fetchRecentPayments
   * Gets successful checkout sessions from the last X hours
   */
  fetchRecentPayments(hoursLookback = 24) {
    // Unix timestamp
    const startTime = Math.floor((Date.now() - (hoursLookback * 3600 * 1000)) / 1000);
    
    const payload = {
      'created[gte]': startTime.toString(),
      'status': 'complete',
      'expand[]': 'data.line_items',
      'limit': '100'
    };
    
    // We want Checkout Sessions
    const response = this._get('/checkout/sessions', payload);
    return response.data || [];
  }

  // =========================================================================
  // INTERNAL HELPERS
  // =========================================================================

  _post(endpoint, payload) {
    return this._request('post', endpoint, payload);
  }

  _get(endpoint, params) {
    // Construct query string
    const query = Object.keys(params)
      .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
      .join('&');
    return this._request('get', `${endpoint}?${query}`);
  }

  _request(method, endpoint, payload = null) {
    const url = `${this.baseUrl}${endpoint}`;
    const options = {
      method: method,
      headers: this.getHeaders(),
      muteHttpExceptions: true
    };
    
    if (payload) {
      // UrlFetchApp handles object -> form-urlencoded automatically if payload is object
      // But nested objects need distinct handling often. 
      // Stripe accepts standard form-encoding.
      options.payload = payload;
    }

    try {
      const response = UrlFetchApp.fetch(url, options);
      const code = response.getResponseCode();
      const content = response.getContentText();
      
      if (code >= 200 && code < 300) {
        return JSON.parse(content);
      } else {
        console.error(`Stripe Request Failed [${code}]: ${content}`);
        return null;
      }
    } catch (e) {
      console.error('Stripe Exception', e);
      throw e;
    }
  }
}

// Global Export
function getStripeManager() {
  return new StripeManager();
}
