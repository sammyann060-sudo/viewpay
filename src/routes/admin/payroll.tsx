import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AdminEmpty,
  AdminError,
  AdminLoading,
  AdminStatus,
  formatAdminDate,
  formatAdminMoney,
} from "@/components/app/AdminPrimitives";
import {
  createAdminAgent,
  getAdminPayroll,
  recordAgentCommission,
  updateAdminAgent,
  updateAgentCommissionStatus,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/payroll")({ component: PayrollPage });

function today() {
  return new Date().toISOString().slice(0, 10);
}

function PayrollPage() {
  const client = useQueryClient();
  const load = useServerFn(getAdminPayroll);
  const createAgent = useServerFn(createAdminAgent);
  const updateAgent = useServerFn(updateAdminAgent);
  const record = useServerFn(recordAgentCommission);
  const markPaid = useServerFn(updateAgentCommissionStatus);
  const payroll = useQuery({ queryKey: ["admin-payroll"], queryFn: () => load() });
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("KE");
  const [unit, setUnit] = useState("Verified referrals");
  const [rate, setRate] = useState("1");
  const [currency, setCurrency] = useState<"KES" | "USD" | "USDT">("KES");
  const [selectedAgent, setSelectedAgent] = useState("");
  const [units, setUnits] = useState("1");
  const [periodStart, setPeriodStart] = useState(today());
  const [periodEnd, setPeriodEnd] = useState(today());
  const [note, setNote] = useState("");
  if (payroll.isLoading) return <AdminLoading label="Loading agent payroll…" />;
  if (payroll.error)
    return <AdminError message={payroll.error.message} onRetry={() => void payroll.refetch()} />;
  const agents = payroll.data?.agents ?? [];
  const commissions = payroll.data?.commissions ?? [];
  async function refresh() {
    await client.invalidateQueries({ queryKey: ["admin-payroll"] });
    await client.invalidateQueries({ queryKey: ["admin-overview"] });
  }
  async function action(run: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await run();
      toast.success(success);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Payroll update failed");
    } finally {
      setBusy(false);
    }
  }
  async function addAgent(event: React.FormEvent) {
    event.preventDefault();
    await action(
      () =>
        createAgent({
          data: {
            name,
            email,
            phone,
            country,
            commission_unit: unit,
            commission_rate: Number(rate),
            currency,
          },
        }),
      "Agent added",
    );
    setName("");
    setEmail("");
    setPhone("");
  }
  async function addCommission(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedAgent) {
      toast.error("Choose an agent first");
      return;
    }
    await action(
      () =>
        record({
          data: {
            agent_id: selectedAgent,
            period_start: periodStart,
            period_end: periodEnd,
            units: Number(units),
            note,
          },
        }),
      "Commission recorded as pending",
    );
    setNote("");
  }
  return (
    <section className="space-y-8">
      <div>
        <h2 className="text-xl font-bold">Agent payroll</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Set commission rates, record completed work, and track payments.
        </p>
      </div>
      <form
        onSubmit={addAgent}
        className="grid gap-3 border border-border bg-card p-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <h3 className="font-bold sm:col-span-2 xl:col-span-4">Add an agent</h3>
        <Input
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Agent name"
          aria-label="Agent name"
        />
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email (optional)"
          aria-label="Agent email"
        />
        <Input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone (optional)"
          aria-label="Agent phone"
        />
        <Input
          required
          maxLength={2}
          value={country}
          onChange={(e) => setCountry(e.target.value.toUpperCase())}
          placeholder="Country code"
          aria-label="Agent country"
        />
        <Input
          required
          maxLength={80}
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="Commission unit"
          aria-label="Commission unit"
        />
        <Input
          required
          type="number"
          min="0.01"
          step="0.01"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          placeholder="Rate per unit"
          aria-label="Rate per unit"
        />
        <select
          aria-label="Commission currency"
          value={currency}
          onChange={(e) => setCurrency(e.target.value as typeof currency)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option>KES</option>
          <option>USD</option>
          <option>USDT</option>
        </select>
        <Button disabled={busy} type="submit">
          Add agent
        </Button>
      </form>
      <div>
        <h3 className="mb-3 font-bold">Agents</h3>
        {agents.length === 0 ? (
          <AdminEmpty>No agents set up yet.</AdminEmpty>
        ) : (
          <div className="space-y-3">
            {agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                disabled={busy}
                onSave={(active, commission_unit, commission_rate) =>
                  action(
                    () =>
                      updateAgent({
                        data: { id: agent.id, active, commission_unit, commission_rate },
                      }),
                    "Agent settings updated",
                  )
                }
              />
            ))}
          </div>
        )}
      </div>
      <form
        onSubmit={addCommission}
        className="grid gap-3 border border-border bg-card p-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <h3 className="font-bold sm:col-span-2 xl:col-span-4">Record completed work</h3>
        <select
          aria-label="Agent"
          required
          value={selectedAgent}
          onChange={(e) => setSelectedAgent(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Choose agent</option>
          {agents
            .filter((agent) => agent.active)
            .map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
        </select>
        <Input
          required
          type="number"
          min="1"
          step="1"
          value={units}
          onChange={(e) => setUnits(e.target.value)}
          aria-label="Completed commission units"
          placeholder="Completed units"
        />
        <Input
          required
          type="date"
          value={periodStart}
          onChange={(e) => setPeriodStart(e.target.value)}
          aria-label="Period start"
        />
        <Input
          required
          type="date"
          value={periodEnd}
          onChange={(e) => setPeriodEnd(e.target.value)}
          aria-label="Period end"
        />
        <Input
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          aria-label="Commission note"
        />
        <Button disabled={busy || agents.every((agent) => !agent.active)} type="submit">
          Record commission
        </Button>
      </form>
      <div>
        <h3 className="mb-3 font-bold">Commission ledger</h3>
        {commissions.length === 0 ? (
          <AdminEmpty>No commissions recorded.</AdminEmpty>
        ) : (
          <div className="overflow-x-auto border-y border-border">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  {["Period", "Agent", "Units", "Amount", "Status", "Reference", "Action"].map(
                    (label) => (
                      <th key={label} className="px-3 py-3">
                        {label}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {commissions.map((commission) => {
                  const agent = agents.find((item) => item.id === commission.agent_id);
                  return (
                    <tr key={commission.id}>
                      <td className="px-3 py-3">
                        {formatAdminDate(`${commission.period_start}T00:00:00`)} –{" "}
                        {formatAdminDate(`${commission.period_end}T00:00:00`)}
                      </td>
                      <td className="px-3 py-3">{agent?.name ?? "Removed agent"}</td>
                      <td className="px-3 py-3">
                        {commission.units} {commission.unit_label}
                      </td>
                      <td className="px-3 py-3 font-semibold tabular">
                        {formatAdminMoney(
                          commission.amount ?? commission.units * commission.rate,
                          commission.currency,
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <AdminStatus status={commission.status} />
                      </td>
                      <td className="px-3 py-3">{commission.reference ?? "—"}</td>
                      <td className="px-3 py-3">
                        {commission.status === "pending" && (
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() => {
                              const reference = window.prompt("Payment reference");
                              if (reference !== null)
                                void action(
                                  () =>
                                    markPaid({
                                      data: {
                                        id: commission.id,
                                        status: "paid",
                                        reference: reference.trim(),
                                      },
                                    }),
                                  "Commission marked as paid",
                                );
                            }}
                          >
                            Mark paid
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function AgentCard({
  agent,
  disabled,
  onSave,
}: {
  agent: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    country: string;
    commission_unit: string;
    commission_rate: number;
    currency: string;
    active: boolean;
  };
  disabled: boolean;
  onSave: (active: boolean, unit: string, rate: number) => Promise<void>;
}) {
  const [unit, setUnit] = useState(agent.commission_unit);
  const [rate, setRate] = useState(String(agent.commission_rate));
  const [saving, setSaving] = useState(false);
  async function save(active: boolean) {
    setSaving(true);
    await onSave(active, unit, Number(rate));
    setSaving(false);
  }
  return (
    <article className="grid gap-3 border border-border bg-card p-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="font-bold">{agent.name}</h4>
          <AdminStatus status={agent.active ? "active" : "inactive"} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {[agent.email, agent.phone, agent.country].filter(Boolean).join(" · ")}
        </p>
        <p className="mt-2 text-sm">
          {agent.commission_unit}: {formatAdminMoney(agent.commission_rate, agent.currency)} per
          unit
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Input
          aria-label={`${agent.name} commission unit`}
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          className="w-36"
        />
        <Input
          aria-label={`${agent.name} rate`}
          type="number"
          min="0.01"
          step="0.01"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          className="w-24"
        />
        <Button
          size="sm"
          variant="secondary"
          disabled={disabled || saving}
          onClick={() => void save(agent.active)}
        >
          Save rate
        </Button>
        <Button size="sm" disabled={disabled || saving} onClick={() => void save(!agent.active)}>
          {agent.active ? "Deactivate" : "Activate"}
        </Button>
      </div>
    </article>
  );
}
