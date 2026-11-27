# ViewPay Rewards

ViewPay is a task marketplace. Administrators publish work with clear instructions, a reward and a limited number of slots. Members claim a slot, complete the work and submit a report and evidence. Administrators review submissions; approvals credit the member's wallet, and payout requests are handled separately.

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

The baseline and marketplace migrations describe the schema required by this application. Review them against any existing project before applying them to a database that already contains ViewPay tables or user data. A local database is required to run or lint migrations.

## Checks

```sh
npm run lint
npm test
npx tsc --noEmit
npm run build
```

## Payout operations

Members can request M-Pesa or USDT payouts. An administrator reviews each request and records the provider's payment reference. Approving task work credits the member's in-app balance; it does not trigger an automatic bank or mobile-money transfer. Fund posted task commitments and verify submitted work before approval.

## Marketplace rules

Do not post tasks asking members to create third-party accounts, share passwords or sign-in codes, fake reviews or engagement, or expose private personal information. Task instructions are hidden until a member claims a slot. Reports and optional evidence links are visible to the member and administrators.

## Phone verification

Accounts currently use username and email sign-in. Legacy synthetic phone logins remain supported, but new SMS one-time-password sign-in requires an SMS provider.
