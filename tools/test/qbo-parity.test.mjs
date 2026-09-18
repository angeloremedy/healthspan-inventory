/* Parity: the SAME Shopify orders through the old GCP connector's mapping (frozen under fixtures/qbo-connector) and
   through HQ's qbo-map.mjs must produce IDENTICAL QuickBooks Invoice bodies (PrivateNote excepted — it names the
   source system). Ten orders: plain, discount as %, discount as amount, discount + untaxed shipping (per-line
   fallback), the HG-10496 case, a tip, VAT-exempt lines, a discount on a mixed VAT/exempt order, an edited order,
   a company customer with "Due on receipt", and an anonymous buyer.  Run: node tools/test/qbo-parity.test.mjs */
process.env.QBO_TAX_MODE = 'code'; process.env.QBO_TAX_CODE_ID = '11'; process.env.QBO_NON_TAX_CODE_ID = '10'; process.env.QBO_TAX_INCLUSIVE = 'true';
process.env.QBO_CLASS_ID = '700000000000311267'; process.env.QBO_DISCOUNT_STYLE = 'native'; process.env.QBO_STRICT_TOTALS = 'false'; process.env.QBO_INCOME_ACCOUNT_ID = '501';
process.env.QBO_ANONYMOUS_CUSTOMER_NAME = 'Anonymous'; process.env.QBO_INVOICE_TERMS_DAYS = '30';
const G = await import('./fixtures/qbo-connector/sync.js'); const { posted } = await import('./fixtures/qbo-connector/qbo/client.js'); const { store } = await import('./fixtures/qbo-connector/store.js');
const M = await import('../../netlify/functions/lib/qbo-map.mjs');
const fx = await import('./fixtures/qbo-connector/fixtures.js');
const CFG = { taxCode: '11', nonTaxCode: '10', classId: '700000000000311267', discountStyle: 'native', strictTotals: false };
const strip = o => JSON.parse(JSON.stringify(o)); const canon = o => JSON.stringify(o, (k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(x => [x, v[x]])) : v);
function hg10496() { const o = fx.order({ id: 5036, name: '#HG-10496', shipping: '0.00', discounts: '95000.00' }); o.line_items = [{ id: 1, variant_id: 996, sku: 'TD040', title: 'TDS FACE NADE 4*2.5ML', variant_title: 'Default Title', price: '9500.00', quantity: 20, taxable: true, discount_allocations: [{ amount: '95000.00' }], tax_lines: [{ title: 'VAT', rate: 0.12, price: '10178.57' }] }]; o.discount_codes = [{ code: 'INNO-DD0909-5PLU5', amount: '95000.00' }]; o.total_price = '95000.00'; o.total_tax = '10178.57'; return o; }
const cases = { plain: fx.order(), disc100: fx.order({ shipping: '0.00', discounts: '100.00' }), discShip: fx.order({ discounts: '100.00' }), hg10496: hg10496(), tip: fx.order({ shipping: '0.00', tip: 20 }),
  exempt: (() => { const o = fx.order({ shipping: '0.00' }); o.line_items = [{ id: 1, variant_id: 996, sku: 'TD040', title: 'FACE NADE', variant_title: 'Default Title', price: '10000.00', quantity: 1, taxable: true, discount_allocations: [], tax_lines: [{ rate: 0.12, price: '1071.43' }] }, { id: 2, variant_id: 777, sku: 'TS-ENEKA', title: 'Termosalud Eneka Pro XL', variant_title: 'Default Title', price: '5000.00', quantity: 1, taxable: false, tax_lines: [], discount_allocations: [] }]; o.total_price = '15000.00'; o.total_tax = '1071.43'; o.total_discounts = '0.00'; return o; })(),
  mixedDisc: (() => { const o = fx.order({ shipping: '0.00', discounts: '1000.00' }); o.line_items = [{ id: 1, variant_id: 996, sku: 'TD040', title: 'FACE NADE', variant_title: 'Default Title', price: '10000.00', quantity: 1, taxable: true, discount_allocations: [{ amount: '1000.00' }], tax_lines: [{ rate: 0.12, price: '964.29' }] }, { id: 2, variant_id: 777, sku: 'TS-ENEKA', title: 'Termosalud Eneka Pro XL', variant_title: 'Default Title', price: '5000.00', quantity: 1, taxable: false, tax_lines: [], discount_allocations: [] }]; o.total_price = '14000.00'; o.total_tax = '964.29'; return o; })(),
  edited: (() => { const o = fx.order({ shipping: '0.00' }); o.line_items[0].current_quantity = 1; o.current_total_price = '896.00'; o.current_total_tax = '96.00'; o.current_total_discounts = '0.00'; return o; })(),
  company: (() => { const o = fx.order(); o.billing_address.company = 'Skin Station, Inc.'; o.payment_terms = { payment_terms_name: 'Due on receipt', payment_terms_type: 'RECEIPT', payment_schedules: [{ due_at: null }] }; return o; })(),
  anon: (() => { const o = fx.order({ shipping: '0.00' }); o.customer = null; o.email = ''; return o; })() };
let bad = 0;
for (const [name, o] of Object.entries(cases)) {
  posted.length = 0; store.reset(); const quiet = { log: console.log, warn: console.warn, error: console.error }; console.log = console.warn = console.error = () => {}; try { await G.createOrUpdateInvoice(o); } finally { Object.assign(console, quiet); } // (the stub client posts no TotalAmt, so the connector's own reconciliation warnings are noise here)
  const theirs = strip(posted[0]);
  const n = M.normalizeShopify(o); const p = M.planInvoice(n, CFG);
  // map my keys to the ids the harness handed the connector (it created items by SKU/name in the same order)
  const ids = {}; for (const l of theirs.Line) if (l.SalesItemLineDetail) { const d = l.Description; const mine = p.lines.find(x => x.SalesItemLineDetail && x.Description === d); if (mine) ids[mine.SalesItemLineDetail.ItemRef.value] = l.SalesItemLineDetail.ItemRef.value; }
  const ours = strip(M.renderInvoice(n, p, { customerId: theirs.CustomerRef.value, items: ids }, CFG));
  delete theirs.PrivateNote; delete ours.PrivateNote; delete theirs.TxnTaxDetail; // note text differs by design; TxnTaxDetail undefined in code mode
  const a = canon(theirs), b = canon(ours);
  if (a === b) console.log('SAME  ' + name + '  total ' + p.total); else { bad++; console.log('DIFF  ' + name); console.log('  theirs ' + a); console.log('  ours   ' + b); }
}
console.log(bad ? bad + ' differences' : 'all identical'); process.exit(bad ? 1 : 0);
