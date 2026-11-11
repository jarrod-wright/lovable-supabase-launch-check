# StorePulse — Store Analytics Dashboard

## What you'll get
- **Sign in**: email + password, magic link, forgot/reset password. All emails return the user into the app (reset lands on a "set new password" page, magic link lands on the dashboard).
- **Roles**: Store owner (admin) and team member. The first account to sign up becomes the owner; new sign-ups are team members.
- **Dashboard**: revenue over time (line chart), orders per day (bar chart), top products (ranked list + chart), headline numbers (revenue, orders, average order value). Seeded with realistic demo data for the store.
- **Team page**: roster of signed-in teammates with name, plan (Free/Pro) and role badge. Owners get a "Promote to admin" button.
- **Pro plan — $29/month via Stripe checkout**, unlocking a **Pro Insights** page (customer cohorts, repeat-purchase rate, revenue forecast).
- Distinctive look: warm dark-ink + amber "pulse" accent, editorial headline font — not generic.

## Two changes to what you asked, for safety
1. **Pro access is confirmed by Stripe, not the browser.** Unlocking from the browser's checkout response and keeping a flag in localStorage would let anyone grant themselves Pro by typing one line in the browser console. Instead, Stripe notifies the app's backend when payment succeeds; the Pro page checks that record. After checkout the user lands on a "Activating Pro..." screen that unlocks within seconds, and returning users keep access automatically on any device. Cancelling ends access at period end.
2. **Team emails are visible to the owner only.** Showing every customer's email to every signed-in member leaks personal data. Teammates see names, plan and role; the owner additionally sees emails. Only owners can promote, enforced on the server.

## Pages
```text
/                 landing + sign-in CTA
/auth             sign in / sign up / magic link / forgot password
/reset-password   set new password (public)
/dashboard        analytics (signed in)
/team             roster + promote (signed in)
/pro              Pro insights (Pro only, else upgrade prompt)
/billing          upgrade / manage subscription
```
Separate pages (still one smooth app, no full reloads) so links and back button work.

## Technical details
- Lovable Cloud for auth, database, server functions. Enable email auth; scaffold branded auth emails if an email domain is set up.
- Tables: `profiles` (display name, plan), `user_roles` (enum admin/member, separate table, `has_role` security-definer fn), `orders`, `order_items`, `products` with demo rows inserted in the migration, `subscriptions` (written only by the webhook via service role). GRANTs + RLS on every table.
- Roster read via a server function returning emails only when caller `has_role(admin)`; promote via authenticated server fn that checks admin role before update.
- Payments: built-in Stripe (run provider check first, confirm with you, test mode first). Product "StorePulse Pro" $29/mo. Checkout session created server-side; webhook at `/api/public/stripe-webhook` verifies signature and upserts `subscriptions`. Pro gating reads the subscription server-side; no localStorage.
- Charts with recharts; routes under `_authenticated/`; tests for promote-permission and Pro-gating rules.
