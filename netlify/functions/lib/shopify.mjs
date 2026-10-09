// Shared Shopify Admin helpers for functions that read orders on demand.
// (shopify-build-background and backfill-background keep their own client for now;
//  the internal-order rule below is the one they use — see isInternal.)
const STORE_HANDLE = process.env.SHOPIFY_STORE || 'healthspan-global';
const API = 'https://' + STORE_HANDLE + '.myshopify.com/admin/api/2025-01/graphql.json';

// Dev Dashboard apps: Client ID + Secret → ~24h token (client-credentials grant);
// a legacy shpat_ token in SHOPIFY_ADMIN_TOKEN still works as a fallback.
export async function getAccessToken() {
  const legacy = (process.env.SHOPIFY_ADMIN_TOKEN || '').trim();
  if (legacy.startsWith('shpat_')) return legacy;
  const id = (process.env.SHOPIFY_CLIENT_ID || '').trim();
  const secret = (process.env.SHOPIFY_CLIENT_SECRET || (legacy.startsWith('shpss_') ? legacy : '')).trim();
  if (!id || !secret) throw new Error('Shopify is not configured on the server (SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET)');
  const r = await fetch('https://' + STORE_HANDLE + '.myshopify.com/admin/oauth/access_token', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials', client_id: id, client_secret: secret })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error('Shopify token exchange failed (HTTP ' + r.status + ')');
  return j.access_token;
}

export async function gql(token, query, variables) {
  const r = await fetch(API, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables })
  });
  if (!r.ok) { const e = new Error('Shopify HTTP ' + r.status); e.status = r.status; throw e; }
  const j = await r.json();
  if (j.errors && !j.data) { const e = new Error('Shopify GraphQL: ' + JSON.stringify(j.errors).slice(0, 200)); e.throttled = /THROTTLED/i.test(JSON.stringify(j.errors)); throw e; }
  return j.data;
}

/* Remedy branches and Healthspan's own staff / academy are customers too, but not
   sales: accounting excludes them. An order is internal when ANY tag starts with a
   Remedy/Healthspan marker, or the customer name begins with one (anchored on purpose —
   a real clinic in Ayala Vertis North is not Remedy Vertis). Same rule as the cache build. */
export const INT_TAG = /^(remedy|reemdy|healthspan)/i;
export const INT_CUST = /^(remedy|reemdy|healthspan)\b|^(remedy|reemdy)\s+(vertis|gh\s+mall|bgc)\b|^(april\s+geraldez|angela\s+dacones)\b/i;
export function isInternal(custName, tags) {
  const t = Array.isArray(tags) ? tags : [tags];
  return t.some(x => INT_TAG.test(String(x || '').trim())) || INT_CUST.test(String(custName || '').trim());
}
