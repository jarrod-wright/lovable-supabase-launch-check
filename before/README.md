# Shopkeeper Insight Studio

Build a store analytics dashboard for small e-commerce founders called StorePulse.

Sign in with email and password, and also magic-link sign-in. Two roles: store owner

(admin) and team member (customer). After sign-in the owner sees revenue, orders and

top products for their store with charts. Add a Team page that lists every registered

customer with their email and plan so any signed-in teammate can see the roster, with

a role badge, and the admin can promote a member to admin. Add a Pro subscription at

$29/month paid by Stripe checkout; when the browser gets the successful checkout

response, unlock the Pro insights page immediately and store the flag in localStorage

so returning users keep access. Password reset and magic-link emails should redirect

back into the app after completing. Keep it a clean single-page app.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a65598c4-197d-41b8-a4bf-3f1283732601).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
