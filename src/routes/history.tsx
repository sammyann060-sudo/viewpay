import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Clock3, Gift, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Shell, useProfile } from "@/components/app/Shell";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, formatKes, summarizeWalletActivity } from "@/lib/viewpay";

export const Route = createFileRoute("/history")({
  component: () => <Shell>{(uid) => <HistoryPage userId={uid} />}</Shell>,
});
type Entry = {
  id: string;
  at: string;
  title: string;
  detail: string;
  amount: number | null;
  status: string | null;
  icon: "task" | "reward" | "payout";
};

function HistoryPage({ userId }: { userId: string }) {
  const profile = useProfile(userId);
  const history = useQuery({
    queryKey: ["history", userId],
    queryFn: async () => {
      const [claims, transactions, payouts] = await Promise.all([
        supabase
          .from("task_claims")
          .select("id,task_id,status,claimed_at,submitted_at,reviewed_at,admin_note")
          .eq("user_id", userId)
          .order("claimed_at", { ascending: false }),
        supabase
          .from("wallet_transactions")
          .select("id,kind,amount,currency,note,created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("payouts")
          .select("id,method,amount,currency,status,created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
      ]);
      if (claims.error) throw claims.error;
      if (transactions.error) throw transactions.error;
      if (payouts.error) throw payouts.error;
      const taskIds = [...new Set(claims.data.map((claim) => claim.task_id))];
      const tasks = taskIds.length
        ? await supabase.from("tasks").select("id,title,reward_kes").in("id", taskIds)
        : { data: [], error: null };
      if (tasks.error) throw tasks.error;
      const taskById = new Map((tasks.data ?? []).map((task) => [task.id, task]));
      const entries: Entry[] = claims.data.map((claim) => {
        const task = taskById.get(claim.task_id);
        return {
          id: `task-${claim.id}`,
          at: claim.reviewed_at ?? claim.submitted_at ?? claim.claimed_at,
          title: task?.title ?? "Marketplace task",
          detail:
            claim.status === "approved"
              ? "Approved · reward credited to your wallet"
              : claim.status === "rejected"
                ? claim.admin_note
                  ? `Returned for correction · ${claim.admin_note}`
                  : "Returned for correction"
                : claim.status === "submitted"
                  ? "Submitted · waiting for review"
                  : "Claimed · work in progress",
          amount: claim.status === "approved" && task ? Number(task.reward_kes) : null,
          status: claim.status,
          icon: "task",
        };
      });
      for (const transaction of transactions.data) {
        if (transaction.kind === "task_reward" || transaction.kind === "payout") continue;
        entries.push({
          id: `transaction-${transaction.id}`,
          at: transaction.created_at,
          title: transaction.kind.replaceAll("_", " "),
          detail: transaction.note ?? "Wallet transaction",
          amount: transaction.amount === null ? null : Number(transaction.amount),
          status: null,
          icon: "reward",
        });
      }
      for (const payout of payouts.data)
        entries.push({
          id: `payout-${payout.id}`,
          at: payout.created_at,
          title: "M-Pesa payout",
          detail: "Cash-out request",
          amount: -Number(payout.amount),
          status: payout.status,
          icon: "payout",
        });
      entries.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
      return { entries, transactions: transactions.data, payouts: payouts.data };
    },
  });
  if (history.isLoading || profile.isLoading)
    return <p className="text-muted-foreground">Loading your activity…</p>;
  if (history.error || profile.error || !history.data || !profile.data)
    return (
      <p role="alert" className="text-destructive">
        Couldn’t load your activity: {errMsg(history.error ?? profile.error)}
      </p>
    );
  const totals = summarizeWalletActivity(
    history.data.transactions.map((row) => ({
      kind: row.kind,
      amount: row.amount === null ? null : Number(row.amount),
    })),
    history.data.payouts.map((row) => ({
      status: row.status,
      amount: Number(row.amount),
      currency: row.currency,
    })),
  );
  return (
    <div className="space-y-7 pb-8">
      <header>
        <p className="text-sm font-semibold text-primary">YOUR ACCOUNT</p>
        <h1 className="mt-1 text-3xl font-extrabold">Earnings & activity</h1>
        <p className="mt-2 text-muted-foreground">
          Your task submissions, approved KES rewards and payout requests.
        </p>
      </header>
      <section
        aria-label="Lifetime totals"
        className="grid gap-5 rounded-2xl border border-border bg-card p-5 sm:grid-cols-3 sm:p-6"
      >
        <div>
          <p className="text-sm text-muted-foreground">Available now</p>
          <p className="mt-1 text-2xl font-extrabold tabular">
            {formatKes(Number(profile.data.balance_kes))}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Earned all time</p>
          <p className="mt-1 text-2xl font-extrabold tabular">{formatKes(totals.earnedKes)}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Successfully paid out</p>
          <p className="mt-1 text-2xl font-extrabold tabular">{formatKes(totals.withdrawnKes)}</p>
        </div>
      </section>
      <section aria-label="Activity history">
        <h2 className="mb-3 font-bold">All activity</h2>
        {history.data.entries.length === 0 ? (
          <div className="border-y border-border py-8 text-center">
            <Clock3 className="mx-auto h-7 w-7 text-muted-foreground" />
            <p className="mt-3 font-semibold">Nothing recorded yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Your tasks and wallet activity will appear here.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {history.data.entries.map((entry) => {
              const Icon =
                entry.icon === "task" ? BadgeCheck : entry.icon === "payout" ? Wallet : Gift;
              return (
                <article
                  key={entry.id}
                  className="flex min-w-0 items-start gap-3 rounded-2xl border border-border bg-card p-4"
                >
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="break-words font-semibold capitalize">{entry.title}</h3>
                      {entry.status && (
                        <Badge variant="secondary" className="capitalize">
                          {entry.status}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 break-words text-sm text-muted-foreground">
                      {entry.detail}
                    </p>
                    <time className="mt-1 block text-xs text-muted-foreground">
                      {new Date(entry.at).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </time>
                  </div>
                  {entry.amount !== null && (
                    <p
                      className={`shrink-0 text-right font-semibold tabular ${entry.amount >= 0 ? "text-success" : "text-muted-foreground"}`}
                    >
                      {entry.amount > 0 ? "+" : ""}
                      {formatKes(entry.amount)}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
