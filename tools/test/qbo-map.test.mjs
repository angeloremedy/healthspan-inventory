/* QuickBooks mapping — Sean's rules as a pure module, checked against the figures the
   old Shopify connector's own test-suite asserts (its fixtures are reproduced here), plus
   HQ-native orders. Run from the repo root:  node tools/test/qbo-map.test.mjs */
import * as M from '../../netlify/functions/lib/qbo-map.mjs';

let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined && !c ? '  → ' + x : '')); };
const near = (a, b, tol = 0.011) => Math.abs((+a) - (+b)) <= tol;

// ── the connector's fixtures (test/fixtures.js of qbo-shopify-connector) ──────
const vatIncl = t => (Math.round(t * 12 / 112 * 100) / 100).toFixed(2);
const BEANS = { id: 9001, variant_id: 111, sku: 'BB500', title: 'Barako Beans 500g', variant_title: 'Default Title', price: '560.00', quantity: 2, taxable: true };
const MUG = { id: 9002, variant_id: 222, sku: 'MUG01', title: 'Ceramic Mug', variant_title: 'Default Title', price: '336.00', quantity: 1, taxable: true };
function order({ id = 5001, name = '#1001', financial_status = 'pending', discounts = '0.00', shipping = '150.00', tip = 0, cancelled_at = null } = {}) {
  const lineTotal = 560 * 2 + 336; const total = Math.round((lineTotal - Number(discounts) + Number(shipping) + tip) * 100) / 100; const taxable = lineTotal - Number(discounts);
  return { id, name, email: 'maria@example.ph', currency: 'PHP', taxes_included: true, created_at: '2026-09-10T09:00:00+08:00', cancelled_at, financial_status,
    total_price: total.toFixed(2), total_tax: vatIncl(taxable), total_discounts: discounts, total_tip_received: tip.toFixed(2), total_outstanding: total.toFixed(2),
    customer: { id: 7001, first_name: 'Maria', last_name: 'Santos', email: 'maria@example.ph', phone: '+639171234567', default_address: { address1: '12 Mabini St', city: 'Makati' } },
    billing_address: { address1: '12 Mabini St', city: 'Makati' },
    line_items: [{ ...BEANS, discount_allocations: Number(discounts) > 0 ? [{ amount: Number(discounts).toFixed(2) }] : [], tax_lines: [{ title: 'VAT', rate: 0.12, price: vatIncl(560 * 2 - Number(discounts)) }] },
      { ...MUG, discount_allocations: [], tax_lines: [{ title: 'VAT', rate: 0.12, price: vatIncl(336) }] }],
    discount_codes: Number(discounts) > 0 ? [{ code: 'TESTCODE', amount: discounts }] : [],
    shipping_lines: Number(shipping) > 0 ? [{ title: 'Standard', price: shipping, tax_lines: [] }] : [] };
}
function hg10496() {
  const o = order({ id: 5036, name: '#HG-10496', shipping: '0.00', discounts: '95000.00' });
  o.line_items = [{ id: 1, variant_id: 996, sku: 'TD040', title: 'TDS FACE NADE 4*2.5ML', variant_title: 'Default Title', price: '9500.00', quantity: 20, taxable: true, discount_allocations: [{ amount: '95000.00' }], tax_lines: [{ title: 'VAT', rate: 0.12, price: '10178.57' }] }];
  o.discount_codes = [{ code: 'INNO-DD0909-5PLU5', amount: '95000.00' }]; o.total_price = '95000.00'; o.total_tax = '10178.57'; o.total_outstanding = '95000.00';
  return o;
}
const CFG = { taxCode: '11', nonTaxCode: '10', classId: '700000000000311267', discountStyle: 'native', strictTotals: true };
const REFS = keys => ({ customerId: '1', items: Object.fromEntries(keys.map((k, i) => [k, String(200 + i)])) });

