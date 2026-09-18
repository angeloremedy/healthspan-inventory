const env = (k, d) => {
  const v = process.env[k];
  return v === undefined || v === '' ? d : v;
};
const bool = (k, d) => String(env(k, d)).toLowerCase() === 'true';

export const config = {
  gcpProject: env('GCP_PROJECT'),
  pubsubTopic: env('PUBSUB_TOPIC', 'shopify-events'),

  // 'firestore' in production; 'memory' for local runs and the offline test suite.
  storeBackend: env('STORE_BACKEND', 'firestore'),

  shopify: {
    shop: env('SHOPIFY_SHOP'),
    apiVersion: env('SHOPIFY_API_VERSION', '2026-07'),
    // Legacy admin-created custom app: a permanent offline token (shpat_...).
    // Shopify stopped allowing new ones on 2026-01-01.
    adminToken: env('SHOPIFY_ADMIN_TOKEN'),
    // Dev Dashboard app in the same Shopify organization: client credentials grant,
    // which returns an access token that expires after 24h and must be re-fetched.
    clientId: env('SHOPIFY_CLIENT_ID'),
    clientSecret: env('SHOPIFY_CLIENT_SECRET'),
    // Shopify signs webhooks with the app's client secret, so it defaults to it.
    webhookSecret: env('SHOPIFY_WEBHOOK_SECRET', env('SHOPIFY_CLIENT_SECRET')),
    // Inventory sync target; auto-detected when the store has exactly one active location.
    locationId: env('SHOPIFY_LOCATION_ID'),
  },

  inventory: {
    enabled: bool('INVENTORY_SYNC', 'false'),
    topic: env('INVENTORY_TOPIC', 'inventory-sync'),
    schedule: env('INVENTORY_SCHEDULE', '*/5 * * * *'),
  },

  qbo: {
    clientId: env('QBO_CLIENT_ID'),
    clientSecret: env('QBO_CLIENT_SECRET'),
    env: env('QBO_ENV', 'sandbox'),
    redirectUri: env('QBO_REDIRECT_URI'),
    incomeAccountId: env('QBO_INCOME_ACCOUNT_ID'),
    shippingItemId: env('QBO_SHIPPING_ITEM_ID'),
    adjustmentItemId: env('QBO_ADJUSTMENT_ITEM_ID'),
    depositAccountId: env('QBO_DEPOSIT_ACCOUNT_ID'),
    paymentMethodId: env('QBO_PAYMENT_METHOD_ID'),
    invoiceTermsDays: Number(env('QBO_INVOICE_TERMS_DAYS', 30)),
    // total = send Shopify's VAT as a TotalTax override
    // code  = lines carry the tax code and QBO computes the VAT itself (needed by some global editions)
    // none  = not VAT registered
    taxMode: env('QBO_TAX_MODE', 'code'),
    taxCodeId: env('QBO_TAX_CODE_ID'),
    nonTaxCodeId: env('QBO_NON_TAX_CODE_ID', 'NON'),
    // Whether the QBO document is built tax-inclusive. Some global-edition companies ignore
    // GlobalTaxCalculation=TaxInclusive and add VAT on top; for those, set false and the
    // connector strips VAT out of Shopify's inclusive prices before posting.
    taxInclusive: bool('QBO_TAX_INCLUSIVE', 'true'),
    // Fallback VAT rate when a Shopify line carries no tax_lines (PH standard rate).
    vatRate: Number(env('QBO_VAT_RATE', '0.12')),
    // Reject the sync instead of posting a document whose total != the Shopify total.
    strictTotals: bool('QBO_STRICT_TOTALS', 'false'),
    // Allow rewriting lines on an invoice that already has a payment applied.
    allowPaidInvoiceEdit: bool('QBO_ALLOW_PAID_INVOICE_EDIT', 'false'),
    // QBO customer used for orders with no customer record and no contact details.
    anonymousCustomerName: env('QBO_ANONYMOUS_CUSTOMER_NAME', 'Anonymous'),
    // Cancellation of an UNPAID order: same month as the invoice -> void. A different month
    // never reopens the closed period; instead: 'manual' (leave it, log it) or 'credit_memo'
    // (create a Credit Memo mirroring the invoice and apply it).
    crossMonthCancel: env('QBO_CROSS_MONTH_CANCEL', 'manual'), // manual | credit_memo
    timezone: env('QBO_TIMEZONE', 'Asia/Manila'),
    // Class stamped on every line the connector writes (e.g. "Sales"). Empty = none.
    classId: env('QBO_CLASS_ID'),
    // Record QBO Payments when Shopify marks an order paid. STANDARD = true.
    // Healthspan runs false: Collections confirms receipt and records payments in QBO by hand,
    // so a Shopify "paid" flag must not create a Payment. Invoices, refunds, cancellations unaffected.
    syncPayments: bool('SYNC_PAYMENTS', 'true'),
    // How a Shopify discount appears on the invoice:
    //   net    = the item line carries the discounted amount; the discount is only in the description
    //   line   = item line at LIST price + a separate negative "Discount" item line (same tax code)
    //   native = item lines at LIST price + QBO's own Discount field (percent when it is a clean
    //            percentage, else an amount). Exact only when every line shares one tax treatment
    //            and there is no shipping/tip on the invoice; other orders fall back to 'line'.
    discountStyle: env('QBO_DISCOUNT_STYLE', 'net'), // net | line | native
    // Item used for the negative discount lines (style=line). Found/created by name.
    discountItemId: env('QBO_DISCOUNT_ITEM_ID'),
    discountItemName: env('QBO_DISCOUNT_ITEM_NAME', 'Discount'),
    // Income account for that item; defaults to the sales income account.
    discountAccountId: env('QBO_DISCOUNT_ACCOUNT_ID'),
  },

  itemMatch: env('ITEM_MATCH', 'sku'), // sku | name
  // Largest acceptable difference (currency units) between a QBO total and Shopify's.
  centTolerance: Number(env('TOTAL_TOLERANCE', '0.02')),
};

