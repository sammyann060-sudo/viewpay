# ViewPay roadmap

- [x] End-user foundation: worldwide username/email accounts, verified contact status, profiles, device safeguards, country-aware payouts, and earnings/history.
- [x] Expanded admin workspace: financial overview, account directory, payout review, transaction ledger, platform settings, and agent commission payroll.
- [x] Review shared account, watch, payout, history, and administrator access behavior; retain server-side role checks for privileged operations.

## Deployment requirements

- Apply the versioned Supabase migrations, policies, and balance-changing database functions in `supabase/migrations`.
- Configure the server-only `SUPABASE_SERVICE_ROLE_KEY` before using administrator account and financial pages.
- Configure an SMS provider if phone one-time-password login is required; current account creation uses email.
- Connect and configure payment providers before enabling automated disbursements. Payouts are currently sent and reconciled manually by an administrator.
- Add active ads with working video URLs and approved quiz content to the connected database.
