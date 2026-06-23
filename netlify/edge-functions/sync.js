const SHEET_ID = '1tgedHZhpaMkHZqKElL13jBm9f90HRzsW5EkoL8QaW24';

function pNum(v) {
  if (v == null || v === '' || v === '-') return null;
  const n = parseFloat(String(v).replace(/[₱,\s]/g, ''));
  return isNaN(n) ? null : n;
}
function pInt(v) {
  if (v == null || v === '' || v === '-') return 0;
  const n = parseInt(String(v).replace(/[^-0-9]/g, ''), 10);
  return isNaN(n) ? 0 : n;
}
function clean(v) { return v == null ? '' : String(v).replace(/^-$/, '').trim(); }
function fmtExp(v) {
  if (!v) return '';
  const s = String(v).trim();
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) return mdy[1] + '/' + mdy[3];
  if (s.match(/^\d{1,2}\/\d{4}$/)) return s;
  return s;
}
// Google Sheets serial date -> YYYY-MM
function serialMK(serial) {
  if (!serial || typeof serial !== 'number' || serial < 1) return null;
  const d = new Date((serial - 25569) * 86400000);
  if (isNaN(d.getTime())) return null;
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0');
}
// Google Sheets serial date -> MM/YYYY string
function serialToExpiry(serial) {
  if (!serial || typeof serial !== 'number' || serial < 1) return '';
  const d = new Date((serial - 25569) * 86400000);
  if (isNaN(d.getTime())) return '';
  return (d.getUTCMonth() + 1) + '/' + d.getUTCFullYear();
}

let KEY = '';

