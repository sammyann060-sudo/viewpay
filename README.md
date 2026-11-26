# ViewPay Rewards

ViewPay is a rewards web app where members watch sponsored ads, answer a question, earn points, and request payouts. It includes account and device checks, a wallet, activity history, referrals, and an administrator workspace.

## Run locally

Requirements: Node.js 20 or newer and npm.

```sh
npm install
npm run dev
```

The development server prints its local URL (usually `http://localhost:8080`).

Copy `.env.example` to `.env` and set the Supabase URL and publishable key for your project. The `VITE_` values are exposed to the browser and must contain only public project configuration. Never put a service role key in a `VITE_` variable or browser code.

Administrator server functions also need `SUPABASE_SERVICE_ROLE_KEY`, configured as a server secret in deployment. The local landing page can run without this key, but administrator data and account lookup operations cannot. A connected Supabase project must have the schema, row-level security policies, and database functions used by the app; those are managed in Lovable for this project.

## Checks

```sh
npm run lint
npm test
npx tsc --noEmit
npm run build
```

## Payout operations

Members can request M-Pesa or USDT payouts. Requests are reviewed and processed by an administrator in the Payouts section. The app does not currently call M-Pesa Daraja or a crypto payment API automatically; operators must send the payment through their provider and record its reference. Advertiser revenue and reward cost in the admin overview are estimates, not reconciled payments.

## Phone verification

Accounts currently use username and email sign-in. The database retains compatibility with synthetic phone login accounts, but an SMS one-time-password provider is not configured.
