<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## ViewPay architecture
- All point balance changes go through SECURITY DEFINER SQL functions (start_ad_view, complete_ad_view, request_payout, process_payout); clients have read-only table access so balances can't be forged.
- ads.correct_index is excluded from the authenticated column grant so quiz answers never reach the browser.
- Phone login maps the number to a synthetic email (`<2547…>@phone.viewpay.app`) until an SMS provider is configured.
- Profile and activity history are separate top-level routes so they retain direct URLs and page-specific metadata.
- Admin server functions re-check the authenticated `user_roles` table before privileged reads or writes, because page visibility alone does not secure data operations.
- Keep admin pages under nested `/admin/*` routes with a shared workspace; test finance estimates as pure calculations so figures stay auditable.
