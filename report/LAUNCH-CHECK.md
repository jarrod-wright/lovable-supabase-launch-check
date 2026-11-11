# Synthetic demo. Built to be broken. No client data, no real keys.

# Launch Check report: StorePulse (demo app)

A read-only, fixed-list check of an AI-built store analytics app before it goes
live. This report is the worked example of the Launch Check: a fixed-price,
three-business-day check for apps built with AI tools. Nothing here comes from a
client.

The app was generated for this demonstration. The data is synthetic, every key
in the tree is a dummy, and the app has never been deployed.

**The app:** StorePulse, a store analytics dashboard: Supabase auth, a team
roster, a $29/month Pro tier, test data, generated on the TanStack Start
template. It was generated in an AI builder, exported, and checked exactly the
way a buyer's app is checked.

**The check list (fixed, in order):**

1. Database rules per table and per role.
2. Payment access granted server-side with webhooks that check signatures.
3. Login, reset and magic-link flows.
4. Role checks done only in the interface.
5. Keys in the client bundle.
6. Storage rules.
7. Backup and rollback.

**Method (data-blind, from the terms):** The check is data-blind by default: I
run it without reading your customers' records. Apps holding health data,
financial-account data, stored card numbers or children's data are in scope
data-blind only, at the Diagnosis size, at the list price plus 50 percent
(USD 1,800). Work that needs me to read live regulated records, to sign a
business associate or processor agreement, or to attest to compliance
(HIPAA, PCI, SOC 2) stays declined.

If real customer data appears during the check by accident, I stop, tell you
the same day, delete it, and record it in the report.

The check is read-only: I change nothing; fixes arrive as pull requests you
apply.

## a. Access check (done first)

| Who | What they get on this app |
|---|---|
| Signed-out visitor | Marketing page only. Sign-in required for everything else, and every data function is revoked from `anon`. |
| Signed-in member | Reads **every product and every order row** (F1), their own profile and subscription, the full team roster with roles masked. Sees the Pro page shell and the Team admin affordances (F4). |
| Signed-in admin | Same reads as a member (the interface, not the database, draws the line), plus the promote button (F4). |
| Anyone with the git history | A service-role-shaped key (F5). |

The database draws no line between member and admin: the first migration gives
every signed-in user the same reads (F1). Everything that looks role-separated
in the interface is separation drawn in client code (F4).

## b. Findings in two layers

**Business page.** The app leaks its store data to every signed-in account.
The paid tier opens from the browser without a payment the server ever hears
about. Sign-in emails return to a builder preview address.

The project history keeps a service-role-shaped key even though the working
tree does not. None of these need an exploit: a second account, a browser and
a git command reach all four.

All are fixable in days, and the database rules were already half-fixed in a
later migration the builder generated. The pattern is the risk, not the tool.

**Technical appendix.** The evidence rows below. Every row names the exact
table, role, request or file and carries a step you can run again.

## c. Findings ranked by severity (one evidence row per finding)

