# ViewPay Rewards

ViewPay is a rewards web app where members watch sponsored ads, answer a question, earn points, and request payouts. It includes account and device checks, a wallet, activity history, referrals, and an administrator workspace.

## Run locally

Requirements: Node.js 22.12 or newer and npm.

```sh
npm install
npm run dev
```

The development server prints its local URL (usually `http://localhost:8080`).

Copy `.env.example` to `.env` and set the Supabase URL and publishable key. Administrator server functions also require `SUPABASE_SERVICE_ROLE_KEY`, configured only in the server environment. Never add a service role key to a `VITE_` variable or browser code.

## Database

Schema and database functions are versioned under `supabase/migrations`. To apply them to a Supabase project, install the [Supabase CLI](https://supabase.com/docs/guides/cli), link the project, then run:

```sh
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

The baseline migrations describe the schema required by this application. Review them against any existing project before applying them to a database that already contains ViewPay tables or user data.

## Checks

```sh
npm run lint
npm test
npx tsc --noEmit
npm run build
```

## Payout operations

Members can request M-Pesa or USDT payouts. An administrator reviews each request and records the provider's payment reference. The app does not currently call M-Pesa Daraja or a crypto payment API automatically. Advertiser revenue and reward cost in the admin overview are estimates, not reconciled payments.

## Phone verification

Accounts currently use username and email sign-in. Legacy synthetic phone logins remain supported, but new SMS one-time-password sign-in requires an SMS provider.
