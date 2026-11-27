# ViewPay roadmap

- [x] Task marketplace: administrator task publishing, limited slot claiming, private instructions, work reports, evidence links, review, and wallet credit on approval.
- [x] Member workspace: task discovery, submission status, earnings history, wallet, referrals, profiles, and account safeguards.
- [x] Administrator workspace: task moderation, submission review, marketplace overview, account directory, payout review, transaction ledger, and platform settings.

## Deployment requirements

- Apply the versioned Supabase migrations, policies, and balance-changing database functions in `supabase/migrations`.
- Configure the server-only `SUPABASE_SERVICE_ROLE_KEY` before using administrator account and marketplace pages.
- Fund posted task commitments and review work before approving wallet credits. Cash payouts remain a separate admin workflow.
- Configure an SMS provider if phone one-time-password login is required; current account creation uses email.