// ── HG-10496: the order that defined the rules ────────────────────────────────
{
  const n = M.normalizeShopify(hg10496()); const p = M.planInvoice(n, CFG); const body = M.renderInvoice(n, p, REFS(p.needs), CFG);
  const item = body.Line.find(l => l.DetailType === 'SalesItemLineDetail'), disc = body.Line.find(l => l.DetailType === 'DiscountLineDetail');
  ok('HG-10496: DocNumber from the Shopify name, # stripped', p.docNumber === 'HG-10496' && body.DocNumber === 'HG-10496');
  ok('HG-10496: list value 190,000 on the line as TaxInclusiveAmt, Amount = net, no UnitPrice', near(item.SalesItemLineDetail.TaxInclusiveAmt, 190000) && near(item.Amount, 190000 / 1.12) && item.SalesItemLineDetail.UnitPrice === undefined, JSON.stringify(item));
  ok('HG-10496: tax code 11 and class Sales on the line', item.SalesItemLineDetail.TaxCodeRef.value === '11' && item.SalesItemLineDetail.ClassRef.value === '700000000000311267');
  ok('HG-10496: ONE discount row, 50 %, percent-based, with class and tax code', body.Line.filter(l => l.DetailType === 'DiscountLineDetail').length === 1 && disc.DiscountLineDetail.PercentBased === true && disc.DiscountLineDetail.DiscountPercent === 50 && disc.DiscountLineDetail.ClassRef.value === '700000000000311267' && disc.DiscountLineDetail.TaxCodeRef.value === '11', JSON.stringify(disc));
  ok('HG-10496: predicted total 95,000.00 and VAT 10,178.57', near(p.total, 95000) && near(p.vat, 10178.57, 0.02), p.total + ' ' + p.vat);
  ok('HG-10496: header carries class, TaxInclusive, customer memo absent, bill e-mail, PHP', body.ClassRef.value === '700000000000311267' && body.GlobalTaxCalculation === 'TaxInclusive' && !body.CustomerMemo && body.BillEmail.Address === 'maria@example.ph' && body.CurrencyRef.value === 'PHP');
  ok('HG-10496: due date = created + 30 days (no Shopify terms)', body.TxnDate === '2026-09-10' && body.DueDate === '2026-10-10', body.DueDate);
  ok('HG-10496: customer = "First Last (email)" when there is no company', p.customerName === 'Maria Santos (maria@example.ph)', p.customerName);
  ok('style native chosen (all lines VAT, no shipping)', p.style === 'native');
}
// ── the connector's other asserted figures ────────────────────────────────────
{
  const n = M.normalizeShopify(order({ shipping: '0.00', discounts: '100.00' })); const p = M.planInvoice(n, CFG);
  const disc = p.lines.find(l => l.DetailType === 'DiscountLineDetail');
  ok('100 off 1,456: not a clean percentage → amount row sent as NET (100/1.12), total 1,356', disc.DiscountLineDetail.PercentBased === false && near(disc.Amount, 100 / 1.12) && near(p.total, 1356), p.total);
}
{
  const n = M.normalizeShopify(order({ discounts: '100.00' })); const p = M.planInvoice(n, CFG); // untaxed shipping 150 → not uniform
  const neg = p.lines.find(l => l.DetailType === 'SalesItemLineDetail' && l.Amount < 0);
  ok('shipping on the invoice → falls back to per-line discount: no Discount row, a negative item line of −100 gross, total 1,506', !p.lines.some(l => l.DetailType === 'DiscountLineDetail') && neg && near(neg.SalesItemLineDetail.TaxInclusiveAmt, -100) && near(p.total, 1506) && p.style === 'line', p.total);
  const ship = p.lines.find(l => /Standard/.test(l.Description));
  ok('untaxed shipping line uses the No-VAT code 10 and Amount = gross', ship.SalesItemLineDetail.TaxCodeRef.value === '10' && ship.Amount === 150 && ship.SalesItemLineDetail.TaxInclusiveAmt === undefined);
  ok('needs lists the product keys plus the special discount and shipping items', p.needs.includes('111') && p.needs.includes('222') && p.needs.includes('special:discount') && p.needs.includes('special:shipping'));
}
{
  const n = M.normalizeShopify(order()); const p = M.planInvoice(n, CFG);
  ok('plain order: total 1,606.00, VAT 156.00 (1,456 × 12/112)', near(p.total, 1606) && near(p.vat, 156, 0.02), p.total + ' ' + p.vat);
}
// ── exempt lines ──────────────────────────────────────────────────────────────
{
  const o = order({ shipping: '0.00' });
  o.line_items = [{ id: 1, variant_id: 996, sku: 'TD040', title: 'FACE NADE', variant_title: 'Default Title', price: '10000.00', quantity: 1, taxable: true, discount_allocations: [], tax_lines: [{ rate: 0.12, price: vatIncl(10000) }] },
    { id: 2, variant_id: 777, sku: 'TS-ENEKA', title: 'Termosalud Eneka Pro XL', variant_title: 'Default Title', price: '5000.00', quantity: 1, taxable: false, tax_lines: [], discount_allocations: [] }];
  o.total_price = '15000.00'; o.total_tax = vatIncl(10000); o.total_discounts = '0.00';
  const n = M.normalizeShopify(o); const p = M.planInvoice(n, CFG);
  const ex = p.lines.find(l => /Termosalud/.test(l.Description));
  ok('VAT-exempt Shopify line: code 10, Amount = price untouched, no TaxInclusiveAmt; total 15,000', ex.SalesItemLineDetail.TaxCodeRef.value === '10' && ex.Amount === 5000 && ex.SalesItemLineDetail.TaxInclusiveAmt === undefined && near(p.total, 15000) && near(p.vat, 1071.43, 0.02), JSON.stringify([ex, p.total, p.vat]));
}
// ── strict totals ─────────────────────────────────────────────────────────────
{
  const o = order({ shipping: '0.00' }); o.total_price = '1500.00'; // lines say 1,456
  let err = null; try { M.planInvoice(M.normalizeShopify(o), CFG); } catch (e) { err = e; }
  ok('a total the lines cannot explain is refused (code TOTALS), the plan attached for the log', err && err.code === 'TOTALS' && /1500\.00 vs QuickBooks 1456\.00/.test(err.message) && err.plan && err.plan.mismatch, err && err.message);
  const p2 = M.planInvoice(M.normalizeShopify(o), Object.assign({}, CFG, { strictTotals: false }));
  ok('with strict totals off the plan is returned with the mismatch noted', p2.mismatch && near(p2.mismatch.expected, 1500) && near(p2.mismatch.got, 1456));
  const t = order({ shipping: '0.00', tip: 20 }); const p3 = M.planInvoice(M.normalizeShopify(t), CFG);
  ok('a tip is explained and becomes an untaxed adjustment line', p3.lines.some(l => /adjustment/.test(l.Description) && l.Amount === 20) && near(p3.total, 1476));
}
// ── order edits ───────────────────────────────────────────────────────────────
{
  const o = order({ shipping: '0.00' }); o.line_items[0].current_quantity = 1; o.current_total_price = '896.00'; o.current_total_tax = vatIncl(896); o.current_total_discounts = '0.00';
  const n = M.normalizeShopify(o); const p = M.planInvoice(n, CFG);
  ok('edited order (2 → 1 beans): line at qty 1, total = current 896.00', n.edited === true && p.lines[0].SalesItemLineDetail.Qty === 1 && near(p.total, 896), p.total);
  const r = order({ shipping: '0.00' }); r.line_items[0].current_quantity = 1; r.current_total_price = '896.00'; r.refunds = [{ refund_line_items: [{ line_item_id: 9001, quantity: 1, total_tax: '60.00' }], transactions: [{ kind: 'refund', status: 'success', amount: '560.00' }] }];
  const pr = M.planInvoice(M.normalizeShopify(r), CFG);
  ok('a refund does not shrink the invoice: refunded unit added back, total 1,456', pr.lines[0].SalesItemLineDetail.Qty === 2 && near(pr.total, 1456), pr.total);
}
// ── customers, terms, dates ───────────────────────────────────────────────────
{
  const o = order(); o.billing_address.company = 'Skin Station, Inc.';
  ok('company on the billing address wins the customer name', M.customerName(M.normalizeShopify(o)) === 'Skin Station, Inc.');
  const a = order(); a.customer = null; a.email = '';
  ok('no customer, no e-mail → Anonymous', M.customerName(M.normalizeShopify(a)) === 'Anonymous');
  const t = order(); t.payment_terms = { payment_terms_name: 'Due on receipt', payment_terms_type: 'RECEIPT', payment_schedules: [{ due_at: null }] };
  ok('"Due on receipt" → due the invoice date', M.dueDate(M.normalizeShopify(t)) === '2026-09-10');
  const t2 = order(); t2.payment_terms = { payment_terms_name: 'Net 45', payment_terms_type: 'NET', due_in_days: 45, payment_schedules: [{ due_at: '2026-10-25T00:00:00+08:00' }] };
  ok('Shopify due_at wins over days', M.dueDate(M.normalizeShopify(t2)) === '2026-10-25');
  const late = order(); late.created_at = '2026-09-30T17:30:00Z'; // 01:30 Oct 1 Manila
  ok('invoice date is the Manila date of the UTC timestamp', M.normalizeShopify(late).date === '2026-10-01', M.normalizeShopify(late).date);
  ok('same Manila month: Sep 30 23:00 Manila vs Oct 1 01:00 Manila differ', !M.sameMonth('2026-09-30T15:00:00Z', '2026-09-30T17:00:00Z') && M.sameMonth('2026-09-02', '2026-09-30'));
}
// ── HQ native orders ──────────────────────────────────────────────────────────
{
  const items = { TD040: { line: 'Inno', price: 9500 }, 'TS-ENEKA': { line: 'Termosalud', price: 5000 } };
  const o = { id: 'o1', num: 42, date: '2026-09-05', account: 'Dr. Cruz Clinic', spec: 'Rhas', status: 'fulfilled', total: 95000, terms_days: 30, notes: 'deliver Tue', dr_no: 'DR-000123' };
  const lines = [{ sku: 'TD040', name: 'TDS FACE NADE 4*2.5ML', qty: 10, price: 9500, amount: 95000 }, { sku: 'TD040', name: 'TDS FACE NADE 4*2.5ML', qty: 1, price: 0, amount: 0, is_free: true, deal: '10+1' }];
  const n = M.normalizeNative(o, lines, items); const p = M.planInvoice(n, CFG); const body = M.renderInvoice(n, p, REFS(p.needs), CFG);
  ok('native: HS-1042, customer = HQ account, due from terms_days, memo, DR in the note', p.docNumber === 'HS-1042' && p.customerName === 'Dr. Cruz Clinic' && body.DueDate === '2026-10-05' && body.CustomerMemo.value === 'deliver Tue' && /DR DR-000123/.test(body.PrivateNote) && /PS Rhas/.test(body.PrivateNote), JSON.stringify([p.docNumber, body.DueDate, body.PrivateNote]));
  const sold = p.lines[0], free = p.lines[1], disc = p.lines.find(l => l.DetailType === 'DiscountLineDetail');
  ok('native 10+1 deal: both lines at list (10 × 9,500 and 1 × 9,500), one Discount row of 9,500 gross as NET amount (1/11 is not a clean %), total 95,000', near(sold.SalesItemLineDetail.TaxInclusiveAmt, 95000) && near(free.SalesItemLineDetail.TaxInclusiveAmt, 9500) && /10\+1/.test(free.Description) && disc && disc.DiscountLineDetail.PercentBased === false && near(disc.Amount, 9500 / 1.12) && near(p.total, 95000), JSON.stringify([sold.Amount, free.Amount, disc && disc.Amount, p.total]));
  ok('native: VAT = 95,000 × 12/112', near(p.vat, 10178.57, 0.02), p.vat);
  const o2 = { id: 'o2', num: 43, date: '2026-09-05', account: 'Skin Station', status: 'pending', total: 15000 };
  const p2 = M.planInvoice(M.normalizeNative(o2, [{ sku: 'TD040', name: 'FACE NADE', qty: 1, price: 10000, amount: 10000 }, { sku: 'TS-ENEKA', name: 'Termosalud Eneka', qty: 1, price: 5000, amount: 5000 }], items), CFG);
  const ex = p2.lines.find(l => /Termosalud/.test(l.Description));
  ok('native: catalog line "Termosalud" → No-VAT code 10; mixed order has no discount so style stays native; total 15,000', ex.SalesItemLineDetail.TaxCodeRef.value === '10' && !p2.lines.some(l => l.DetailType === 'DiscountLineDetail') && near(p2.total, 15000), p2.total);
  const o3 = { id: 'o3', num: 44, date: '2026-09-05', account: 'Skin Station', status: 'pending', total: 14000 };
  const p3 = M.planInvoice(M.normalizeNative(o3, [{ sku: 'TD040', name: 'FACE NADE', qty: 1, price: 9000, amount: 9000 }, { sku: 'TS-ENEKA', name: 'Termosalud Eneka', qty: 1, price: 5000, amount: 5000 }], items), CFG);
  ok('native: a discount on a mixed VAT/exempt order → per-line negative discount (never QBO\'s prorated row); total 14,000', p3.style === 'line' && p3.lines.some(l => l.Amount < 0 && /Discount/.test(l.Description)) && !p3.lines.some(l => l.DetailType === 'DiscountLineDetail') && near(p3.total, 14000), p3.total);
  const o4 = { id: 'o4', num: 45, date: '2026-09-05', account: 'Skin Station', status: 'pending', total: 800 };
  const p4 = M.planInvoice(M.normalizeNative(o4, [{ sku: 'NEW01', name: 'Unknown thing', qty: 2, price: 400, amount: 800 }], items), CFG);
  ok('native: SKU not in the catalog → list price = the line\'s own price, no discount, VAT by default', p4.lines.length === 1 && near(p4.lines[0].SalesItemLineDetail.TaxInclusiveAmt, 800) && p4.lines[0].SalesItemLineDetail.TaxCodeRef.value === '11' && near(p4.total, 800));
  ok('native total always reconciles by construction (lines define the total)', (() => { try { M.planInvoice(M.normalizeNative({ id: 'x', num: 1, date: '2026-09-05', account: 'A', status: 'pending', total: 123 }, [{ sku: 'TD040', name: 'F', qty: 3, price: 9500, amount: 28500 }], items), CFG); return true; } catch (e) { return false; } })());
}
// ── reconciliation diff ───────────────────────────────────────────────────────
{
  const n = M.normalizeShopify(hg10496()); const p = M.planInvoice(n, CFG);
  const good = { DocNumber: 'HG-10496', TotalAmt: 95000, TxnTaxDetail: { TotalTax: 10178.57 }, DueDate: '2026-10-10', CustomerRef: { value: '9', name: 'Maria Santos (maria@example.ph)' }, Line: [{ DetailType: 'SalesItemLineDetail', SalesItemLineDetail: { ClassRef: { value: '700000000000311267' } } }, { DetailType: 'DiscountLineDetail' }] };
  ok('diff: an identical invoice reports no differences', M.diffInvoice(p, good, CFG).length === 0, JSON.stringify(M.diffInvoice(p, good, CFG)));
  const bad = Object.assign({}, good, { TotalAmt: 106400, CustomerRef: { name: 'Anonymous' }, Line: [{ DetailType: 'SalesItemLineDetail', SalesItemLineDetail: {} }] });
  const d = M.diffInvoice(p, bad, CFG).map(x => x.field);
  ok('diff: total, class, customer and the missing discount row are each named', d.includes('total') && d.includes('class') && d.includes('customer') && d.includes('discount row'), d.join());
  ok('diff: a missing invoice is one clear entry', M.diffInvoice(p, null, CFG)[0].theirs === 'not in QuickBooks');
}
// ── the import's snapshot: GraphQL node → contract shape → the same invoice ───
{
  const { toQboSrc } = await import('../../netlify/functions/backfill-background.mjs');
  const node = { id: 'gid://shopify/Order/7821703643381', name: '#HG-10496', createdAt: '2026-09-14T13:23:00Z', updatedAt: '2026-09-14T13:30:00Z', cancelledAt: null, tags: [], note: '', email: 'maria@example.ph', taxesIncluded: true, currencyCode: 'PHP', displayFulfillmentStatus: 'UNFULFILLED', displayFinancialStatus: 'PENDING', discountCodes: ['INNO-DD0909-5PLU5'],
    totalPriceSet: { shopMoney: { amount: '95000.0' } }, totalTaxSet: { shopMoney: { amount: '10178.57' } }, totalDiscountsSet: { shopMoney: { amount: '95000.0' } }, currentTotalPriceSet: { shopMoney: { amount: '95000.0' } }, currentTotalTaxSet: { shopMoney: { amount: '10178.57' } }, currentTotalDiscountsSet: { shopMoney: { amount: '95000.0' } },
    totalTipReceivedSet: { shopMoney: { amount: '0.0' } }, currentTotalDutiesSet: null, totalReceivedSet: { shopMoney: { amount: '0.0' } }, totalOutstandingSet: { shopMoney: { amount: '95000.0' } },
    shippingLines: { edges: [] }, paymentTerms: { paymentTermsName: 'Due on receipt', paymentTermsType: 'RECEIPT', dueInDays: null, paymentSchedules: { edges: [{ node: { dueAt: null } }] } },
    purchasingEntity: { __typename: 'Customer' }, billingAddress: { company: 'Skin Station, Inc.' },
    customer: { id: 'gid://shopify/Customer/7001', firstName: 'Maria', lastName: 'Santos', displayName: 'Maria Santos', email: 'maria@example.ph', phone: null, defaultAddress: { address1: '12 Mabini', city: 'Makati', phone: null, company: null } },
    fulfillments: [], refunds: [],
    lineItems: { edges: [{ node: { id: 'gid://shopify/LineItem/1', sku: 'TD040', title: 'TDS FACE NADE 4*2.5ML', variantTitle: null, quantity: 20, currentQuantity: 20, taxable: true, variant: { id: 'gid://shopify/ProductVariant/996' }, originalUnitPriceSet: { shopMoney: { amount: '9500.0' } }, discountedTotalSet: { shopMoney: { amount: '95000.0' } }, discountAllocations: [{ allocatedAmountSet: { shopMoney: { amount: '95000.0' } } }], taxLines: [{ rate: 0.12, priceSet: { shopMoney: { amount: '10178.57' } } }] } }] } };
  const src = toQboSrc(node);
  ok('toQboSrc: ids numeric, money as 2-dp strings, statuses lower-case, terms and company carried, no current_* on an unedited order', src.id === 7821703643381 && src.line_items[0].variant_id === 996 && src.line_items[0].price === '9500.00' && src.total_price === '95000.00' && src.financial_status === 'pending' && src.payment_terms.payment_terms_type === 'RECEIPT' && src.billing_address.company === 'Skin Station, Inc.' && src.current_total_price === undefined && src.discount_codes[0].code === 'INNO-DD0909-5PLU5', JSON.stringify(src).slice(0, 300));
  const n = M.normalizeShopify(src); const p = M.planInvoice(n, CFG);
  ok('toQboSrc → the mapper: HG-10496 on the Manila date (Sep 14 21:23), company customer, due on receipt, 95,000 with the 50 % row', p.docNumber === 'HG-10496' && n.date === '2026-09-14' && p.customerName === 'Skin Station, Inc.' && p.dueDate === '2026-09-14' && near(p.total, 95000) && p.lines.some(l => l.DetailType === 'DiscountLineDetail' && l.DiscountLineDetail.DiscountPercent === 50), JSON.stringify([p.docNumber, n.date, p.customerName, p.dueDate, p.total]));
  const edited = JSON.parse(JSON.stringify(node)); edited.lineItems.edges[0].node.currentQuantity = 10; edited.currentTotalPriceSet.shopMoney.amount = '47500.0'; edited.currentTotalTaxSet.shopMoney.amount = '5089.29'; edited.currentTotalDiscountsSet.shopMoney.amount = '47500.0';
  const es = toQboSrc(edited);
  ok('toQboSrc: an edited order carries current_* totals and current_quantity', es.current_total_price === '47500.00' && es.line_items[0].current_quantity === 10 && M.normalizeShopify(es).edited === true);
}
// ── odds and ends ─────────────────────────────────────────────────────────────
ok('docLabel mirrors docNo(): HS-1042, CM-1003', M.docLabel({}, 'order', 42) === 'HS-1042' && M.docLabel({}, 'cm', 3) === 'CM-1003');
ok('internal / test account regexes', M.INTERNAL_RE.test('Remedy BGC') && M.INTERNAL_RE.test('Pull-out Vertis') && M.TEST_RE.test('Test Clinic') && !M.INTERNAL_RE.test('Skin Station'));
ok('exempt regex: Termosalud, Mark-Vu, Line-Vu, GTG, Symmed; not Inno or Mesoestetic', ['Termosalud', 'MarkVu', 'Mark-Vu', 'Line Vu', 'GTG', 'Symmed'].every(s => M.EXEMPT_RE.test(s)) && !M.EXEMPT_RE.test('Inno') && !M.EXEMPT_RE.test('Mesoestetic'));

console.log('\n' + pass + '/' + (pass + fail) + ' passed'); process.exit(fail ? 1 : 0);
