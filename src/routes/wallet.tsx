import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shell, useProfile } from "@/components/app/Shell";
import { supabase } from "@/integrations/supabase/client";
import {
  errMsg,
  formatKes,
  formatPointsValue,
  getAvailablePayoutMethods,
  KES_PER_POINT,
  KES_PER_USDT,
  MPESA_MIN_POINTS,
  PayoutMethod,
  USDT_MIN_POINTS,
} from "@/lib/viewpay";

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { title: "Wallet — ViewPay" },
      { name: "description", content: "Your points, KES balance and payouts to M-Pesa or USDT." },
      { property: "og:title", content: "Wallet — ViewPay" },
      { property: "og:description", content: "Your points, KES balance and payouts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <Shell>{(uid) => <WalletPage userId={uid} />}</Shell>,
});

function WalletPage({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const profile = useProfile(userId);
  const [selectedMethod, setSelectedMethod] = useState<PayoutMethod | null>(null);
  const [dest, setDest] = useState("");
  const [points, setPoints] = useState("");
  const [busy, setBusy] = useState(false);
  const availableMethods = getAvailablePayoutMethods(profile.data?.country);
  const method =
    selectedMethod && availableMethods.includes(selectedMethod)
      ? selectedMethod
      : (availableMethods[0] ?? "usdt");
  const bal = profile.data?.points ?? 0;
  const min = method === "mpesa" ? MPESA_MIN_POINTS : USDT_MIN_POINTS;
  const pts = Number(points) || 0;
  const cashoutThreshold = method === "mpesa" ? MPESA_MIN_POINTS : USDT_MIN_POINTS;

  const payouts = useQuery({
    queryKey: ["payouts", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payouts")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  async function withdraw(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.rpc("request_payout", {
      _method: method,
      _destination: dest.trim(),
      _points: pts,
    });
    setBusy(false);
    if (error) {
      toast.error(errMsg(error));
      return;
    }
    toast.success("Payout requested. You'll receive it shortly.");
    setPoints("");
    qc.invalidateQueries({ queryKey: ["profile"] });
    qc.invalidateQueries({ queryKey: ["payouts"] });
  }

  const receive =
    method === "mpesa"
      ? formatKes(pts)
      : `${((pts * KES_PER_POINT) / KES_PER_USDT).toFixed(2)} USDT`;

  if (!profile.data) return <p className="text-muted-foreground">Loading wallet…</p>;

  return (
    <div>
      <div className="rounded-3xl bg-primary p-6 text-primary-foreground shadow-glow">
        <p className="text-sm font-medium opacity-80">Balance</p>
        <p className="mt-1 text-4xl font-extrabold tabular">
          {formatPointsValue(bal, profile.data.country)}
        </p>
        <p className="mt-1 font-mono text-sm opacity-80">{bal.toLocaleString()} points</p>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-primary-foreground/20">
          <div
            className="h-full bg-primary-foreground"
            style={{ width: `${Math.min(100, (bal / cashoutThreshold) * 100)}%` }}
          />
        </div>
        <p className="mt-2 text-xs opacity-80">
          {bal >= cashoutThreshold
            ? `You can request a ${method === "mpesa" ? "M-Pesa" : "crypto"} payout now`
            : `${cashoutThreshold - bal} more points to your first ${method === "mpesa" ? "M-Pesa" : "crypto"} payout`}
        </p>
      </div>

      <form onSubmit={withdraw} className="mt-6 rounded-3xl border border-border bg-card p-5">
        <h2 className="font-bold">Cash out</h2>
        <div
          className={`mt-4 grid gap-2 rounded-xl bg-secondary p-1 ${availableMethods.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}
        >
          {availableMethods.map((m) => (
            <Button
              type="button"
              key={m}
              variant={method === m ? "secondary" : "ghost"}
              onClick={() => {
                setSelectedMethod(m);
                setDest("");
              }}
              className="h-10 text-sm font-semibold"
            >
              {m === "mpesa" ? "M-Pesa" : "USDT (TRC20)"}
            </Button>
          ))}
        </div>
        <label className="mt-4 block">
          <span className="text-sm font-medium">
            {method === "mpesa" ? "M-Pesa number" : "TRC20 address or Binance Pay ID"}
          </span>
          <Input
            value={dest}
            onChange={(e) => setDest(e.target.value)}
            placeholder={method === "mpesa" ? "0712 345 678" : "T… or 123456789"}
            className="mt-1.5 h-12 font-mono"
          />
        </label>
        <label className="mt-4 block">
          <span className="text-sm font-medium">Points to cash out</span>
          <div className="mt-1.5 flex gap-2">
            <Input
              inputMode="numeric"
              value={points}
              onChange={(e) => setPoints(e.target.value.replace(/\D/g, ""))}
              placeholder={`Min ${min}`}
              className="h-12 font-mono"
            />
            <Button
              type="button"
              variant="secondary"
              className="h-12"
              onClick={() => setPoints(String(bal))}
            >
              Max
            </Button>
          </div>
        </label>
        <p className="mt-3 text-sm text-muted-foreground">
          You'll receive <span className="font-semibold text-foreground">{receive}</span>
        </p>
        <Button
          type="submit"
          disabled={busy || pts < min || pts > bal || !dest}
          className="mt-4 h-12 w-full rounded-xl text-base font-bold"
        >
          {busy ? "Sending…" : "Request payout"}
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">
          {method === "mpesa"
            ? `M-Pesa is available to Kenyan accounts. Minimum: KSh 50 (${MPESA_MIN_POINTS} points).`
            : `Crypto is available worldwide. Minimum: 1 USDT (${USDT_MIN_POINTS} points).`}
        </p>
      </form>

      <h2 className="mt-8 mb-3 font-bold">History</h2>
      {payouts.data?.length === 0 && (
        <p className="text-sm text-muted-foreground">No payouts yet.</p>
      )}
      <div className="space-y-2">
        {payouts.data?.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between rounded-2xl border border-border bg-card p-4"
          >
            <div>
              <p className="font-semibold tabular">
                {p.currency === "KES"
                  ? `KSh ${Number(p.amount).toFixed(2)}`
                  : `${Number(p.amount).toFixed(2)} USDT`}
              </p>
              <p className="text-xs text-muted-foreground">
                {p.method === "mpesa" ? "M-Pesa" : "USDT"} ·{" "}
                {new Date(p.created_at).toLocaleDateString("en-KE")}
              </p>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${p.status === "paid" ? "bg-success/15 text-success" : p.status === "rejected" ? "bg-destructive/15 text-destructive" : "bg-accent/15 text-accent"}`}
            >
              {p.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