async function getFmt(tab, cols) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent("'"+tab+"'!A:"+cols)}?key=${KEY}&valueRenderOption=FORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Sheets "${tab}" (${r.status}): ${(await r.text()).slice(0,150)}`);
  return (await r.json()).values || [];
}
async function getRaw(tab, cols) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent("'"+tab+"'!A:"+cols)}?key=${KEY}&valueRenderOption=UNFORMATTED_VALUE`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Sheets "${tab}" (${r.status}): ${(await r.text()).slice(0,150)}`);
  return (await r.json()).values || [];
}

export default async function handler(request, context) {
  if (request.method === 'OPTIONS') return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'}});
  if (request.method !== 'POST') return new Response('Method not allowed',{status:405});
  KEY = Deno.env.get('GOOGLE_API_KEY') || '';
  if (!KEY) return new Response(JSON.stringify({error:'GOOGLE_API_KEY not set'}),{status:500,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}});

  try {
    const [dbRows, ovRows, shelfRows, priceRows, inRows, outRows, poRows] = await Promise.all([
      getFmt('Product Database',         'K'),  // masterfile
      getRaw('Inventory Overview',       'J'),  // stock levels + expiry (raw for serial dates)
      getFmt('Shelf Life',               'L'),  // batch expiry
      getRaw('Price',                    'E'),  // supplemental prices
      getRaw('Receiving Inventory (IN)', 'I'),  // serial dates
      getRaw('Sending Inventory (OUT)',  'R'),  // serial dates, cols to R for branch data
      getRaw('Pull-out Orders (INTERNAL)','S'), // internal pull-outs
    ]);

    // ── Price lookups (two sources) ──
    // Product Database: SKU(0) Name(1) .. Price(5)
    const pricesBySku = {};
    for (const row of dbRows.slice(1)) {
      const sku = clean(row[0]);
      if (!sku) continue;
      const p = pNum(row[5]);
      if (p && p > 0) pricesBySku[sku] = p;
    }
    // Price tab: Lineitem sku(0) Name(1) .. Price(4)
    for (const row of priceRows.slice(1)) {
      const sku = clean(row[0]);
      const p = pNum(row[4]);
      if (sku && p && p > 0 && !pricesBySku[sku]) pricesBySku[sku] = p;
    }

    // ── Product Database — bin, batch, expiry, size ──
    const master = {};
    for (const row of dbRows.slice(1)) {
      const sku = clean(row[0]);
      if (!sku || sku === 'SKU') continue;
      master[sku] = { price: pricesBySku[sku] ?? null, batch: clean(row[6]), expiry: fmtExp(row[7]), size: clean(row[8]), bin: clean(row[9]) };
    }

    // ── Inventory Overview — stock, received, sold, expiry ──
    // UNFORMATTED: SKU(0) Name(1) Line(2) Category(3) Received(4) Sold(5) Stock(6) ?(7) Notes(8) ExpirySerial(9)
    const products = [];
    const currentStock = {}; // sku -> stock
    const lastSaleDate = {}; // populated below from OUT log
    for (const row of ovRows.slice(1)) {
      const sku = clean(row[0]);
      if (!sku || sku === 'SKU') continue;
      const rawStock = row[6];
      if (typeof rawStock === 'string' && String(rawStock).toLowerCase().includes('inventory')) continue;
      const stock = pInt(rawStock);
      const line = clean(row[2]);
      const rawCat = clean(row[3]);
      const category = (rawCat === 'MKT Samples' ? 'MKT SAMPLES' : rawCat === 'SKINPEN  MKT' ? 'SKINPEN MKT' : rawCat) || line || 'Other';
      const m = master[sku] || {};
      const expiry = m.expiry || serialToExpiry(row[9]);
      currentStock[sku] = stock;
      products.push({ sku, name: clean(row[1]), line, category,
        received: pInt(row[4]), sold: pInt(row[5]), stock,
        price: pricesBySku[sku] ?? null,
        batch: m.batch || '', expiry, bin: m.bin || '', size: m.size || '' });
    }

    // ── Shelf Life — batch-level FEFO data ──
    const batches = [];
    for (const row of shelfRows.slice(2)) {
      const name = clean(row[2]); const expiry = fmtExp(clean(row[5]));
      if (!name || !expiry) continue;
      batches.push({ skuCode: clean(row[1]), name, line: clean(row[3]), batch: clean(row[4]),
        expiry, monthsLeft: pNum(row[6]), qty: pInt(row[7]), soh: pInt(row[9]), tag: clean(row[10]) });
    }
    batches.sort((a, b) => {
      const pa = a.expiry.match(/^(\d{1,2})\/(\d{4})$/), pb = b.expiry.match(/^(\d{1,2})\/(\d{4})$/);
      const da = pa ? new Date(+pa[2],+pa[1]-1,1) : new Date(9999,0,1);
      const db = pb ? new Date(+pb[2],+pb[1]-1,1) : new Date(9999,0,1);
      return da - db;
    });

    // ── Monthly movement + last sale date + branch transfers ──
    const now = new Date();
    const months = [];
    let md = new Date(now.getFullYear(), now.getMonth(), 1);
    for (let i = 0; i < 13; i++) { months.unshift(md.getFullYear()+'-'+String(md.getMonth()+1).padStart(2,'0')); md = new Date(md.getFullYear(),md.getMonth()-1,1); }
    const monthlyIn  = Object.fromEntries(months.map(m=>[m,0]));
    const monthlyOut = Object.fromEntries(months.map(m=>[m,0]));
    const skuMonthlyOut = {};

    // Receiving: SKU(0) Name(1) Batch(2) QTY(3) Type(4) Expiry(5) DateSerial(6)
    const receivedTotal = {};
    for (const row of inRows.slice(1)) {
      const mk = serialMK(row[6]); const qty = pInt(row[3]);
      const sku = clean(row[0]);
      if (qty > 0 && sku) receivedTotal[sku] = (receivedTotal[sku]||0) + qty;
      if (mk && monthlyIn[mk] !== undefined && qty > 0) monthlyIn[mk] += qty;
    }

    // Branch mappings
    const BRANCH_KEYWORDS = {
      'APRIL GERALDEZ': 'BGC', 'APRIL': 'BGC', 'REMEDY BGC': 'BGC', 'ANGELA DACONES': 'BGC', 'ANGELA': 'BGC',
      'REMEDY VERTIS': 'Vertis North', 'VERTIS': 'Vertis North', 'MICH': 'Vertis North',
      'REMEDY GH': 'GH Mall', 'GH MALL': 'GH Mall',
    };
    const branchTransfers = []; // recent transfers
    const soldTotal = {};
    // Sending: SKU(0) Product(1) BPN(2) QTY(3) Order(4) OrderDate(5) DateSerial(6) Customer(7) Batch(8) Expiry(9) Line(10)
    for (const row of outRows.slice(1)) {
      const mk = serialMK(row[6]); const qty = pInt(row[3]); const sku = clean(row[0]);
      if (qty > 0 && sku) soldTotal[sku] = (soldTotal[sku]||0) + qty;
      if (mk && qty > 0) {
        if (monthlyOut[mk] !== undefined) monthlyOut[mk] += qty;
        if (sku) { if (!skuMonthlyOut[sku]) skuMonthlyOut[sku]={}; skuMonthlyOut[sku][mk]=(skuMonthlyOut[sku][mk]||0)+qty; }
        // Track last sale date
        if (!lastSaleDate[sku] || (row[6] && row[6] > lastSaleDate[sku])) lastSaleDate[sku] = row[6] || 0;
      }
      // Branch transfer detection
      const custUp = String(row[7]||'').trim().toUpperCase();
      let branch = null;
      for (const [kw, br] of Object.entries(BRANCH_KEYWORDS)) { if (custUp.includes(kw)) { branch = br; break; } }
      if (branch && qty > 0 && row[6]) {
        const dateSerial = row[6];
        const yr = dateSerial ? Math.floor((dateSerial-25569)/365.25)+1970 : 0;
        if (yr >= 2025) {
          branchTransfers.push({ branch, sku, name: clean(row[1]), qty,
            dateSerial, batch: clean(row[8]),
            expiry: serialToExpiry(row[9]) || fmtExp(clean(row[9])),
            order: clean(row[4]), line: clean(row[10]) });
        }
      }
    }
    // Sort transfers newest first
    branchTransfers.sort((a,b) => (b.dateSerial||0)-(a.dateSerial||0));
    // Keep last 300
    const recentTransfers = branchTransfers.slice(0,300);

    // Pull-out totals for shrinkage
    // Pull-out: SKU(0) Name(1) ServedQTY(2) OrderedBy(3) Date(4)
    const pulloutTotal = {};
    for (const row of poRows.slice(1)) {
      const sku = clean(row[0]); const qty = pInt(row[2]);
      if (sku && qty > 0) pulloutTotal[sku] = (pulloutTotal[sku]||0) + qty;
    }

    // ── Enrich products with velocity, aged inventory, shrinkage ──
    const last6 = months.slice(-6);
    for (const p of products) {
      // Velocity
      const mo = skuMonthlyOut[p.sku] || {};
      const avgVel = last6.reduce((a,m)=>a+(mo[m]||0),0) / 6;
      p.velocity = Math.round(avgVel * 10) / 10;
      p.monthsOfStock = avgVel > 0 && p.stock > 0 ? Math.round((p.stock/avgVel)*10)/10 : null;
      // Aged inventory
      const lastSerial = lastSaleDate[p.sku] || 0;
      if (lastSerial > 0) {
        const lastDate = new Date((lastSerial-25569)*86400000);
        p.daysSinceLastSale = Math.round((now-lastDate)/86400000);
        p.lastSaleDate = lastDate.toISOString().slice(0,10);
      } else {
        p.daysSinceLastSale = p.sold > 0 ? 999 : null;
        p.lastSaleDate = p.sold > 0 ? 'Before 2022' : null;
      }
      p.agedBucket = p.daysSinceLastSale === null ? null
        : p.daysSinceLastSale > 180 ? 'dead'
        : p.daysSinceLastSale > 90 ? 'slow'
        : p.daysSinceLastSale > 30 ? 'aging' : 'active';
      // Shrinkage
      const rec = receivedTotal[p.sku] || 0;
      const s = soldTotal[p.sku] || 0;
      const po = pulloutTotal[p.sku] || 0;
      const cur = p.stock;
      p.shrinkage = rec > 0 ? rec - s - po - cur : 0;
      p.shrinkageValue = Math.abs(p.shrinkage) * (p.price || 0);
    }

    // ── Inventory value by line ──
    const valueByLine = {};
    for (const p of products) {
      if (p.stock > 0 && p.price) valueByLine[p.line] = (valueByLine[p.line]||0) + p.stock * p.price;
    }

    // ── Cash in expiring stock (from Shelf Life + prices) ──
    const cashExpiring = { expired: 0, lt30: 0, lt90: 0, lt180: 0 };
    const expiringItems = [];
    for (const b of batches) {
      if (!b.expiry || b.soh <= 0) continue;
      const pm = b.expiry.match(/^(\d{1,2})\/(\d{4})$/);
      if (!pm) continue;
      const expDate = new Date(+pm[2], +pm[1]-1, 1);
      const days = Math.round((expDate - now) / 86400000);
      const price = pricesBySku[b.skuCode] || 0;
      const value = b.soh * price;
      const bucket = days < 0 ? 'expired' : days <= 30 ? 'lt30' : days <= 92 ? 'lt90' : days <= 183 ? 'lt180' : null;
      if (bucket) {
        cashExpiring[bucket] += value;
        expiringItems.push({ name: b.name, skuCode: b.skuCode, batch: b.batch, expiry: b.expiry, days, soh: b.soh, price, value, bucket });
      }
    }
    expiringItems.sort((a,b) => b.value - a.value);

    // ── Branch expiry summary ──
    // Group recentTransfers by branch, then find expiry for each item sent
    const branchExpiry = {};
    for (const t of recentTransfers) {
      if (!branchExpiry[t.branch]) branchExpiry[t.branch] = {};
      const key = t.sku + '|' + t.batch;
      if (!branchExpiry[t.branch][key]) {
        branchExpiry[t.branch][key] = { sku: t.sku, name: t.name, batch: t.batch, expiry: t.expiry, qty: 0, line: t.line };
      }
      branchExpiry[t.branch][key].qty += t.qty;
    }
    // Convert to array per branch
    const branchExpirySummary = {};
    for (const [branch, items] of Object.entries(branchExpiry)) {
      branchExpirySummary[branch] = Object.values(items)
        .filter(i => i.expiry)
        .sort((a,b) => {
          const pa = a.expiry.match(/^(\d{1,2})\/(\d{4})$/), pb = b.expiry.match(/^(\d{1,2})\/(\d{4})$/);
          const da = pa ? new Date(+pa[2],+pa[1]-1,1) : new Date(9999,0,1);
          const db = pb ? new Date(+pb[2],+pb[1]-1,1) : new Date(9999,0,1);
          return da - db;
        });
    }

    if (products.length < 5) throw new Error(`Only ${products.length} products parsed`);

    return new Response(JSON.stringify({
      products, batches, monthlyIn, monthlyOut, months, valueByLine,
      cashExpiring, expiringItems: expiringItems.slice(0,100),
      branchTransfers: recentTransfers,
      branchExpirySummary,
      synced: new Date().toISOString(),
    }), { status:200, headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Cache-Control':'no-store'} });

  } catch(err) {
    return new Response(JSON.stringify({error:err.message}),{status:502,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}});
  }
}
export const config = { path: '/api/sync' };
