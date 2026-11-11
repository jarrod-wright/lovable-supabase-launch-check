# Class 2 - payment trust in the browser (fixed-list item 2)

Synthetic demo. Built to be broken. No client data, no real keys.

## What it looks like on `before`

The checkout response in the client unlocks the Pro page and stores the flag in
localStorage. No server route verifies a Stripe webhook signature, so the grant
has no server-side record at all.

## Its check

`repro/run_checks.py` flags entitlement writes keyed to checkout success and the
absence of `constructEvent` / `stripe-signature` anywhere in the tree.

## The failing reproduction

Complete a test-mode checkout, clear site data, set the localStorage key by hand,
reload: Pro unlocks with no payment. On a fixed app the grant comes only from the
signed webhook, and a hand-set flag does nothing.
