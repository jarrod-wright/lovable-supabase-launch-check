# Class 1 - database rules (fixed-list item 1)

Synthetic demo. Built to be broken. No client data, no real keys.

## What it looks like on `before`

One table ships with row-level security off, and another carries a policy that
lets any signed-in user read every row. Both come from the generated app's
migrations, which is where AI builders put database rules when asked for speed.

## Its check

`repro/run_checks.py` reads `before/supabase/migrations/*.sql` and flags:

- tables with no `ENABLE ROW LEVEL SECURITY` statement
- policies that grant `authenticated`/`anon`/`public` without a row-owner
  predicate, or with `using (true)` / `with check (true)`

## The failing reproduction

Connect as a second signed-in user and read the other store's rows; the read
succeeds. On a fixed app the same request returns an empty set.
