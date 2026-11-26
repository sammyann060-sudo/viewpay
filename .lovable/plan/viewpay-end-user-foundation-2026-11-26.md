# ViewPay end-user foundation

## What to build

- Build on the existing cloud database, which already stores accounts, points, ad views, payouts, and referral relationships; preserve existing user balances and earning rules.
- Add worldwide registration and sign-in with a username or email and password, including a show/hide password control. Keep existing phone-based accounts usable while transitioning them.
- Add a signed-in profile page with username, country, and verified email/phone status. Contact changes remain pending until the new email or phone is verified.
- Add device protection using a browser installation ID, with a default limit of two accounts per installation. A website cannot read a MAC address, so do not auto-ban users for MAC changes; require re-verification on a new browser and disclose that browser IDs can be reset or spoofed.
- Make M-Pesa available only for Kenyan accounts and crypto available worldwide; enforce the country rule in both the interface and payout processing.
- Add watch and transaction history with ad rewards, referral rewards, cash-outs, refunds, and lifetime earned/withdrawn totals, backed by records that users cannot edit.
- Keep the requested admin suite out of this phase: joined-user details, in-house balance/financial health, transaction management, settings, and agent payroll remain the next phase.

## Delivery and checks

- Use an additive database change; do not delete or reset existing accounts, balances, ads, or payout records.
- Add focused checks for the two-account device cap, Kenya-only M-Pesa, global crypto availability, and recorded wallet activity.
- Email confirmation can use the existing account service. Real phone verification requires a configured SMS provider; if none is configured, report that dependency instead of pretending codes can be sent.

## Technical details

- Resolve username sign-ins only on the server; never expose another user's email through a public lookup.
- Keep all balance changes inside trusted database functions and provide users read-only access to their own history.
- Use the app's existing visual style and route patterns; add app-specific page metadata for any new page.