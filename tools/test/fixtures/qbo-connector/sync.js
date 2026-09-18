import { config } from './config.js';
import { qbo } from './qbo/client.js';
import { store } from './store.js';

const money = (v) => Math.round(Number(v ?? 0) * 100) / 100;
const abs = (v) => Math.abs(money(v));
const dateOnly = (iso) => (iso ? String(iso).slice(0, 10) : new Date().toISOString().slice(0, 10));
const addDays = (isoDate, n) => {
  const d = new Date(isoDate);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const tol = () => config.centTolerance;
const NON = () => config.qbo.nonTaxCodeId;
const saleTaxCode = () => (config.qbo.taxMode === 'none' ? NON() : config.qbo.taxCodeId);

/** Loud, and fatal when QBO_STRICT_TOTALS=true. */
function totalsMismatch(what, expected, got, ref) {
  const msg = `${what} total mismatch for ${ref}: Shopify ${expected.toFixed(2)} vs QBO ${got.toFixed(2)}`;
  if (config.qbo.strictTotals) throw new Error(msg);
  console.error(msg);
}

// ---------------------------------------------------------------- customers

/** B2B orders carry a company on the billing address (or a Shopify B2B company object). */
function companyName(c, order) {
  return (
    order?.company?.name ||
    order?.billing_address?.company ||
    c?.default_address?.company ||
    ''
  ).trim();
}

function customerDisplayName(c, order) {
  if (isAnonymous(c, order)) return config.qbo.anonymousCustomerName;
  const company = companyName(c, order);
  if (company) return company; // invoice the business, not the buyer
  const name = [c?.first_name, c?.last_name].filter(Boolean).join(' ').trim();
  const email = c?.email || order?.email;
  if (name && email) return `${name} (${email})`;
  return name || email || `Shopify Customer ${c?.id ?? order?.id}`;
}

function qboAddress(a) {
  if (!a) return undefined;
  return {
    Line1: a.address1,
    Line2: a.address2 || undefined,
    City: a.city,
    CountrySubDivisionCode: a.province_code,
    PostalCode: a.zip,
    Country: a.country_code,
  };
}

/** Sean's rule: an order with no customer record and no contact details belongs to "Anonymous". */
function isAnonymous(c, order) {
  return !c?.id && !companyName(c, order) && !(c?.email || order?.email) &&
    ![c?.first_name, c?.last_name].some(Boolean);
}

export async function ensureCustomer(shopifyCustomer, order) {
  const key = isAnonymous(shopifyCustomer, order)
    ? 'guest:anonymous'
    : shopifyCustomer?.id ?? `guest:${String(order?.email || order?.id || '').toLowerCase()}`;
  const mapped = await store.getMap('customer', key);
  if (mapped) return mapped.qboId;

  const displayName = customerDisplayName(shopifyCustomer, order).slice(0, 100);
  let existing = await qbo.findOne('Customer', `DisplayName = '${qbo.esc(displayName)}'`);
  const email = shopifyCustomer?.email || order?.email;
  if (!existing && email) {
    existing = await qbo.findOne('Customer', `PrimaryEmailAddr = '${qbo.esc(email)}'`);
  }

  const cust =
    existing ??
    (await qbo.create('Customer', {
      DisplayName: displayName,
      CompanyName: companyName(shopifyCustomer, order) || undefined,
      GivenName: shopifyCustomer?.first_name,
      FamilyName: shopifyCustomer?.last_name,
      PrimaryEmailAddr: email ? { Address: email } : undefined,
      PrimaryPhone: shopifyCustomer?.phone ? { FreeFormNumber: shopifyCustomer.phone } : undefined,
      BillAddr: qboAddress(order?.billing_address ?? shopifyCustomer?.default_address),
      ShipAddr: qboAddress(order?.shipping_address),
      Notes: shopifyCustomer?.id ? `Shopify customer ${shopifyCustomer.id}` : undefined,
    }));

  await store.setMap('customer', key, { qboId: cust.Id });
  return cust.Id;
}

export async function upsertCustomer(shopifyCustomer) {
  const mapped = await store.getMap('customer', shopifyCustomer.id);
  if (!mapped) return ensureCustomer(shopifyCustomer, null);
  const cur = await qbo.read('Customer', mapped.qboId);
  await qbo.sparseUpdate('Customer', {
    Id: cur.Id,
    SyncToken: cur.SyncToken,
    GivenName: shopifyCustomer.first_name,
    FamilyName: shopifyCustomer.last_name,
    PrimaryEmailAddr: shopifyCustomer.email ? { Address: shopifyCustomer.email } : undefined,
    PrimaryPhone: shopifyCustomer.phone ? { FreeFormNumber: shopifyCustomer.phone } : undefined,
    BillAddr: qboAddress(shopifyCustomer.default_address),
  });
  return cur.Id;
}

// -------------------------------------------------------------------- items

/** Stable map key: variant id, else SKU, else product title. */
function itemKey({ variantId, sku, title }) {
  if (variantId !== undefined && variantId !== null && variantId !== '') return String(variantId);
  if (sku) return `sku:${sku}`;
  return `name:${String(title ?? 'unknown').slice(0, 100)}`;
}

export async function ensureItem({ variantId, sku, title, price }) {
  const key = itemKey({ variantId, sku, title });
  const mapped = await store.getMap('item', key);
  if (mapped) return mapped.qboId;

  const name = String(title ?? 'Shopify Item').slice(0, 100);
  let existing = null;
  if (config.itemMatch === 'sku' && sku) {
    existing = await qbo.findOne('Item', `Sku = '${qbo.esc(sku)}'`);
  }
  if (!existing) existing = await qbo.findOne('Item', `Name = '${qbo.esc(name)}'`);

  const item =
    existing ??
    (await qbo.create('Item', {
      Name: name,
      Sku: sku || undefined,
      Type: 'NonInventory',
      UnitPrice: money(price),
      IncomeAccountRef: { value: config.qbo.incomeAccountId },
    }));

  await store.setMap('item', key, { qboId: item.Id });
  return item.Id;
}

export async function upsertProduct(product) {
  for (const v of product.variants ?? []) {
    const title = (product.variants ?? []).length > 1 ? `${product.title} - ${v.title}` : product.title;
    const mapped = await store.getMap('item', itemKey({ variantId: v.id, sku: v.sku, title }));
    if (!mapped) {
      await ensureItem({ variantId: v.id, sku: v.sku, title, price: v.price });
      continue;
    }
    const cur = await qbo.read('Item', mapped.qboId);
    await qbo.sparseUpdate('Item', {
      Id: cur.Id,
      SyncToken: cur.SyncToken,
      Name: String(title).slice(0, 100),
      Sku: v.sku || undefined,
      UnitPrice: money(v.price),
    });
  }
}

const ensureShippingItem = () =>
  config.qbo.shippingItemId ||
  ensureItem({ variantId: 'shopify-shipping', sku: 'SHOPIFY-SHIPPING', title: 'Shopify Shipping', price: 0 });

const ensureAdjustmentItem = () =>
  config.qbo.adjustmentItemId ||
  ensureItem({ variantId: 'shopify-adjustment', sku: 'SHOPIFY-ADJUSTMENT', title: 'Shopify Adjustment', price: 0 });

/** Service item for the negative discount lines (QBO_DISCOUNT_STYLE=line). */
async function ensureDiscountItem() {
  if (config.qbo.discountItemId) return config.qbo.discountItemId;
  const key = 'discount-item';
  const mapped = await store.getMap('item', key);
  if (mapped) return mapped.qboId;
  const name = String(config.qbo.discountItemName).slice(0, 100);
  const item =
    (await qbo.findOne('Item', `Name = '${qbo.esc(name)}'`)) ??
    (await qbo.create('Item', {
      Name: name,
      Type: 'Service',
      IncomeAccountRef: { value: config.qbo.discountAccountId || config.qbo.incomeAccountId },
    }));
  await store.setMap('item', key, { qboId: item.Id });
  return item.Id;
}

// ------------------------------------------------------------------ invoices

// TaxInclusive: line amounts already contain VAT (Shopify "include tax in prices" on).
// TaxExcluded: VAT is added on top of line amounts.
export const globalTaxCalc = () =>
  config.qbo.taxMode === 'none' ? 'NotApplicable' : config.qbo.taxInclusive ? 'TaxInclusive' : 'TaxExcluded';

// Header-level class as well as line-level: QBO shows one or the other depending on the
// company's "Track classes" setting (one per row vs one per transaction).
const headerClass = () => (config.qbo.classId ? { ClassRef: { value: config.qbo.classId } } : {});

const postedTax = (amount) => (config.qbo.taxMode === 'none' ? 0 : money(amount));
/** TxnTaxDetail for a document: an explicit override only in 'total' mode. */
const txnTaxDetail = (amount) =>
  config.qbo.taxMode === 'total' ? { TotalTax: money(amount) } : undefined;
/** After posting: did QBO's own VAT land where Shopify's did? Rounding may differ by a centavo. */
function checkPostedTax(doc, expectedTax, ref) {
  if (config.qbo.taxMode === 'none') return;
  const got = money(doc?.TxnTaxDetail?.TotalTax);
  const diff = Math.abs(got - money(expectedTax));
  if (diff > 0.05) {
    console.warn(`VAT differs for ${ref}: Shopify ${money(expectedTax).toFixed(2)} vs QBO ${got.toFixed(2)} (mode ${config.qbo.taxMode})`);
  }
}

/** What QBO will compute as the document total for these lines. */
function documentTotal(lines, taxAmount) {
  const inclusive = config.qbo.taxMode !== 'none' && config.qbo.taxInclusive;
  const sum = lines.reduce((s, l) => {
    if (l.DetailType === 'DiscountLineDetail') {
      // Discount lines are always sent net; on an inclusive document they take the gross off the total.
      return s - (inclusive ? money(l.__gross ?? l.Amount) : money(l.__net ?? l.Amount));
    }
    return s + (inclusive ? lineGross(l) : money(l.Amount));
  }, 0);
  const addTax = config.qbo.taxMode !== 'none' && !inclusive ? money(taxAmount) : 0;
  return money(sum + addTax);
}

/**
 * Did Shopify actually charge VAT on this line? Exempt products (e.g. Termosalud, Mark-Vu,
 * Line-Vu, GTG) arrive either with taxable=false or with no/zero tax_lines; both mean "No VAT".
 */
function lineIsTaxed(li) {
  if (li.taxable === false) return false;
  if (Array.isArray(li.tax_lines)) {
    return li.tax_lines.reduce((s, t) => s + Number(t.price ?? 0), 0) > 0;
  }
  return true; // no tax information on the line: assume the store default
}

/** Discount Shopify allocated to this line (already in the line's own tax basis). */
function lineDiscount(li) {
  return money((li.discount_allocations ?? []).reduce((s, d) => s + Number(d.amount ?? 0), 0));
}
const discountLabel = (order) => {
  const codes = (order.discount_codes ?? []).map((d) => d.code).filter(Boolean);
  return codes.length ? ` — ${codes.join(', ')}` : '';
};

/** VAT rate that applied to a Shopify line (from its tax_lines), else the configured default. */
function lineRate(li) {
  const r = Number((li.tax_lines ?? []).find((t) => Number(t.rate) > 0)?.rate);
  return Number.isFinite(r) && r > 0 ? r : config.qbo.vatRate;
}

/**
 * Split a Shopify amount into its VAT-inclusive gross and VAT-exclusive net.
 * Shopify tells us which one it gave us (order.taxes_included).
 */
function grossAndNet(amount, order, rate, taxable = true) {
  const a = money(amount);
  if (!taxable || config.qbo.taxMode === 'none') return { gross: a, net: a };
  if (order.taxes_included === true) return { gross: a, net: money(a / (1 + rate)) };
  return { gross: money(a * (1 + rate)), net: a };
}

/**
 * Build one SalesItemLine the way this company's QBO expects it.
 *
 *  TaxInclusive (QBO_TAX_INCLUSIVE=true): QBO reads the VAT-inclusive figure from
 *    SalesItemLineDetail.TaxInclusiveAmt and treats Line.Amount as the net. Sending only
 *    Amount=gross makes QBO add VAT on top (10,200 -> 11,424) — the bug we hit live.
 *  TaxExcluded  (QBO_TAX_INCLUSIVE=false): Line.Amount is the net; QBO adds VAT.
 */
function itemLine({ itemId, description, qty, gross, net, taxable, taxCode }) {
  const q = Number(qty) || 1;
  const detail = { ItemRef: { value: itemId }, Qty: q, TaxCodeRef: { value: taxable ? taxCode : NON() } };
  if (config.qbo.classId) detail.ClassRef = { value: config.qbo.classId };
  if (taxable && config.qbo.taxMode !== 'none' && config.qbo.taxInclusive) {
    detail.TaxInclusiveAmt = gross;
    return { DetailType: 'SalesItemLineDetail', Amount: net, Description: description, SalesItemLineDetail: detail };
  }
  // No UnitPrice: a 2-dp rate times Qty rarely equals the line amount exactly, and QBO rejects
  // the line (error 6070). Left out, QBO derives the rate from Amount / Qty itself.
  const amount = taxable && config.qbo.taxMode !== 'none' ? net : gross;
  return { DetailType: 'SalesItemLineDetail', Amount: amount, Description: description, SalesItemLineDetail: detail };
}

/** The VAT-inclusive value of a line, whichever way it was expressed. */
const lineGross = (l) => money(l.SalesItemLineDetail?.TaxInclusiveAmt ?? l.Amount);

// ---- Order edits ----------------------------------------------------------------------
// After a Shopify order edit, line_items[].quantity still says what was ORIGINALLY ordered and
// current_quantity says what is left; removed items stay in the list with current_quantity 0.
// Likewise total_price/total_tax/total_discounts are the original figures and current_* the
// edited ones. Refunds also lower current_*, but a refund is its own QBO document (refund
// receipt), so the invoice must reflect the sale AS EDITED, with refunded units added back.

/** Units of this line refunded so far (refund_line_items point back at the line). */
function refundedQty(li, order) {
  return (order.refunds ?? []).reduce(
    (s, r) => s + (r.refund_line_items ?? []).filter((x) => x.line_item_id === li.id).reduce((q, x) => q + Number(x.quantity ?? 0), 0),
    0,
  );
}

/** Quantity of the line as the order stands after edits (before refunds). */
function editedQty(li, order) {
  if (li.current_quantity === undefined || li.current_quantity === null) return li.quantity;
  return Number(li.current_quantity) + refundedQty(li, order);
}

/** Has this order been edited (any line's quantity changed other than by refund)? */
export function isEdited(order) {
  return (order.line_items ?? []).some((li) => editedQty(li, order) !== li.quantity);
}

/** Money actually refunded on the order (successful refund transactions). */
function refundedMoney(order) {
  return money(
    (order.refunds ?? []).reduce(
      (s, r) => s + (r.transactions ?? []).filter((t) => t.kind === 'refund' && (t.status ?? 'success') === 'success').reduce((a, t) => a + Number(t.amount ?? 0), 0),
      0,
    ),
  );
}

/** Refunded VAT (from the refunded lines). */
function refundedTax(order) {
  return money((order.refunds ?? []).reduce((s, r) => s + (r.refund_line_items ?? []).reduce((a, x) => a + Number(x.total_tax ?? 0), 0), 0));
}

/**
 * The figures the invoice must reconcile to. Unedited orders keep Shopify's original totals
 * (unchanged behaviour). Edited orders use the current_* totals with refunds added back.
 */
export function invoiceTotals(order) {
  if (!isEdited(order) || order.current_total_price === undefined) {
    return { total: money(order.total_price), tax: money(order.total_tax), discounts: money(order.total_discounts), edited: false };
  }
  return {
    total: money(Number(order.current_total_price) + refundedMoney(order)),
    tax: money(Number(order.current_total_tax ?? order.total_tax) + refundedTax(order)),
    discounts: money(order.current_total_discounts ?? order.total_discounts),
    edited: true,
  };
}

const lineTitle = (li) =>
  li.variant_title && li.variant_title !== 'Default Title' ? `${li.title} - ${li.variant_title}` : li.title;

/**
 * Which discount presentation this order can take.
 *   net    = discounted amount on the item line (discount only in the description)
 *   line   = list price on the item line + a negative "Discount" item line per discounted product
 *   native = list price on the item lines + QBO's own Discount field (what Sean asked for).
 * QBO's Discount field is prorated over EVERY line and read as NET, so it is only exact when
 * all product lines share one tax treatment (all VAT or all exempt) and nothing else (taxed
 * shipping, adjustments) sits on the invoice. Otherwise 'native' falls back to 'line', which
 * is exact by construction.
 */
function discountStyleFor(order) {
  const style = config.qbo.discountStyle;
  if (style !== 'native') return style;
  const items = (order.line_items ?? []).filter((li) => editedQty(li, order) > 0);
  const taxed = new Set(items.map((li) => lineIsTaxed(li)));
  const shipping = (order.shipping_lines ?? []).reduce((s, l) => s + Number(l.price ?? 0), 0);
  const uniform = taxed.size <= 1 && money(shipping) === 0 && Number(order.total_tip_received ?? 0) === 0;
  return uniform ? 'native' : 'line';
}

/**
 * Item (and, in 'line' style, discount) lines for the order's products.
 * scaleDiscount: on an edited order, Shopify may or may not have re-allocated the discount to
 * the remaining units; the caller tries both readings and keeps the one that reconciles.
 * Returns the lines plus how much discount is already embedded in them (gross).
 */
async function buildProductLines(order, { scaleDiscount, style }) {
  const lines = [];
  const taxCode = saleTaxCode();
  const discountItem = style === 'line' ? await ensureDiscountItem() : null;
  let embedded = 0; // discount already reflected in these lines (gross)
  let listTotal = 0; // list value of all product lines (gross)
  let anyTaxed = false;
  let rateSeen = config.qbo.vatRate;

  for (const li of order.line_items ?? []) {
    const qty = editedQty(li, order);
    if (qty <= 0) continue; // removed by an order edit
    const title = lineTitle(li);
    const itemId = await ensureItem({ variantId: li.variant_id, sku: li.sku, title, price: li.price });
    const taxable = lineIsTaxed(li);
    const rate = lineRate(li);
    if (taxable) { anyTaxed = true; rateSeen = rate; }
    // Discounts stay on the line Shopify applied them to (discount_allocations): QBO prorates an
    // order-level discount across every line, taxable or not, which mis-states the VAT base
    // whenever a free/exempt line is involved (HG-10504). 'native' is only used when that cannot happen.
    let allocated = lineDiscount(li);
    if (scaleDiscount && qty !== li.quantity && li.quantity > 0) allocated = money((allocated * qty) / li.quantity);
    const listed = money(Number(li.price) * qty);
    listTotal = money(listTotal + listed);

    if (style === 'native' || (style === 'line' && allocated > 0)) {
      // List price on the item line.
      const g1 = grossAndNet(listed, order, rate, taxable);
      lines.push(itemLine({ itemId, description: title, qty, gross: g1.gross, net: g1.net, taxable, taxCode }));
      if (style === 'line') {
        // ...and the discount as its own negative line with the same tax code.
        const g2 = grossAndNet(allocated, order, rate, taxable);
        lines.push(itemLine({
          itemId: discountItem,
          description: `Discount${discountLabel(order)} — ${title}`,
          qty: 1, gross: money(-g2.gross), net: money(-g2.net), taxable, taxCode,
        }));
        embedded = money(embedded + allocated);
      }
      continue;
    }

    const { gross, net } = grossAndNet(money(listed - allocated), order, rate, taxable);
    const description = allocated > 0
      ? `${title} (list ${listed.toFixed(2)} less discount ${allocated.toFixed(2)}${discountLabel(order)})`
      : title;
    lines.push(itemLine({ itemId, description, qty, gross, net, taxable, taxCode }));
    embedded = money(embedded + allocated);
  }
  return { lines, embedded, listTotal, anyTaxed, rate: rateSeen };
}

async function buildInvoiceLines(order) {
  const totals = invoiceTotals(order);
  const taxCode = saleTaxCode();
  const style = discountStyleFor(order);

  // Edited orders: the discount allocation Shopify reports may be for the original units or for
  // the remaining ones. Take the reading that reconciles with Shopify's own edited total.
  let built = await buildProductLines(order, { scaleDiscount: totals.edited, style });
  if (totals.edited) {
    const probe = await finishInvoiceLines(order, built, totals, taxCode, { probe: true });
    if (Math.abs(money(probe.total - totals.total)) > tol()) {
      const alt = await buildProductLines(order, { scaleDiscount: false, style });
      const altProbe = await finishInvoiceLines(order, alt, totals, taxCode, { probe: true });
      if (Math.abs(money(altProbe.total - totals.total)) < Math.abs(money(probe.total - totals.total))) built = alt;
    }
  }
  return (await finishInvoiceLines(order, built, totals, taxCode, { probe: false })).lines;
}

/**
 * The one QBO Discount row (style 'native', or the unallocated remainder in the other styles).
 * QBO reads its Amount as NET even on an inclusive document. A clean percentage (50% off) is
 * sent as a percentage so the invoice reads the way a person would have typed it.
 */
function qboDiscountLine({ gross, listTotal, order, rate, taxable, taxCode, asPercent }) {
  const { net } = grossAndNet(gross, order, rate, taxable);
  const detail = {
    ...(config.qbo.taxMode !== 'none' ? { TaxCodeRef: { value: taxable ? taxCode : NON() } } : {}),
    ...(config.qbo.classId ? { ClassRef: { value: config.qbo.classId } } : {}),
  };
  let line;
  const pct = listTotal > 0 ? Math.round((gross / listTotal) * 10000) / 100 : 0;
  if (asPercent && pct > 0 && money((listTotal * pct) / 100) === money(gross)) {
    line = { DetailType: 'DiscountLineDetail', DiscountLineDetail: { ...detail, PercentBased: true, DiscountPercent: pct } };
  } else {
    line = { DetailType: 'DiscountLineDetail', Amount: net, DiscountLineDetail: { ...detail, PercentBased: false } };
  }
  // Remembered for the reconciliation only; not serialized to QBO.
  Object.defineProperty(line, '__gross', { value: money(gross), enumerable: false });
  Object.defineProperty(line, '__net', { value: net, enumerable: false });
  return line;
}

/** Shipping, discount row and tip/duty/rounding adjustment; returns lines and their total. */
async function finishInvoiceLines(order, built, totals, taxCode, { probe }) {
  const lines = built.lines.slice();
  const style = discountStyleFor(order);

  const shipping = (order.shipping_lines ?? []).reduce((s, l) => s + Number(l.price ?? 0), 0);
  if (money(shipping) > 0) {
    const shipItem = await ensureShippingItem();
    // Follow what Shopify did: only tag shipping with the VAT code if it actually taxed it.
    const shippingTaxed = (order.shipping_lines ?? []).some((l) =>
      (l.tax_lines ?? []).some((t) => Number(t.price ?? 0) > 0),
    );
    const shipRate = lineRate({ tax_lines: (order.shipping_lines ?? []).flatMap((l) => l.tax_lines ?? []) });
    const { gross, net } = grossAndNet(shipping, order, shipRate, shippingTaxed);
    lines.push(itemLine({
      itemId: shipItem,
      description: (order.shipping_lines ?? []).map((l) => l.title).filter(Boolean).join(', ') || 'Shipping',
      qty: 1, gross, net, taxable: shippingTaxed, taxCode,
    }));
  }

  // Whatever discount is not already inside the lines goes on QBO's Discount row: the whole
  // discount in 'native' style, only an unallocated remainder (e.g. a shipping discount) otherwise.
  const discount = money(totals.discounts - built.embedded);
  if (discount > 0.005) {
    lines.push(qboDiscountLine({
      gross: discount, listTotal: built.listTotal, order, rate: built.rate,
      taxable: built.anyTaxed, taxCode, asPercent: style === 'native',
    }));
  }

  // Tips, duties and rounding live outside the line items but inside Shopify's total.
  const tax = postedTax(totals.tax);
  const target = totals.total;
  const residual = money(target - documentTotal(lines, tax));
  if (Math.abs(residual) > tol()) {
    const explained = money(
      Number(order.total_tip_received ?? 0) +
        Number(order.total_duties ?? order.current_total_duties ?? 0),
    );
    if (Math.abs(money(residual - explained)) > tol()) {
      if (probe) return { lines, total: documentTotal(lines, tax) };
      // Not a tip or a duty: the line mapping and Shopify disagree about this order.
      totalsMismatch('Invoice', target, documentTotal(lines, tax), order.name ?? order.id);
    }
    const adjItem = await ensureAdjustmentItem();
    lines.push(itemLine({ itemId: adjItem, description: 'Shopify adjustment (tip / duty / rounding)', qty: 1, gross: residual, net: residual, taxable: false, taxCode }));
  }
  return { lines, total: documentTotal(lines, tax) };
}

const isVoided = (inv) =>
  money(inv?.TotalAmt) === 0 && /voided/i.test(String(inv?.PrivateNote ?? ''));

/** Shopify B2B payment terms (Net 30 etc.) win over the default terms. */
function invoiceDueDate(order, txnDate) {
  const terms = order.payment_terms;
  const due = terms?.payment_schedules?.[0]?.due_at;
  if (due) return dateOnly(due);
  // "Due on receipt": Shopify leaves due_at empty; the invoice is due the day it is issued.
  if (terms?.payment_terms_type === 'RECEIPT' || /due on receipt/i.test(terms?.payment_terms_name ?? '')) {
    return txnDate;
  }
  const days = Number(terms?.due_in_days);
  if (Number.isFinite(days) && days > 0) return addDays(txnDate, days);
  return addDays(txnDate, config.qbo.invoiceTermsDays);
}

export async function createOrUpdateInvoice(order) {
  const customerId = await ensureCustomer(order.customer, order);
  const txnDate = dateOnly(order.created_at);
  const totals = invoiceTotals(order);
  const tax = postedTax(totals.tax);
  const lines = await buildInvoiceLines(order);
  const expected = totals.total;
  if (totals.edited) console.log(`Order ${order.name}: edited in Shopify; invoicing the edited order (${expected.toFixed(2)}).`);

  const body = {
    CustomerRef: { value: customerId },
    DocNumber: String(order.name ?? order.id).replace('#', '').slice(0, 21),
    TxnDate: txnDate,
    DueDate: invoiceDueDate(order, txnDate),
    PrivateNote: `Shopify order ${order.name} (id ${order.id}); status ${order.financial_status}` +
      (order.payment_terms?.payment_terms_name ? `; terms ${order.payment_terms.payment_terms_name}` : ''),
    CustomerMemo: order.note ? { value: String(order.note).slice(0, 1000) } : undefined,
    BillEmail: order.email ? { Address: order.email } : undefined,
    Line: lines,
    TxnTaxDetail: txnTaxDetail(tax),
    GlobalTaxCalculation: globalTaxCalc(),
    CurrencyRef: order.currency ? { value: order.currency } : undefined,
    ...headerClass(),
  };

  const mapped = await store.getMap('invoice', order.id);
  let cur = null;
  if (mapped) {
    cur = await qbo.read('Invoice', mapped.qboId);
  } else {
    // A prior run may have created the invoice but failed before writing the id map.
    cur = await qbo.findOne('Invoice', `DocNumber = '${qbo.esc(body.DocNumber)}'`);
  }

  if (cur && isVoided(cur)) {
    console.log(`Invoice for ${order.name} is voided in QBO; leaving it alone.`);
    await store.setMap('invoice', order.id, { qboId: cur.Id, customerId, voided: true });
    return cur;
  }

  if (cur) {
    const paidSoFar = money(cur.TotalAmt) - money(cur.Balance);
    if (paidSoFar > 0 && !config.qbo.allowPaidInvoiceEdit) {
      if (Math.abs(money(cur.TotalAmt) - expected) > tol()) {
        console.error(
          `Refusing to rewrite invoice ${cur.Id} (${order.name}): ${paidSoFar.toFixed(2)} already applied ` +
            `and the total changed ${money(cur.TotalAmt).toFixed(2)} -> ${expected.toFixed(2)}. ` +
            `Adjust it in QBO, or set QBO_ALLOW_PAID_INVOICE_EDIT=true.`,
        );
      }
      await store.setMap('invoice', order.id, { qboId: cur.Id, customerId });
      return cur;
    }
  }

  // Full (non-sparse) update: a sparse one would keep the previous TxnTaxDetail as an
  // override, so corrected lines would still carry the old tax total.
  const inv = cur
    ? await qbo.update('Invoice', { ...body, Id: cur.Id, SyncToken: cur.SyncToken })
    : await qbo.create('Invoice', body);

  if (Math.abs(money(inv.TotalAmt) - expected) > tol()) {
    if (!cur && config.qbo.strictTotals) {
      // Never leave a wrong invoice in the books: remove what we just created, then fail loudly.
      try {
        await qbo.del('Invoice', inv.Id);
        console.error(`Deleted freshly created invoice ${inv.Id} for ${order.name}: total did not reconcile.`);
      } catch (e) {
        console.error(`Could not delete mismatched invoice ${inv.Id}: ${e.message}`);
      }
    }
    totalsMismatch('Posted invoice', expected, money(inv.TotalAmt), order.name ?? order.id);
  }
  checkPostedTax(inv, totals.tax, order.name ?? order.id);
  await store.setMap('invoice', order.id, { qboId: inv.Id, customerId });
  return inv;
}

// ------------------------------------------------------------------ payments

/** Amount Shopify says has actually been collected on this order. */
function amountPaid(order) {
  const { total } = invoiceTotals(order); // the invoiced (edited) total, refunds added back
  if (order.total_outstanding !== undefined && order.total_outstanding !== null) {
    return money(total - money(order.total_outstanding));
  }
  if (order.financial_status === 'paid') return total;
  return null; // partially_paid without total_outstanding: unknowable from the webhook
}

export async function recordPayment(order) {
  if (!config.qbo.syncPayments) {
    // Deviation from standard practice (SYNC_PAYMENTS=false): payments are recorded in QBO
    // manually after Collections confirms the money. The invoice stays open until then.
    console.log(`Order ${order.name}: marked ${order.financial_status} in Shopify; payment sync is off, invoice left open.`);
    return null;
  }
  const paid = amountPaid(order);
  if (paid === null) {
    console.warn(`Order ${order.name}: financial_status=${order.financial_status} but no total_outstanding; skipping payment.`);
    return null;
  }
  if (paid <= 0) return null;

  let invMap = await store.getMap('invoice', order.id);
  if (!invMap) {
    const inv = await createOrUpdateInvoice(order);
    invMap = { qboId: inv.Id };
  }

  const already = await store.getMap('payment', order.id);
  const appliedBefore = money(already?.amount ?? 0);
  if (appliedBefore >= paid) return null;

  const inv = await qbo.read('Invoice', invMap.qboId);
  if (isVoided(inv)) {
    console.warn(`Order ${order.name}: invoice is voided; not recording a payment against it.`);
    return null;
  }
  const amount = money(Math.min(paid - appliedBefore, money(inv.Balance)));
  if (amount <= 0) return null;

  const gateway = order.payment_gateway_names?.[0] ?? order.gateway ?? 'Shopify';
  const payment = await qbo.create('Payment', {
    CustomerRef: inv.CustomerRef,
    TotalAmt: amount,
    TxnDate: dateOnly(order.processed_at ?? order.updated_at),
    PaymentRefNum: String(order.name ?? order.id).replace('#', '').slice(0, 21),
    PrivateNote: `Shopify ${gateway} payment for ${order.name}`,
    DepositToAccountRef: { value: config.qbo.depositAccountId },
    PaymentMethodRef: config.qbo.paymentMethodId ? { value: config.qbo.paymentMethodId } : undefined,
    CurrencyRef: order.currency ? { value: order.currency } : undefined,
    Line: [{ Amount: amount, LinkedTxn: [{ TxnId: inv.Id, TxnType: 'Invoice' }] }],
  });
  await store.setMap('payment', order.id, {
    qboId: payment.Id,
    amount: money(appliedBefore + amount),
  });
  return payment;
}

// -------------------------------------------------------- cancel & refunds

/** 'YYYY-MM' of a date/ISO string in the company's timezone. */
function monthKey(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 7);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: config.qbo.timezone, year: 'numeric', month: '2-digit' })
    .formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return `${get('year')}-${get('month')}`;
}

