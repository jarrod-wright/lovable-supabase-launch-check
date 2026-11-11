# Class 3 - auth edge cases (fixed-list items 3 and 4)

Synthetic demo. Built to be broken. No client data, no real keys.

## What it looks like on `before`

Password-reset and magic-link emails redirect to the builder's preview address
instead of the production domain. The admin page is gated by a role check that
exists only in the interface, with no matching policy on the server.

## Its check

`repro/run_checks.py` flags redirect configuration values pointing at preview
hosts, and client-only role gates such as `role === "admin"` with no server
enforcement.

## The failing reproduction

Request a magic link and read the action link's host. Sign in as a plain member
and navigate straight to the admin route: it renders. On a fixed app the redirect
lands on the owned domain and the route checks the session's server-side role.
