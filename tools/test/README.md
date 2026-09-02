# Headless tests

No framework — plain node, run from the repo root:

```bash
node tools/test/sales-internal-split.test.js
```

`sales-internal-split.test.js` loads `index.html` in jsdom, evaluates `js/01`…`js/10`
as one script (they are classic scripts sharing a global lexical scope — evaluating
them separately hides top-level `let`/`const` from each other and from the test),
then renders the real views against a fixture whose answers are known by
construction: gross ₱1,500 / internal ₱500 / external ₱1,000.

It asserts the things that are easy to get wrong and invisible on inspection:

- the toggle moves the sales figures by exactly the internal amount
- every target scope reads external **whatever the toggle says** — TOTAL, LINE,
  PRODUCT and SPECIALIST, because PRODUCT was gross while the others were not
- commissions never move
- Accounts' Booked total equals Sales overview's for the same setting (these run on
  two different internal flags, and disagreed)
- external + internal = gross in the reconciliation view
- a cache built before the split renders gross with no NaN, and both toolbars say
  the split is still coming
- a current cache does **not** trigger a Shopify rebuild (an exact `!==` version
  test caused a rebuild every 45s, per tab)

Requires `jsdom`, already in `node_modules`.