| # | Finding | Severity | Where | Reproduction |
|---|---|---|---|---|
| F1a | Any signed-in user reads every profile row | CRITICAL | `before/drizzle/migrations/0000_migration.sql:11` | Run migration 0000 alone (the app's first shipped state) and query `profiles` as any signed-in user: every row returns. |
| F1b | Any signed-in user reads every role assignment | CRITICAL | `0000_migration.sql:23` | Same, on `user_roles`: the full admin/member roster of the store returns. |
| F1c | Any signed-in user reads every product | CRITICAL | `0000_migration.sql:103` | Same, on `products`. |
| F1d | Any signed-in user reads every order | CRITICAL | `0000_migration.sql:116` | Same, on `orders`: every customer order in the store. This is the "each customer sees only its own data" failure. |
| F2 | Pro granted from the browser; no signed webhook anywhere | HIGH | `before/src/routes/_authenticated/billing.tsx:35` and `src/hooks/use-account.ts:21` | Complete the test checkout, clear site data, run `localStorage.setItem("storepulse_pro_unlocked","true")`, reload: the Pro page opens. No `constructEvent` / `stripe-signature` exists anywhere in the tree, so no payment record is ever created server-side. |
| F3a | Sign-up confirmation redirects to a preview address | HIGH | `before/src/routes/auth.tsx:49` | Sign up with confirmation on: the email's action link returns to `https://preview-storepulse.lovable.app`, not the production origin. |
| F3b | Magic-link sign-in redirects to a preview address | HIGH | `before/src/routes/auth.tsx:55` | Request a magic link: same landing. Sessions can be delivered to a host you do not own. |
| F3c | Password reset redirects to a preview address | HIGH | `before/src/routes/auth.tsx:59` | Request a reset: the set-new-password link lands on the preview address. |
| F4a | Admin status trusted from a client query | HIGH | `before/src/hooks/use-account.ts:20` | Sign in as a member and navigate to `/team`: the page renders from client state; the member/admin line is drawn in the browser. |
| F4b | Roster affordances gated in the interface only | HIGH | `before/src/routes/_authenticated/team.tsx:56` | On `/team` as a member: the admin badge logic and promote affordances are client-side conditionals. (The promote RPC itself re-checks server-side; the page access does not.) |
| F5 | Service-role-shaped key reachable in git history | CRITICAL | `git history: commit 4ede1d6, before/.env` (removed from the tree in commit 7faa2ad) | `git log -p --all | grep -c service_role` returns non-zero. The value here is a dummy shaped like the real thing; the placement is the defect. |

Informational rows (fixed-list coverage, no defect in this demo): **F6 storage
rules** is informational here, because the demo stores no user files. In a real
check this row tests public-read buckets and per-user prefixes.

**F7 backup and rollback** is informational too, because the demo configures no
backup or point-in-time recovery. In a real check this row reads the database
plan's PITR window and the rollback path.

Run every row yourself: `python repro/run_checks.py` (exits 1 while a defect
stands).

## d. Production-readiness scorecard

| Fixed-list item | Verdict |
|---|---|
| 1. database rules per table and per role | FAIL (F1a–F1d) |
| 2. payment access granted server-side with webhooks that check signatures | FAIL (F2) |
| 3. login, reset and magic-link flows | FAIL (F3a–F3c) |
| 4. role checks done only in the interface | FAIL (F4a–F4b) |
| 5. keys in the client bundle | FAIL (F5) |
| 6. storage rules | N/A (no storage in this app) |
| 7. backup and rollback | N/A (demo scope) |

Any later fix is measured against this same list; the scorecard is re-run, not
re-written.

## e. What must be fixed before launch (and what can wait)

**Before launch:**

1. **Database rules (F1)**: enable owner-predicated policies on every table.
   The builder later generated the tightened migration
   (`0001_tighten_read_policies.sql`, preserved in this repository); the fix
   exists, it has to be the state the app ships in. Demo fix price: USD 150.
2. **Payment trust (F2)**: create the subscription server-side from a Stripe
   webhook whose signature is checked before any entitlement is granted; delete
   the client-side grant. Demo fix price: USD 200.
3. **Keys (F5)**: service keys live only in server-side secrets; scrub history
   before the repository goes public. Demo fix price: USD 50.
4. **Auth redirects (F3)**: confirmation, magic-link and reset redirects land
   on the production origin. Demo fix price: USD 100.

**Can wait until after launch:** the interface-only role gates (F4), once the
database rules stand. The data is protected at the database layer, and the
interface gates become defence in depth. The storage and backup rows wait until
the app gains storage or a backup plan.

Demo prices are for the demo app. In a real Launch Check, every fix carries a
fixed price in the report, and the check fee is credited in full against a
hardening sprint signed within 30 days.

## f. Acceptance criteria

"Fixed" means the check passes, not that the code changed.

- F1: a second signed-in account gets an empty result set from every
  non-owned row, and check 1 reports no finding.
- F2: Pro access appears only after a server-side webhook verifies the
  Stripe signature; hand-setting the browser flag changes nothing;
  check 2 reports no finding.
- F3: every auth email redirects to the production origin, and check 3
  reports no finding.
- F4: the admin route enforces the role where the data lives, and check 4
  reports no finding.
- F5: no key-shaped string in the bundle or the history, and check 5
  reports no finding.

The acceptance test is the same script that found the defects.

## Provenance

The demo front end was generated with an AI builder from a founder-style
prompt. The builder's session plan is preserved at `before/.lovable/plan/`.
The export was then audited for the four defect classes this demonstration
requires.

Where the generated output lacked a class, a minimal, founder-plausible patch
added it. The patches: the test-checkout grant (F2), the preview-address
redirect constant (F3), and the dummy service-role key with its removal commit
(F5). The loose read policies (F1) and the client-side account flags (F4) are
the generated app's own.

Every key in the tree is a dummy. The exported project's real connection
identifiers were scrubbed to dummy shapes before landing. The `before` app has
never been deployed.
