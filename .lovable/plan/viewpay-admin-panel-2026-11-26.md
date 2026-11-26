# ViewPay admin panel

## What will be built
- Expand `/admin` into an admin-only workspace with overview, user accounts, financial health, transactions and payout review, settings, and agent payroll.
- Show searchable account details, verification status, country, join date, and current points balance.
- Report completed ad views, estimated advertiser revenue, rewards issued, pending payouts, outstanding member balances, and payroll obligations. Clearly label estimates; the current app has no reconciled cash ledger.
- Preserve payout approval and rejection. Add agent records with a commission rate and unit name, period-based approved unit counts, calculated commission amounts, references, and payment status.
- Add saved maintenance, support-contact, and announcement settings. Show announcements to signed-in members and keep the admin workspace available during maintenance.

## Safety and data access
- Protect every admin read and write with authenticated server functions that verify the admin role on the server.
- Add admin-only records with row-level access rules and explicit grants. Signed-in members may read only the public settings needed for announcements and maintenance status.
- Keep existing earning, conversion, and payout thresholds unchanged.

## Technical approach
- Use nested `/admin/*` pages and the existing app shell, with each page receiving its own title and sharing a compact admin navigation.
- Add database records for platform settings, agents, and commission payroll; keep server-only privileged reads behind an admin check.
- Add focused tests for payroll input validation and financial summary calculations, then verify the panel in the preview.

## Assumptions
- Commission totals will be calculated from an agent's rate and admin-approved units for each pay period; automatic attribution to member activity remains undecided.
- The financial page will show evidence-based estimates, not claim an actual bank or mobile-money balance that ViewPay does not currently record.