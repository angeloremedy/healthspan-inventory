# Frozen copy of the Shopify → QuickBooks connector's mapping (for the parity test only)

`sync.js`, `config.js` and `fixtures.js` are the files of `qbo-shopify-connector` (GCP, live for
HEALTHSPAN GLOBAL INC since 2026-09-15) as handed over on 2026-09-18. `store.js` and `qbo/client.js`
are in-memory stand-ins for its Firestore state and its Intuit client, so `createOrUpdateInvoice()`
can run offline and hand back the exact request body it would have sent.

`tools/test/qbo-parity.test.mjs` feeds the same orders to this code and to HQ's own
`netlify/functions/lib/qbo-map.mjs` and requires the two Invoice bodies to be identical. Do not
"fix" anything here — it is the reference. If Sean changes a rule, change `qbo-map.mjs`, then
retire the affected parity case with a note.