export const qboBaseUrl = () =>
  config.qbo.env === 'production'
    ? 'https://quickbooks.api.intuit.com/v3/company'
    : 'https://sandbox-quickbooks.api.intuit.com/v3/company';

/** Fail fast at cold start rather than halfway through an order. */
export function assertConfig({ requireShopify = true, requireQbo = true } = {}) {
  const missing = [];
  if (requireShopify) {
    if (!config.shopify.shop) missing.push('SHOPIFY_SHOP');
    if (!config.shopify.webhookSecret) missing.push('SHOPIFY_WEBHOOK_SECRET (or SHOPIFY_CLIENT_SECRET)');
    const hasLegacy = Boolean(config.shopify.adminToken);
    const hasClientCreds = Boolean(config.shopify.clientId && config.shopify.clientSecret);
    if (!hasLegacy && !hasClientCreds) {
      missing.push('SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET (or a legacy SHOPIFY_ADMIN_TOKEN)');
    }
  }
  if (requireQbo) {
    if (!config.qbo.clientId) missing.push('QBO_CLIENT_ID');
    if (!config.qbo.clientSecret) missing.push('QBO_CLIENT_SECRET');
    if (!config.qbo.incomeAccountId) missing.push('QBO_INCOME_ACCOUNT_ID');
    if (!config.qbo.depositAccountId) missing.push('QBO_DEPOSIT_ACCOUNT_ID');
    if (config.qbo.taxMode !== 'none' && !config.qbo.taxCodeId) missing.push('QBO_TAX_CODE_ID');
  }
  if (!['total', 'code', 'none'].includes(config.qbo.taxMode)) {
    missing.push('QBO_TAX_MODE (must be "total", "code" or "none")');
  }
  if (missing.length) throw new Error(`Missing/invalid config: ${missing.join(', ')}`);
}