export async function voidInvoice(order) {
  const mapped = await store.getMap('invoice', order.id);
  if (!mapped) return null;
  const inv = await qbo.read('Invoice', mapped.qboId);
  if (isVoided(inv)) return inv;
  if (money(inv.Balance) !== money(inv.TotalAmt)) {
    // Money was already received: cancelling a paid order is a refund, not a void.
    return null;
  }
  const voided = await qbo.void('Invoice', inv.Id);
  await store.setMap('invoice', order.id, { qboId: inv.Id, voided: true });
  return voided;
}

/** Credit Memo mirroring the (unpaid) invoice, applied to it so AR nets to zero. */
async function creditMemoForInvoice(order, inv) {
  const existing = await store.getMap('creditmemo', order.id);
  if (existing) return { action: 'credit_memo', id: existing.qboId, existing: true };

  const docNumber = `CM-${String(order.name ?? order.id).replace('#', '')}`.slice(0, 21);
  let cm = await qbo.findOne('CreditMemo', `DocNumber = '${qbo.esc(docNumber)}'`);
  if (!cm) {
    const lines = await buildInvoiceLines(order);
    cm = await qbo.create('CreditMemo', {
      CustomerRef: inv.CustomerRef,
      DocNumber: docNumber,
      TxnDate: dateOnly(order.cancelled_at),
      PrivateNote: `Shopify order ${order.name} cancelled ${dateOnly(order.cancelled_at)} — invoice ${inv.DocNumber} is in a prior month`,
      Line: lines,
      TxnTaxDetail: txnTaxDetail(postedTax(order.total_tax)),
      GlobalTaxCalculation: globalTaxCalc(),
      CurrencyRef: inv.CurrencyRef,
      ...headerClass(),
    });
    if (Math.abs(money(cm.TotalAmt) - money(inv.TotalAmt)) > tol()) {
      try { await qbo.del('CreditMemo', cm.Id); } catch { /* best effort */ }
      throw new Error(
        `Credit memo for ${order.name} came to ${money(cm.TotalAmt).toFixed(2)} but the invoice is ${money(inv.TotalAmt).toFixed(2)}; not applied.`,
      );
    }
  }
  // Apply the credit to the invoice: a zero-amount Payment linking both documents.
  const amount = money(inv.Balance);
  if (amount > 0) {
    await qbo.create('Payment', {
      CustomerRef: inv.CustomerRef,
      TotalAmt: 0,
      TxnDate: dateOnly(order.cancelled_at),
      PrivateNote: `Credit memo ${docNumber} applied to invoice ${inv.DocNumber} (Shopify cancellation)`,
      CurrencyRef: inv.CurrencyRef,
      Line: [
        { Amount: amount, LinkedTxn: [{ TxnId: inv.Id, TxnType: 'Invoice' }] },
        { Amount: amount, LinkedTxn: [{ TxnId: cm.Id, TxnType: 'CreditMemo' }] },
      ],
    });
  }
  await store.setMap('creditmemo', order.id, { qboId: cm.Id, invoiceId: inv.Id });
  await store.setMap('invoice', order.id, { qboId: inv.Id, creditMemoId: cm.Id });
  return { action: 'credit_memo', id: cm.Id };
}

