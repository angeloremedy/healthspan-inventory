const SHEET_ID = '1tgedHZhpaMkHZqKElL13jBm9f90HRzsW5EkoL8QaW24';

// Row offsets where 2025+ data starts (avoids fetching years of old data)
// These were determined from the actual sheet — update if sheet grows significantly
const OUT_START = 4400;   // Sending OUT: 2025 data starts ~row 4410
const IN_START  = 650;    // Receiving IN: 2025 data starts ~row 659
const PO_START  = 2230;   // Pull-out Orders: 2025 data starts ~row 2240

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
function serialMK(serial) {
  if (!serial || typeof serial !== 'number' || serial < 1) return null;
  const d = new Date((serial - 25569) * 86400000);
  if (isNaN(d.getTime())) return null;
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0');
}
function serialToExpiry(serial) {
  if (!serial || typeof serial !== 'number' || serial < 1) return '';
  const d = new Date((serial - 25569) * 86400000);
  if (isNaN(d.getTime())) return '';
  return (d.getUTCMonth() + 1) + '/' + d.getUTCFullYear();
}

function enc(tab, range) {
  return encodeURIComponent(`'${tab}'!${range}`);
}

let KEY = '';

// Single batchGet call — all ranges in ONE HTTP request
async function batchGet(ranges) {
  const rangeParams = ranges.map(r => `ranges=${enc(r.tab, r.range)}`).join('&');
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values:batchGet?key=${KEY}&${rangeParams}&valueRenderOption=UNFORMATTED_VALUE`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Sheets batchGet failed (${r.status}): ${(await r.text()).slice(0, 200)}`);
  const data = await r.json();
  return data.valueRanges.map(vr => vr.values || []);
}

