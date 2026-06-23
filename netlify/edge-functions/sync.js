const SHEET_ID = '1tgedHZhpaMkHZqKElL13jBm9f90HRzsW5EkoL8QaW24';

// Exact tab names from the workbook
const MASTER_TAB   = 'Product Database';   // SKU(A) Name(B) Desc(C) Line(D) Pkg(E) Price(F) Batch(G) Expiry(H) Size(I) Bin(J) Stock(K)
const SUMMARY_TAB  = 'Inventory Overview'; // SKU(A) Name(B) Line(C) Category(D) Received(E) Sold(F) Stock(G)

function parseNum(v) {
  if (v == null || v === '' || v === '-') return null;
  const n = parseFloat(String(v).replace(/[₱,\s]/g, ''));
  return isNaN(n) ? null : n;
}

function parseInteger(v) {
  if (v == null || v === '' || v === '-') return 0;
  const n = parseInt(String(v).replace(/[^-0-9]/g, ''), 10);
  return isNaN(n) ? 0 : n;
}

function clean(v) {
  if (v == null) return '';
  return String(v).replace(/^-$/, '').trim();
}

function fmtExpiry(v) {
  if (!v) return '';
  // Dates come back as formatted strings e.g. "Oct 2024" or "10/1/2024"
  // Normalise to MM/YYYY
  if (v instanceof Date || (typeof v === 'string' && v.match(/^\d{4}-\d{2}-\d{2}/))) {
    const d = new Date(v);
    if (!isNaN(d)) return (d.getMonth() + 1) + '/' + d.getFullYear();
  }
  return String(v).trim();
}

async function fetchSheet(tab, apiKey) {
  const range = encodeURIComponent(`'${tab}'!A:K`);
  // FORMATTED_VALUE returns computed formula results as displayed in the sheet
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?key=${apiKey}&valueRenderOption=FORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`;
  const r = await fetch(url);
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`Sheets API error on tab "${tab}" (${r.status}): ${err.slice(0, 300)}`);
  }
  const data = await r.json();
  return data.values || [];
}

export default async function handler(request, context) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
  if (!GOOGLE_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'GOOGLE_API_KEY not set in Netlify environment variables.' }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }

  try {
    // Fetch both tabs in parallel
    const [masterRows, summaryRows] = await Promise.all([
      fetchSheet(MASTER_TAB, GOOGLE_API_KEY),
      fetchSheet(SUMMARY_TAB, GOOGLE_API_KEY),
    ]);

    // --- Parse Product Database ---
    // Cols: SKU(0) Name(1) Desc(2) Line(3) Pkg(4) Price(5) Batch(6) Expiry(7) Size(8) Bin(9) Stock(10)
    const master = {};
    for (const row of masterRows.slice(1)) {
      const sku = clean(row[0]);
      if (!sku || sku.toUpperCase() === 'SKU') continue;
      master[sku] = {
        price:  parseNum(row[5]),
        batch:  clean(row[6]),
        expiry: fmtExpiry(row[7]),
        size:   clean(row[8]),
        bin:    clean(row[9]),
      };
    }

    // --- Parse Inventory Overview ---
    // Cols: SKU(0) Name(1) Line(2) Category(3) Received(4) Sold(5) Stock(6)
    // Row 0 is header; row 1 col 6 has a label like "Inventory Level : 25916" — skip it
    const products = [];
    for (const row of summaryRows.slice(1)) {
      const sku = clean(row[0]);
      if (!sku || sku.toUpperCase() === 'SKU') continue;
      // Skip rows where col G is a label string (the total row)
      const rawStock = row[6];
      if (typeof rawStock === 'string' && rawStock.toLowerCase().includes('inventory level')) continue;
      const stockVal = parseInteger(rawStock);
      const m = master[sku] || {};
      products.push({
        sku,
        name:     clean(row[1]),
        line:     clean(row[2]),
        category: clean(row[3]),
        received: parseInteger(row[4]),
        sold:     parseInteger(row[5]),
        stock:    stockVal,
        price:    m.price  ?? null,
        batch:    m.batch  || '',
        expiry:   m.expiry || '',
        bin:      m.bin    || '',
        size:     m.size   || '',
      });
    }

    if (products.length < 5) {
      throw new Error(`Only ${products.length} products parsed — check sheet sharing settings or tab names`);
    }

    return new Response(JSON.stringify({ products, synced: new Date().toISOString() }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
    });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 502, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }
}

export const config = { path: '/api/sync' };
