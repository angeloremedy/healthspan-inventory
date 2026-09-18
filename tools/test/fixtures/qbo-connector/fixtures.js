// Philippine store: prices VAT-inclusive at 12%. VAT = total * 12/112.
const vatIncl = (total) => (Math.round((total * 12) / 112 * 100) / 100).toFixed(2);

const BEANS = {
  id: 9001, variant_id: 111, sku: 'BB500', title: 'Barako Beans 500g',
  variant_title: 'Default Title', price: '560.00', quantity: 2, taxable: true,
};
const MUG = {
  id: 9002, variant_id: 222, sku: 'MUG01', title: 'Ceramic Mug',
  variant_title: 'Default Title', price: '336.00', quantity: 1, taxable: true,
};

export function order({
  id = 5001,
  name = '#1001',
  financial_status = 'pending',
  total_outstanding,
  discounts = '0.00',
  shipping = '150.00',
  tip = 0,
  cancelled_at = null,
} = {}) {
  const lineTotal = 560 * 2 + 336;
  const total = Math.round((lineTotal - Number(discounts) + Number(shipping) + tip) * 100) / 100;
  // Healthspan's store: goods are VAT-inclusive, shipping and tips are not taxed.
  const taxable = lineTotal - Number(discounts);
  return {
    id,
    name,
    email: 'maria@example.ph',
    currency: 'PHP',
    taxes_included: true,
    created_at: '2026-09-10T09:00:00+08:00',
    processed_at: '2026-09-10T09:00:00+08:00',
    updated_at: '2026-09-10T09:05:00+08:00',
    cancelled_at,
    financial_status,
    total_price: total.toFixed(2),
    total_tax: vatIncl(taxable),
    total_discounts: discounts,
    total_tip_received: tip.toFixed(2),
    total_outstanding:
      total_outstanding ?? (financial_status === 'paid' ? '0.00' : total.toFixed(2)),
    payment_gateway_names: ['Cash on Delivery (COD)'],
    customer: {
      id: 7001, first_name: 'Maria', last_name: 'Santos', email: 'maria@example.ph',
      phone: '+639171234567',
      default_address: { address1: '12 Mabini St', city: 'Makati', province_code: 'MNL', zip: '1200', country_code: 'PH' },
    },
    billing_address: { address1: '12 Mabini St', city: 'Makati', province_code: 'MNL', zip: '1200', country_code: 'PH' },
    shipping_address: { address1: '12 Mabini St', city: 'Makati', province_code: 'MNL', zip: '1200', country_code: 'PH' },
    // Shopify allocates order discounts onto lines; here the whole discount lands on the beans.
    line_items: [
      {
        ...BEANS,
        discount_allocations: Number(discounts) > 0 ? [{ amount: Number(discounts).toFixed(2) }] : [],
        tax_lines: [{ title: 'VAT', rate: 0.12, price: vatIncl(560 * 2 - Number(discounts)) }],
      },
      { ...MUG, discount_allocations: [], tax_lines: [{ title: 'VAT', rate: 0.12, price: vatIncl(336) }] },
    ],
    discount_codes: Number(discounts) > 0 ? [{ code: 'TESTCODE', amount: discounts }] : [],
    shipping_lines: Number(shipping) > 0 ? [{ title: 'Standard', price: shipping, tax_lines: [] }] : [],
  };
}

/**
 * Refund of one bag of beans (560.00 VAT-inclusive) plus the 150.00 shipping.
 * `basis` picks how Shopify reports refund_line_items.subtotal — stores differ,
 * so the connector has to cope with both.
 */
export function refund({ id = 6001, order_id = 5002, basis = 'exclusive' } = {}) {
  const lineItems =
    basis === 'exclusive'
      ? [{ quantity: 1, subtotal: '500.00', total_tax: '60.00' }]
      : [{ quantity: 1, subtotal: '560.00', total_tax: '60.00' }];
  // Shipping was never taxed on this store, so its refund carries no tax.
  const adjustments = [{ kind: 'shipping_refund', amount: '-150.00', tax_amount: '0.00' }];
  return {
    id,
    order_id,
    created_at: '2026-09-12T10:00:00+08:00',
    note: 'Damaged in transit',
    refund_line_items: lineItems.map((li) => ({ ...li, line_item: { ...BEANS, quantity: 1 } })),
    order_adjustments: adjustments,
    transactions: [{ kind: 'refund', status: 'success', amount: '710.00', gateway: 'Cash on Delivery (COD)' }],
  };
}

export const EXPECTED = {
  unpaidTotal: 1606.0,
  unpaidTax: 156.0, // 1456 * 12/112
  refundTotal: 710.0,
};