/**
 * Cancellation policy for an unpaid order:
 *   same month as the invoice  -> void it (the period is still open)
 *   a later month              -> never void; QBO_CROSS_MONTH_CANCEL decides credit memo vs. manual
 * A paid order is never touched here — the money comes back through the refund flow.
 */
export async function cancelInvoice(order) {
  const mapped = await store.getMap('invoice', order.id);
  if (!mapped) return { action: 'no_invoice' };
  const inv = await qbo.read('Invoice', mapped.qboId);
  if (isVoided(inv)) return { action: 'already_voided' };
  if (money(inv.Balance) !== money(inv.TotalAmt)) return { action: 'paid_skip' };

  const invMonth = monthKey(inv.TxnDate);
  const cancelMonth = monthKey(order.cancelled_at ?? new Date().toISOString());
  if (invMonth === cancelMonth) {
    await qbo.void('Invoice', inv.Id);
    await store.setMap('invoice', order.id, { qboId: inv.Id, voided: true });
    return { action: 'voided' };
  }

  if (config.qbo.crossMonthCancel === 'credit_memo') return creditMemoForInvoice(order, inv);

  console.warn(
    `Order ${order.name} cancelled in ${cancelMonth} but invoiced in ${invMonth}: invoice ${inv.DocNumber} left open — ` +
      'issue a credit note in QBO (or set QBO_CROSS_MONTH_CANCEL=credit_memo).',
  );
  await store.setMap('invoice', order.id, { qboId: inv.Id, cancelledCrossMonth: true });
  return { action: 'manual', invoice: inv.DocNumber };
}

