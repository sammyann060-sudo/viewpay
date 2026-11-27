import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Shell } from "@/components/app/Shell";
import { formatKes, errMsg } from "@/lib/viewpay";
import { getAgentDashboard } from "@/lib/agent.functions";

export const Route = createFileRoute("/agent")({
  component: () => <Shell>{() => <AgentPage />}</Shell>,
});
function AgentPage() {
  const load = useServerFn(getAgentDashboard);
  const dashboard = useQuery({ queryKey: ["agent-dashboard"], queryFn: () => load() });
  const [copied, setCopied] = useState(false);
  if (dashboard.isLoading) return <p className="text-muted-foreground">Loading agent workspace…</p>;
  if (dashboard.error)
    return (
      <section className="rounded-2xl border border-border p-6">
        <h1 className="text-xl font-bold">Agent workspace unavailable</h1>
        <p className="mt-2 text-muted-foreground">{errMsg(dashboard.error)}</p>
      </section>
    );
  if (!dashboard.data) return null;
  const inviteUrl = `${typeof window === "undefined" ? "" : window.location.origin}/auth?ref=${encodeURIComponent(dashboard.data.referralCode)}`;
  async function copyLink() {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    toast.success("Referral link copied");
    window.setTimeout(() => setCopied(false), 1800);
  }
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-primary">AGENT WORKSPACE</p>
        <h1 className="mt-1 text-3xl font-extrabold">Your clients</h1>
        <p className="mt-2 text-muted-foreground">
          Earn KSh 5 once when a client you referred gets their first task approved.
        </p>
      </header>
      <section className="grid gap-3 sm:grid-cols-3">
        <Metric label="Clients referred" value={dashboard.data.clients.length.toLocaleString()} />
        <Metric
          label="Clients with approved work"
          value={dashboard.data.qualifiedClients.toLocaleString()}
        />
        <Metric label="Commission credited" value={formatKes(dashboard.data.totalCommissionKes)} />
      </section>
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h2 className="font-bold">Your referral link</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Share this link with prospective clients. Their first approved task triggers the fixed
          commission.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <code className="min-w-0 flex-1 break-all rounded-xl bg-secondary p-3 text-sm">
            {inviteUrl}
          </code>
          <Button onClick={() => void copyLink()} className="h-12 shrink-0">
            {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
      </section>
      <section>
        <h2 className="mb-3 font-bold">Referred clients</h2>
        {dashboard.data.clients.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Clients who join through your link will appear here.
          </p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {dashboard.data.clients.map((client) => (
              <article
                key={client.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4"
              >
                <div className="min-w-0">
                  <h3 className="truncate font-semibold">
                    {client.username ? `@${client.username}` : `Client ${client.id.slice(0, 8)}`}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Joined {new Date(client.created_at).toLocaleDateString("en-KE")}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  {client.commission ? (
                    <>
                      <p className="font-bold text-success">
                        +{formatKes(client.commission.amount_kes)}
                      </p>
                      <p className="text-xs text-muted-foreground">Credited</p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold">Waiting</p>
                      <p className="text-xs text-muted-foreground">First approval</p>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-extrabold tabular">{value}</p>
    </div>
  );
}
