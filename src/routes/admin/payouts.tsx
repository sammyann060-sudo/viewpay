import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AdminEmpty,
  AdminError,
  AdminLoading,
  AdminStatus,
  formatAdminDate,
  formatAdminMoney,
} from "@/components/app/AdminPrimitives";
import { getAdminPayouts, processAdminPayout } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/payouts")({ component: PayoutsPage });

function PayoutsPage() {
  const queryClient = useQueryClient();
  const load = useServerFn(getAdminPayouts);
  const process = useServerFn(processAdminPayout);
  const payouts = useQuery({ queryKey: ["admin-payouts"], queryFn: () => load() });
  const [busy, setBusy] = useState<string | null>(null);
  async function act(id: string, status: "paid" | "rejected") {
    if (
      status === "rejected" &&
      !window.confirm("Reject this payout and restore the KES amount to the member's balance?")
    ) {
      return;
    }
    const reference =
      status === "paid" ? window.prompt("Enter the M-Pesa or transaction reference") : "";
    if (reference === null) return;
    if (status === "paid" && !reference.trim()) {
      toast.error("Enter the payment reference before marking this payout paid");
      return;
    }
    setBusy(id);
    try {
      await process({ data: { id, status, reference: reference.trim() } });
      toast.success(
        status === "paid" ? "Payout marked as paid" : "Payout rejected and KES refunded",
      );
      await queryClient.invalidateQueries({ queryKey: ["admin-payouts"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-transactions"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not process payout");
    } finally {
      setBusy(null);
    }
  }
  if (payouts.isLoading) return <AdminLoading label="Loading payout requests…" />;
  if (payouts.error)
    return <AdminError message={payouts.error.message} onRetry={() => void payouts.refetch()} />;
  const rows = payouts.data ?? [];
  return (
    <section>
      <h2 className="text-xl font-bold">Payout requests</h2>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">
        Verify each transfer with your payment provider before marking it paid. Rejections restore
        the user's KES balance.
      </p>
      {rows.length === 0 ? (
        <AdminEmpty>No payout requests have been recorded.</AdminEmpty>
      ) : (
        <div className="space-y-3">
          {rows.map((payout) => (
            <article key={payout.id} className="border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold">
                    {formatAdminMoney(payout.amount, payout.currency)}{" "}
                    <span className="font-normal text-muted-foreground">· M-Pesa</span>
                  </h3>
                  <p className="mt-1 text-sm">{payout.account}</p>
                </div>
                <AdminStatus status={payout.status} />
              </div>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Destination</dt>
                  <dd className="break-all font-mono">{payout.destination}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Requested</dt>
                  <dd>{formatAdminDate(payout.created_at)}</dd>
                </div>
                {payout.reference && (
                  <div>
                    <dt className="text-muted-foreground">Reference</dt>
                    <dd className="break-all">{payout.reference}</dd>
                  </div>
                )}
              </dl>
              {payout.status === "pending" && (
                <div className="mt-4 flex gap-2">
                  <Button disabled={busy !== null} onClick={() => void act(payout.id, "paid")}>
                    {busy === payout.id ? "Saving…" : "Mark paid"}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={busy !== null}
                    onClick={() => void act(payout.id, "rejected")}
                  >
                    Reject and refund
                  </Button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
