import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Clock3, Gift, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Shell, useProfile } from "@/components/app/Shell";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, formatPointsValue, summarizeWalletActivity } from "@/lib/viewpay";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Earnings & activity — ViewPay" },
      { name: "description", content: "Review task submissions, approved rewards and payouts." },
    ],
  }),
  component: () => <Shell>{(uid) => <HistoryPage userId={uid} />}</Shell>,
});

type Entry = {
  id: string;
  at: string;
  title: string;
  detail: string;
  points: number | null;
  amount: string | null;
  status: string | null;
  icon: "task" | "reward" | "payout";
};

function formatMoney(amount: number, currency: string) {
  if (currency === "KES") {
    return `KSh ${amount.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function HistoryPage({ userId }: { userId: string }) {
  const profile = useProfile(userId);
  const history = useQuery({
    queryKey: ["history", userId],
    queryFn: async () => {
      const [claimsResult, transactionsResult, payoutsResult] = await Promise.all([
        supabase
          .from("task_claims")
          .select("id,task_id,status,claimed_at,submitted_at,reviewed_at,admin_note")
          .eq("user_id", userId)
          .order("claimed_at", { ascending: false }),
        supabase
          .from("wallet_transactions")
          .select("id,kind,points_delta,amount,currency,note,created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("payouts")
          .select("id,method,amount,currency,points,status,created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
      ]);
      if (claimsResult.error) throw claimsResult.error;
      if (transactionsResult.error) throw transactionsResult.error;
      if (payoutsResult.error) throw payoutsResult.error;

      const taskIds = [...new Set(claimsResult.data.map((claim) => claim.task_id))];
      const taskResult = taskIds.length
        ? await supabase.from("tasks").select("id,title,reward_kes").in("id", taskIds)
        : { data: [], error: null };
      if (taskResult.error) throw taskResult.error;
      const taskById = new Map((taskResult.data ?? []).map((task) => [task.id, task]));
      const entries: Entry[] = claimsResult.data.map((claim) => {
        const task = taskById.get(claim.task_id);
        const at = claim.reviewed_at ?? claim.submitted_at ?? claim.claimed_at;
        const detail =
          claim.status === "approved"
            ? "Approved · reward credited to your wallet"
            : claim.status === "rejected"
              ? claim.admin_note
                ? `Returned for correction · ${claim.admin_note}`
                : "Returned for correction"
              : claim.status === "submitted"
                ? "Submitted · waiting for review"
                : "Claimed · work in progress";
        return {
          id: `task-${claim.id}`,
          at,
          title: task?.title ?? "Marketplace task",
          detail,
          points: claim.status === "approved" && task ? task.reward_kes * 5 : null,
          amount: claim.status === "approved" && task ? formatMoney(task.reward_kes, "KES") : null,
          status: claim.status,
          icon: "task",
        };
      });
      for (const transaction of transactionsResult.data) {
        if (["ad_reward", "task_reward", "payout"].includes(transaction.kind)) continue;
        entries.push({
          id: `transaction-${transaction.id}`,
          at: transaction.created_at,
          title:
            transaction.kind === "referral_reward"
              ? "Referral reward"
              : transaction.kind === "payout_refund"
                ? "Payout refunded"
                : (transaction.note ?? transaction.kind.replaceAll("_", " ")),
          detail: transaction.note ?? "Wallet transaction",
          points: transaction.points_delta,
          amount:
            transaction.amount && transaction.currency
              ? formatMoney(Number(transaction.amount), transaction.currency)
              : null,
          status: null,
          icon: "reward",
        });
      }
      for (const payout of payoutsResult.data) {
        entries.push({
          id: `payout-${payout.id}`,
          at: payout.created_at,
          title: payout.method === "mpesa" ? "M-Pesa payout" : "USDT payout",
          detail: `${Number(payout.points).toLocaleString()} points requested`,
          points: null,
          amount: formatMoney(Number(payout.amount), payout.currency),
          status: payout.status,
          icon: "payout",
        });
      }
      entries.sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime());
      return { entries, transactions: transactionsResult.data, payouts: payoutsResult.data };
    },
  });

  if (history.isLoading || profile.isLoading)
    return <p className="text-muted-foreground">Loading your activity…</p>;
  if (history.error)
    return (
      <p role="alert" className="text-destructive">
        Couldn’t load activity: {errMsg(history.error)}
      </p>
    );
  if (profile.error)
    return (
      <p role="alert" className="text-destructive">
        Couldn’t load your balance: {errMsg(profile.error)}
      </p>
    );
  if (!history.data || !profile.data)
    return <p className="text-muted-foreground">Your activity is unavailable.</p>;

  const totals = summarizeWalletActivity(history.data.transactions, history.data.payouts);
  const withdrawn = Object.entries(totals.withdrawnByCurrency);
  return (
    <div className="space-y-7 pb-8">
      <header>
        <p className="text-sm font-semibold text-primary">YOUR ACCOUNT</p>
        <h1 className="mt-1 text-3xl font-extrabold">Earnings & activity</h1>
        <p className="mt-2 text-muted-foreground">
          Your task submissions, approved rewards and payouts.
        </p>
      </header>
      <section aria-label="Lifetime totals" className="grid grid-cols-2 gap-3">
        <div className="border-b border-border pb-4">
          <p className="text-sm text-muted-foreground">Available now</p>
          <p className="mt-1 text-xl font-extrabold tabular">
            {profile.data.points.toLocaleString()} pts
          </p>
          <p className="text-sm text-muted-foreground">
            {formatPointsValue(profile.data.points, profile.data.country)}
          </p>
        </div>
        <div className="border-b border-border pb-4">
          <p className="text-sm text-muted-foreground">Earned all time</p>
          <p className="mt-1 text-xl font-extrabold tabular">
            {totals.earnedPoints.toLocaleString()} pts
          </p>
          <p className="text-sm text-muted-foreground">
            {formatPointsValue(totals.earnedPoints, profile.data.country)}
          </p>
        </div>
        <div className="col-span-2 pt-1">
          <p className="text-sm text-muted-foreground">Successfully paid out</p>
          {withdrawn.length ? (
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-semibold tabular">
              {withdrawn.map(([currency, amount]) => (
                <span key={currency}>{formatMoney(amount, currency)}</span>
              ))}
            </div>
          ) : (
            <p className="mt-1 font-semibold">No completed payouts yet</p>
          )}
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
          <div className="divide-y divide-border border-y border-border">
            {history.data.entries.map((entry) => {
              const Icon =
                entry.icon === "task" ? BadgeCheck : entry.icon === "payout" ? Wallet : Gift;
              const positive = entry.points !== null && entry.points > 0;
              return (
                <article key={entry.id} className="flex min-w-0 items-start gap-3 py-4">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="break-words font-semibold">{entry.title}</h3>
                      {entry.status && (
                        <Badge variant="secondary" className="capitalize">
                          {entry.status}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 break-words text-sm text-muted-foreground">
                      {entry.detail}
                    </p>
                    <time className="mt-1 block text-xs text-muted-foreground" dateTime={entry.at}>
                      {new Date(entry.at).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </time>
                  </div>
                  <div className="shrink-0 text-right">
                    {entry.points !== null && (
                      <p
                        className={`font-semibold tabular ${positive ? "text-success" : "text-muted-foreground"}`}
                      >
                        {positive ? "+" : ""}
                        {entry.points.toLocaleString()} pts
                      </p>
                    )}
                    {entry.amount && <p className="font-semibold tabular">{entry.amount}</p>}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