/**
 * Shopify's refund_line_items.subtotal is tax-exclusive on some stores and
 * tax-inclusive on others. Decide per refund by checking which reading reproduces
 * the money that was actually refunded.
 */
function refundBasis({ sumSub, sumTax, adjAmount, adjTax, refunded }) {
  const withTax = Math.abs(money(sumSub + sumTax + adjAmount + adjTax) - refunded);
  const withoutTax = Math.abs(money(sumSub + adjAmount + adjTax) - refunded);
  return withoutTax + 1e-9 < withTax ? 'inclusive' : 'exclusive';
}

export async function recordRefund(refund, order) {
  const existing = await store.getMap('refund', refund.id);
  if (existing) return null;

  const invMap = await store.getMap('invoice', order.id);
  const customerId = invMap?.customerId ?? (await ensureCustomer(order.customer, order));

  const refunded = money(
    (refund.transactions ?? [])
      .filter((t) => t.kind === 'refund' && t.status === 'success')
      .reduce((s, t) => s + Number(t.amount ?? 0), 0),
  );
  if (refunded <= 0) {
    console.log(`Refund ${refund.id} for ${order.name} moved no money (restock only); nothing to post.`);
    return null;
  }

  const rows = (refund.refund_line_items ?? []).map((rli) => ({
    li: rli.line_item ?? {},
    qty: Number(rli.quantity ?? 1) || 1,
    sub: money(rli.subtotal),
    tax: money(rli.total_tax),
  }));
  const sumSub = money(rows.reduce((s, r) => s + r.sub, 0));
  const sumTax = money(rows.reduce((s, r) => s + r.tax, 0));
  const adjAmount = money((refund.order_adjustments ?? []).reduce((s, a) => s + abs(a.amount), 0));
  const adjTax = money((refund.order_adjustments ?? []).reduce((s, a) => s + abs(a.tax_amount), 0));

  const basis = refundBasis({ sumSub, sumTax, adjAmount, adjTax, refunded });
  const subIncludesTax = basis === 'inclusive';

  const taxCode = saleTaxCode();
  const lines = [];
  for (const r of rows) {
    const title =
      r.li.variant_title && r.li.variant_title !== 'Default Title'
        ? `${r.li.title} - ${r.li.variant_title}`
        : r.li.title;
    const itemId = await ensureItem({
      variantId: r.li.variant_id,
      sku: r.li.sku,
      title,
      price: r.li.price,
    });
    const taxable = r.tax > 0;
    const gross = subIncludesTax ? r.sub : money(r.sub + r.tax);
    const net = subIncludesTax ? money(r.sub - r.tax) : r.sub;
    lines.push(itemLine({ itemId, description: title, qty: r.qty, gross, net, taxable, taxCode }));
  }

  // Shipping refunds and manual adjustments arrive as order_adjustments (negative amounts).
  if (money(adjAmount + adjTax) > 0) {
    const shipItem = await ensureShippingItem();
    // Same rule as the invoice: VAT code only if Shopify refunded tax on it.
    lines.push(itemLine({
      itemId: shipItem, description: 'Shipping / adjustment refund', qty: 1,
      gross: money(adjAmount + adjTax), net: adjAmount, taxable: adjTax > 0, taxCode,
    }));
  }

  const tax = postedTax(sumTax + adjTax);
  const residual = money(refunded - documentTotal(lines, tax));
  if (Math.abs(residual) > tol()) {
    console.warn(
      `Refund ${refund.id} (${order.name}): ${residual.toFixed(2)} unaccounted for after line mapping; ` +
        `posting it as an adjustment so the receipt equals the ${refunded.toFixed(2)} actually refunded.`,
    );
    const adjItem = await ensureAdjustmentItem();
    lines.push(itemLine({ itemId: adjItem, description: 'Refund adjustment (rounding / fees)', qty: 1, gross: residual, net: residual, taxable: false, taxCode }));
  }

  // Unique per refund, not per order: an order can be refunded more than once, and this
  // DocNumber is also the fallback idempotency key if the id-map write below never lands.
  const docNumber = `R${String(order.name ?? order.id).replace('#', '')}-${String(refund.id).slice(-4)}`.slice(0, 21);
  const alreadyPosted = await qbo.findOne('RefundReceipt', `DocNumber = '${qbo.esc(docNumber)}'`);
  if (alreadyPosted) {
    console.log(`Refund receipt ${docNumber} already exists in QBO; re-linking instead of posting again.`);
    await store.setMap('refund', refund.id, { qboId: alreadyPosted.Id, orderId: order.id, amount: refunded });
    return alreadyPosted;
  }

  const rr = await qbo.create('RefundReceipt', {
    CustomerRef: { value: customerId },
    TxnDate: dateOnly(refund.created_at),
    DocNumber: docNumber,
    PrivateNote: `Shopify refund ${refund.id} for order ${order.name}${refund.note ? ': ' + refund.note : ''}`,
    DepositToAccountRef: { value: config.qbo.depositAccountId },
    PaymentMethodRef: config.qbo.paymentMethodId ? { value: config.qbo.paymentMethodId } : undefined,
    CurrencyRef: order.currency ? { value: order.currency } : undefined,
    Line: lines,
    TxnTaxDetail: txnTaxDetail(tax),
    GlobalTaxCalculation: globalTaxCalc(),
    ...headerClass(),
  });

  if (Math.abs(money(rr.TotalAmt) - refunded) > tol()) {
    totalsMismatch('Refund receipt', refunded, money(rr.TotalAmt), order.name ?? order.id);
  }
  checkPostedTax(rr, tax, `refund ${refund.id}`);
  await store.setMap('refund', refund.id, { qboId: rr.Id, orderId: order.id, amount: refunded });
  return rr;
}
