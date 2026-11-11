# Synthetic demo. Built to be broken. No client data, no real keys.

A demonstration showroom by Jarrod Wright, The Certainty Engineer: an AI-built
store-analytics app (Lovable-style React front end on Supabase, Stripe subscription
in test mode) that carries four classes of defect that matter before launch, and the
Launch Check report that finds them.

Nothing here was taken from any client. The app was generated for this
demonstration, the data is synthetic, and every key in the tree is a dummy value
shaped to make a point. The `before` app is never deployed anywhere; you read the
code, the checks and the report.

## What is here

| Path | What it is |
|---|---|
| `before/` | The demo app as a founder ships it, with the four defect classes present |
| `repro/` | The checks: `python repro/run_checks.py` runs the fixed check list and fails on `before` |
| `defects/` | One page per defect class, with its check |
| `report/` | The Launch Check report for this app: one evidence row per finding |

## The four defect classes

1. **Database rules** — a table with row-level security off, and a policy that lets
   any signed-in user read every row of another.
2. **Payment trust in the browser** — Pro access unlocked from the checkout response
   in the client, with no signed server webhook.
3. **Auth edge cases** — password-reset and magic-link redirects pointing at a
   preview address, and an admin gate that exists only in the interface.
4. **Keys in the bundle and in git history** — a service-role-shaped dummy key the
   project history never forgets.

## Run the checks

```bash
python repro/run_checks.py
```

The script walks `before/`, prints one evidence row per finding in the fixed-list
order, and exits 1 while any defect stands. Every finding names the exact table,
role, request or file and comes with a step you can run again.

## Provenance

The demo front end was generated with an AI builder, exported, and audited for the
four classes above; where the generated output lacked a class the demonstration
requires, a minimal patch added it. The scan results, the report and the checks are
the record. This repository is the worked example behind the Launch Check: a
read-only, fixed-list check of an AI-built app before it goes live, data-blind by
default.
