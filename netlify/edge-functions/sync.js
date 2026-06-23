const SHEET_ID = '1tgedHZhpaMkHZqKElL13jBm9f90HRzsW5EkoL8QaW24';

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
function fmtDate(v) {
  if (!v) return '';
  const s = String(v).trim();
  // Already MM/YYYY or similar
  if (s.match(/^\d{1,2}\/\d{4}$/)) return s;
  // ISO date string from Sheets API: "10/1/2024" or "2024-10-01"
  let d = new Date(s);
  if (isNaN(d)) return s;
  return (d.getMonth()+1) + '/' + d.getFullYear();
}
function monthKey(v) {
  if (!v) return null;
  const s = String(v).trim();
  // Sheets returns FORMATTED_STRING dates like "1/6/2022" (M/D/YYYY)
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) return mdy[3] + '-' + mdy[1].padStart(2,'0');
  const iso = s.match(/^(\d{4})-(\d{2})/);
  if (iso) return iso[1] + '-' + iso[2];
  return null;
}

async function fetchRange(tab, cols, apiKey) {
  const range = encodeURIComponent(`'${tab}'!A:${cols}`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?key=${apiKey}&valueRenderOption=FORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Sheets API error on "${tab}" (${r.status}): ${(await r.text()).slice(0,200)}`);
  return (await r.json()).values || [];
}

export default async function handler(request, context) {
  if (request.method === 'OPTIONS') return new Response(null, {status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'}});
  if (request.method !== 'POST') return new Response('Method not allowed', {status:405});

  const KEY = Deno.env.get('GOOGLE_API_KEY');
  if (!KEY) return new Response(JSON.stringify({error:'GOOGLE_API_KEY not set'}),{status:500,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}});

  try {
    const [masterRows, summaryRows, shelfRows, inRows, outRows] = await Promise.all([
      fetchRange('Product Database',   'K', KEY),
      fetchRange('Inventory Overview', 'J', KEY),
      fetchRange('Shelf Life',         'L', KEY),
      fetchRange('Receiving Inventory (IN)', 'I', KEY),
      fetchRange('Sending Inventory (OUT)',  'N', KEY),
    ]);

    // ── Product Database ──
    // SKU(0) Name(1) Desc(2) Line(3) Pkg(4) Price(5) Batch(6) Expiry(7) Size(8) Bin(9)
    const master = {};
    for (const row of masterRows.slice(1)) {
      const sku = clean(row[0]);
      if (!sku || sku === 'SKU') continue;
      master[sku] = {
        price:  parseNum(row[5]),
        batch:  clean(row[6]),
        expiry: fmtDate(row[7]),
        size:   clean(row[8]),
        bin:    clean(row[9]),
      };
    }

    // ── Inventory Overview ──
    // SKU(0) Name(1) Line(2) Category(3) Received(4) Sold(5) Stock(6)
    const products = [];
    for (const row of summaryRows.slice(1)) {
      const sku = clean(row[0]);
      if (!sku || sku === 'SKU') continue;
      const rawStock = row[6];
      if (typeof rawStock === 'string' && rawStock.toLowerCase().includes('inventory')) continue;
      const line = clean(row[2]);
      const rawCat = clean(row[3]);
      const category = (rawCat === 'MKT Samples' ? 'MKT SAMPLES' : rawCat === 'SKINPEN  MKT' ? 'SKINPEN MKT' : rawCat) || line || 'Other';
      const received = parseInteger(row[4]);
      const sold = parseInteger(row[5]);
      const stock = parseInteger(rawStock);
      const m = master[sku] || {};
      // Sell-through velocity: avg monthly sold (approximated from totals / months since first receive)
      // Will be enriched from out log below
      products.push({ sku, name:clean(row[1]), line, category, received, sold, stock,
        price:m.price??null, batch:m.batch||'', expiry:m.expiry||'', bin:m.bin||'', size:m.size||'' });
    }

    // ── Shelf Life — batch-level expiry data ──
    // Code(0) SKU_Code(1) SKU_Name(2) Line(3) Batch(4) Expiry(5) MonthsLeft(6) Qty(7) Out(8) SOH(9) Tag(10)
    const batches = [];
    for (const row of shelfRows.slice(2)) {
      const name   = clean(row[2]);
      const expiry = clean(row[5]);
      if (!name || !expiry) continue;
      const monthsLeft = parseNum(row[6]);
      batches.push({
        skuCode:  clean(row[1]),
        name,
        line:     clean(row[3]),
        batch:    clean(row[4]),
        expiry,
        monthsLeft: monthsLeft !== null ? Math.round(monthsLeft * 10) / 10 : null,
        qty:      parseInteger(row[7]),
        soh:      parseInteger(row[9]),
        tag:      clean(row[10]),
      });
    }
    // Sort FEFO: earliest expiry first
    batches.sort((a, b) => {
      const da = new Date(a.expiry), db = new Date(b.expiry);
      return (isNaN(da)?Infinity:da) - (isNaN(db)?Infinity:db);
    });

    // ── Monthly movement (last 13 months) ──
    const now = new Date();
    const months = [];
    let d = new Date(now.getFullYear(), now.getMonth(), 1);
    for (let i = 0; i < 13; i++) {
      months.unshift(d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0'));
      d = new Date(d.getFullYear(), d.getMonth()-1, 1);
    }

    const monthlyIn  = {};
    const monthlyOut = {};
    months.forEach(m => { monthlyIn[m]=0; monthlyOut[m]=0; });

    // Receiving: SKU(0) Name(1) Batch(2) QTY(3) Type(4) Expiry(5) DateReceived(6)
    for (const row of inRows.slice(1)) {
      const mk = monthKey(row[6]);
      if (mk && monthlyIn[mk] !== undefined && row[3]) {
        monthlyIn[mk] += parseInteger(row[3]);
      }
    }
    // Sending: SKU(0) Product(1) BPN(2) QTY(3) Order(4) OrderDate(5) DateDelivered(6) Customer(7) Batch(8) Expiry(9) Line(10) ... SalesMonth(13)
    const skuMonthlyOut = {};
    for (const row of outRows.slice(1)) {
      const mk = monthKey(row[6]);
      const sku = clean(row[0]);
      const qty = parseInteger(row[3]);
      if (mk && monthlyOut[mk] !== undefined && qty > 0) {
        monthlyOut[mk] += qty;
      }
      if (sku && qty > 0 && mk) {
        if (!skuMonthlyOut[sku]) skuMonthlyOut[sku] = {};
        skuMonthlyOut[sku][mk] = (skuMonthlyOut[sku][mk] || 0) + qty;
      }
    }

    // ── Enrich products with velocity & months of stock remaining ──
    const last6 = months.slice(-6);
    for (const p of products) {
      const mo = skuMonthlyOut[p.sku] || {};
      const avgVelocity = last6.reduce((a,m) => a + (mo[m]||0), 0) / 6;
      p.velocity = Math.round(avgVelocity * 10) / 10;
      p.monthsOfStock = avgVelocity > 0 && p.stock > 0 ? Math.round((p.stock / avgVelocity) * 10) / 10 : null;
    }

    // ── Inventory value by product line ──
    const valueByLine = {};
    for (const p of products) {
      if (p.stock > 0 && p.price) {
        valueByLine[p.line] = (valueByLine[p.line] || 0) + p.stock * p.price;
      }
    }

    if (products.length < 5) throw new Error(`Only ${products.length} products parsed`);

    return new Response(JSON.stringify({
      products,
      batches,
      monthlyIn,
      monthlyOut,
      months,
      valueByLine,
      synced: new Date().toISOString(),
    }), {
      status: 200,
      headers: { 'Content-Type':'application/json', 'Access-Control-Allow-Origin':'*', 'Cache-Control':'no-store' },
    });

  } catch(err) {
    return new Response(JSON.stringify({error: err.message}), {status:502, headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}});
  }
}

export const config = { path: '/api/sync' };
