import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shell, useProfile } from "@/components/app/Shell";
import { supabase } from "@/integrations/supabase/client";
import { errMsg, formatKes, MPESA_MIN_KES } from "@/lib/viewpay";

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { title: "Wallet — ViewPay" },
      { name: "description", content: "Your KES balance and M-Pesa payouts." },
    ],
  }),
  component: () => <Shell>{(uid) => <WalletPage userId={uid} />}</Shell>,
});

function WalletPage({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const profile = useProfile(userId);
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const balance = Number(profile.data?.balance_kes ?? 0);
  const numericAmount = Number(amount) || 0;
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

  async function withdraw(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const { error } = await supabase.rpc("request_payout", {
      _amount_kes: numericAmount,
      _destination: destination.trim(),
    });
    setBusy(false);
    if (error) {
      toast.error(errMsg(error));
      return;
    }
    toast.success("M-Pesa payout request submitted");
    setAmount("");
    void queryClient.invalidateQueries({ queryKey: ["profile", userId] });
    void queryClient.invalidateQueries({ queryKey: ["payouts", userId] });
  }

  if (profile.isLoading) return <p className="text-muted-foreground">Loading wallet…</p>;
  if (profile.error || !profile.data)
    return (
      <p role="alert" className="text-destructive">
        Couldn’t load your wallet.
      </p>
    );
  const isKenyan = profile.data.country?.toUpperCase() === "KE";

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
      <section className="rounded-3xl bg-primary p-6 text-primary-foreground shadow-glow sm:p-8">
        <p className="text-sm font-medium opacity-80">Available balance</p>
        <p className="mt-2 text-4xl font-extrabold tabular sm:text-5xl">{formatKes(balance)}</p>
        <p className="mt-3 max-w-prose text-sm opacity-80">
          Task rewards and agent commissions are credited directly in Kenyan shillings.
        </p>
        {!isKenyan && (
          <p className="mt-5 rounded-xl bg-primary-foreground/10 p-3 text-sm">
            M-Pesa cash-out is currently available to Kenyan accounts only. Your KES earnings remain
            in your wallet.
          </p>
        )}
      </section>
      <form onSubmit={withdraw} className="rounded-3xl border border-border bg-card p-5 sm:p-6">
        <h2 className="text-lg font-bold">Withdraw to M-Pesa</h2>
        <label className="mt-4 block">
          <span className="text-sm font-medium">M-Pesa number</span>
          <Input
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="0712 345 678"
            className="mt-1.5 h-12 font-mono"
          />
        </label>
        <label className="mt-4 block">
          <span className="text-sm font-medium">Amount in KES</span>
          <div className="mt-1.5 flex gap-2">
            <Input
              type="number"
              min={MPESA_MIN_KES}
              max={balance}
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Minimum ${formatKes(MPESA_MIN_KES)}`}
              className="h-12 font-mono"
            />
            <Button
              type="button"
              variant="secondary"
              className="h-12"
              onClick={() => setAmount(balance.toFixed(2))}
            >
              Max
            </Button>
          </div>
        </label>
        <p className="mt-3 text-sm text-muted-foreground">
          Minimum {formatKes(MPESA_MIN_KES)}. Requests are reviewed before funds are sent.
        </p>
        <Button
          type="submit"
          disabled={
            busy ||
            !isKenyan ||
            numericAmount < MPESA_MIN_KES ||
            numericAmount > balance ||
            !destination.trim()
          }
          className="mt-4 h-12 w-full rounded-xl text-base font-bold"
        >
          {busy ? "Submitting…" : "Request payout"}
        </Button>
      </form>
      <section className="xl:col-span-2">
        <h2 className="mb-3 font-bold">Payout history</h2>
        {payouts.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">No payouts yet.</p>
        )}
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {payouts.data?.map((payout) => (
            <article
              key={payout.id}
              className="flex items-center justify-between rounded-2xl border border-border bg-card p-4"
            >
              <div>
                <p className="font-semibold tabular">{formatKes(Number(payout.amount))}</p>
                <p className="text-xs text-muted-foreground">
                  M-Pesa · {new Date(payout.created_at).toLocaleDateString("en-KE")}
                </p>
              </div>
              <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold capitalize">
                {payout.status}
              </span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