// Separate batchGet for FORMATTED_VALUE ranges (display strings like prices, categories)
async function batchGetFormatted(ranges) {
  const rangeParams = ranges.map(r => `ranges=${enc(r.tab, r.range)}`).join('&');
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values:batchGet?key=${KEY}&${rangeParams}&valueRenderOption=FORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Sheets batchGet (formatted) failed (${r.status}): ${(await r.text()).slice(0, 200)}`);
  const data = await r.json();
  return data.valueRanges.map(vr => vr.values || []);
}

export default async function handler(request, context) {
  if (request.method === 'OPTIONS') return new Response(null, {status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'}});
  if (request.method !== 'POST') return new Response('Method not allowed', {status:405});

  KEY = Deno.env.get('GOOGLE_API_KEY') || '';
  if (!KEY) return new Response(JSON.stringify({error:'GOOGLE_API_KEY not set'}), {status:500,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}});

  try {
    // TWO parallel batch requests instead of 7 sequential fetches
    // Batch 1: UNFORMATTED (serial dates, raw numbers) — movement + stock data
    // Batch 2: FORMATTED (display strings) — names, categories, prices, expiry text
    const [unformattedResults, formattedResults] = await Promise.all([
      batchGet([
        // Only cols we use, only rows we need
        { tab: 'Inventory Overview',         range: 'A1:J1001' },  // all stock data
        { tab: 'Receiving Inventory (IN)',    range: `A${IN_START}:G2000` },   // SKU(A) Batch(C) QTY(D) DateSerial(G) — 2025+
        { tab: 'Sending Inventory (OUT)',     range: `A${OUT_START}:K16000` }, // SKU(A) QTY(D) DateSerial(G) Customer(H) Batch(I) Expiry(J) — 2025+
        { tab: 'Pull-out Orders (INTERNAL)', range: `A${PO_START}:E6000` },   // SKU(A) ServedQTY(C) — 2025+
        { tab: 'Pull-out Orders (INTERNAL)', range: 'A2:C6000' },             // Full pull-out for shrinkage calc
        { tab: 'Receiving Inventory (IN)',    range: 'A2:D2000' },             // Full receiving for shrinkage calc
      ]),
      batchGetFormatted([
        { tab: 'Product Database',   range: 'A1:K200' },   // SKU+Name+Line+Price+Batch+Expiry+Bin (small sheet)
        { tab: 'Shelf Life',         range: 'A1:L600' },   // batch expiry data
        { tab: 'Price',              range: 'A1:E200' },   // supplemental prices
      ]),
    ]);

    const [ovRows, inRows2025, outRows2025, poRows2025, poRowsFull, inRowsFull] = unformattedResults;
    const [dbRows, shelfRows, priceRows] = formattedResults;

    // ── Price lookups ──
    const pricesBySku = {};
    for (const row of dbRows.slice(1)) {
      const sku = clean(row[0]); const p = pNum(row[5]);
      if (sku && p && p > 0) pricesBySku[sku] = p;
    }
    for (const row of priceRows.slice(1)) {
      const sku = clean(row[0]); const p = pNum(row[4]);
      if (sku && p && p > 0 && !pricesBySku[sku]) pricesBySku[sku] = p;
    }

    // ── Master lookup: bin, batch, expiry, size ──
    const master = {};
    for (const row of dbRows.slice(1)) {
      const sku = clean(row[0]);
      if (!sku || sku === 'SKU') continue;
      master[sku] = { price: pricesBySku[sku] ?? null, batch: clean(row[6]), expiry: fmtExp(row[7]), size: clean(row[8]), bin: clean(row[9]) };
    }

    // ── Inventory Overview → products ──
    // UNFORMATTED: SKU(0) Name(1) Line(2) Category(3) Received(4) Sold(5) Stock(6) ?(7) Notes(8) ExpirySerial(9)
    const products = [];
    const currentStock = {};
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

    // ── Shelf Life → batches (FEFO) ──
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

    // ── Monthly movement — last 13 months ──
    const now = new Date();
    const months = [];
    let md = new Date(now.getFullYear(), now.getMonth(), 1);
    for (let i = 0; i < 13; i++) { months.unshift(md.getFullYear()+'-'+String(md.getMonth()+1).padStart(2,'0')); md = new Date(md.getFullYear(),md.getMonth()-1,1); }
    const monthlyIn  = Object.fromEntries(months.map(m=>[m,0]));
    const monthlyOut = Object.fromEntries(months.map(m=>[m,0]));
    const skuMonthlyOut = {};
    const lastSaleDate = {};
    const soldTotal = {};

    // Receiving (2025+): SKU(0) Name(1) Batch(2) QTY(3) Type(4) Expiry(5) DateSerial(6)
    const receivedTotal = {};
    for (const row of inRowsFull) {
      const sku = clean(row[0]); const qty = pInt(row[3]);
      if (sku && qty > 0) receivedTotal[sku] = (receivedTotal[sku]||0) + qty;
    }
    for (const row of inRows2025) {
      const mk = serialMK(row[6]); const qty = pInt(row[3]);
      if (mk && monthlyIn[mk] !== undefined && qty > 0) monthlyIn[mk] += qty;
    }

    // Branch mappings
    const BRANCH_MAP = {
      'APRIL GERALDEZ':'BGC','APRIL':'BGC','REMEDY BGC':'BGC','ANGELA DACONES':'BGC','ANGELA':'BGC',
      'REMEDY VERTIS':'Vertis North','VERTIS':'Vertis North','MICH':'Vertis North',
      'REMEDY GH':'GH Mall','GH MALL':'GH Mall',
    };
    const branchTransfers = [];

    // Sending (2025+): SKU(0) Product(1) BPN(2) QTY(3) Order(4) OrderDate(5) DateSerial(6) Customer(7) Batch(8) Expiry(9) Line(10)
    for (const row of outRows2025) {
      const mk = serialMK(row[6]); const qty = pInt(row[3]); const sku = clean(row[0]);
      if (!sku || qty <= 0) continue;
      soldTotal[sku] = (soldTotal[sku]||0) + qty;
      if (mk) {
        if (monthlyOut[mk] !== undefined) monthlyOut[mk] += qty;
        if (!skuMonthlyOut[sku]) skuMonthlyOut[sku] = {};
        skuMonthlyOut[sku][mk] = (skuMonthlyOut[sku][mk]||0) + qty;
        if (!lastSaleDate[sku] || row[6] > lastSaleDate[sku]) lastSaleDate[sku] = row[6];
      }
      // Branch detection
      const custUp = String(row[7]||'').trim().toUpperCase();
      let branch = null;
      for (const [kw, br] of Object.entries(BRANCH_MAP)) { if (custUp.includes(kw)) { branch=br; break; } }
      if (branch && row[6]) {
        branchTransfers.push({ branch, sku, name: clean(row[1]), qty,
          dateSerial: row[6], batch: clean(row[8]),
          expiry: serialToExpiry(typeof row[9]==='number'?row[9]:0) || fmtExp(clean(row[9])),
          order: clean(row[4]), line: clean(row[10]) });
      }
    }
    branchTransfers.sort((a,b)=>(b.dateSerial||0)-(a.dateSerial||0));

    // Pull-out totals (full history for shrinkage)
    const pulloutTotal = {};
    for (const row of poRowsFull) {
      const sku = clean(row[0]); const qty = pInt(row[2]);
      if (sku && qty > 0) pulloutTotal[sku] = (pulloutTotal[sku]||0) + qty;
    }

    // ── Enrich products ──
    const last6 = months.slice(-6);
    for (const p of products) {
      const mo = skuMonthlyOut[p.sku] || {};
      const avgVel = last6.reduce((a,m)=>a+(mo[m]||0),0) / 6;
      p.velocity = Math.round(avgVel * 10) / 10;
      p.monthsOfStock = avgVel > 0 && p.stock > 0 ? Math.round((p.stock/avgVel)*10)/10 : null;
      const ls = lastSaleDate[p.sku];
      if (ls) {
        const lastDate = new Date((ls-25569)*86400000);
        p.daysSinceLastSale = Math.round((now-lastDate)/86400000);
        p.lastSaleDate = lastDate.toISOString().slice(0,10);
      } else { p.daysSinceLastSale = p.sold > 0 ? 999 : null; p.lastSaleDate = p.sold > 0 ? 'Before 2025' : null; }
      p.agedBucket = p.daysSinceLastSale===null?null:p.daysSinceLastSale>180?'dead':p.daysSinceLastSale>90?'slow':p.daysSinceLastSale>30?'aging':'active';
      const rec = receivedTotal[p.sku]||0;
      const s = soldTotal[p.sku]||0;
      const po = pulloutTotal[p.sku]||0;
      p.shrinkage = rec > 0 ? rec - s - po - p.stock : 0;
      p.shrinkageValue = Math.abs(p.shrinkage) * (p.price||0);
    }

    // ── Value by line ──
    const valueByLine = {};
    for (const p of products) {
      if (p.stock > 0 && p.price) valueByLine[p.line] = (valueByLine[p.line]||0) + p.stock * p.price;
    }

    // ── Cash in expiring stock ──
    const cashExpiring = { expired:0, lt30:0, lt90:0, lt180:0 };
    const expiringItems = [];
    for (const b of batches) {
      if (!b.expiry || b.soh <= 0) continue;
      const pm = b.expiry.match(/^(\d{1,2})\/(\d{4})$/);
      if (!pm) continue;
      const expDate = new Date(+pm[2],+pm[1]-1,1);
      const days = Math.round((expDate-now)/86400000);
      const price = pricesBySku[b.skuCode]||0;
      const value = b.soh * price;
      const bucket = days<0?'expired':days<=30?'lt30':days<=92?'lt90':days<=183?'lt180':null;
      if (bucket) { cashExpiring[bucket]+=value; expiringItems.push({name:b.name,skuCode:b.skuCode,batch:b.batch,expiry:b.expiry,days,soh:b.soh,price,value,bucket}); }
    }
    expiringItems.sort((a,b)=>b.value-a.value);

    // ── Branch expiry summary ──
    const branchExpiry = {};
    for (const t of branchTransfers) {
      if (!branchExpiry[t.branch]) branchExpiry[t.branch] = {};
      const key = t.sku+'|'+t.batch;
      if (!branchExpiry[t.branch][key]) branchExpiry[t.branch][key] = {sku:t.sku,name:t.name,batch:t.batch,expiry:t.expiry,qty:0,line:t.line};
      branchExpiry[t.branch][key].qty += t.qty;
    }
    const branchExpirySummary = {};
    for (const [branch,items] of Object.entries(branchExpiry)) {
      branchExpirySummary[branch] = Object.values(items).filter(i=>i.expiry).sort((a,b)=>{
        const pa=a.expiry.match(/^(\d{1,2})\/(\d{4})$/),pb=b.expiry.match(/^(\d{1,2})\/(\d{4})$/);
        const da=pa?new Date(+pa[2],+pa[1]-1,1):new Date(9999,0,1);
        const db=pb?new Date(+pb[2],+pb[1]-1,1):new Date(9999,0,1);
        return da-db;
      });
    }

    if (products.length < 5) throw new Error(`Only ${products.length} products parsed`);

    return new Response(JSON.stringify({
      products, batches, monthlyIn, monthlyOut, months, valueByLine,
      cashExpiring, expiringItems: expiringItems.slice(0,100),
      branchTransfers: branchTransfers.slice(0,300),
      branchExpirySummary, synced: new Date().toISOString(),
    }), { status:200, headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Cache-Control':'no-store'} });

  } catch(err) {
    return new Response(JSON.stringify({error:err.message}), {status:502,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}});
  }
}

export const config = { path: '/api/sync' };
