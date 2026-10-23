# Wick & Co. Candles: a legacy Angular to Next.js migration

This repository walks a small candle shop from a legacy Angular 10 app to a Next.js rewrite. Both front ends talk to one shared backend and are held to the same Playwright suite, so behaviour that must survive the migration is proven rather than assumed, and behaviour that differs is documented.

The legacy app is a purpose-built stand-in for a real one. It is written to look and behave like an aging production shop, including a handful of deliberate, documented defects, so the migration has something realistic to preserve and to fix.

## Status

Work in progress. Each step lands as one pull request.

- [x] Step 1: Repository skeleton
- [x] Step 2: Shared backend
- [x] Step 3: Legacy Angular 10 shop
- [ ] Step 4: Shared parity suite, proven on legacy
- [ ] Step 5: Rewrite browse
- [ ] Step 6: Rewrite cart
- [ ] Step 7: Rewrite checkout
- [ ] Step 8: Old versus new results
