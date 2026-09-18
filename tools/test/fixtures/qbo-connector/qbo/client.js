// records what the connector would POST; ids are deterministic from names/SKUs so both sides can be compared
export const posted = [];
let seq = 1000;
const items = new Map(), customers = new Map();
export const qbo = {
  esc: s => String(s).replace(/'/g, "\\'"),
  async findOne(entity, where) {
    if (entity === 'Item') { const m = where.match(/^(Sku|Name) = '(.*)'$/); if (!m) return null; const key = m[1] + ':' + m[2]; return items.get(key) || null; }
    if (entity === 'Customer') { const m = where.match(/^DisplayName = '(.*)'$/); return m && customers.get(m[1]) || null; }
    return null;
  },
  async create(entity, body) {
    const doc = Object.assign({ Id: String(seq++), SyncToken: '0' }, body);
    if (entity === 'Item') { if (body.Sku) items.set('Sku:' + body.Sku, doc); items.set('Name:' + body.Name, doc); }
    if (entity === 'Customer') customers.set(body.DisplayName, doc);
    if (entity === 'Invoice') { posted.push(body); doc.TotalAmt = body.__total; }
    return doc;
  },
  async read() { throw new Error('not in harness'); }, async update() { throw new Error('not in harness'); }, async void() {}, async del() {}, async sparseUpdate() {}
};
