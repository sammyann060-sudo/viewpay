import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AdminError,
  AdminLoading,
  AdminMetric,
  formatAdminMoney,
} from "@/components/app/AdminPrimitives";
import { getAdminOverview } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/")({ component: OverviewPage });

function OverviewPage() {
  const load = useServerFn(getAdminOverview);
  const overview = useQuery({ queryKey: ["admin-overview"], queryFn: () => load() });
  if (overview.isLoading) return <AdminLoading label="Loading platform overview…" />;
  if (overview.error)
    return <AdminError message={overview.error.message} onRetry={() => void overview.refetch()} />;
  if (!overview.data) return null;
  const data = overview.data;
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Financial health</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Estimates use the configured KSh 2 advertiser value per completed view and KSh 0.20 per
          reward point.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetric label="Accounts" value={data.accountCount.toLocaleString()} />
        <AdminMetric
          label="Completed views"
          value={data.completedViews.toLocaleString()}
          detail={`${data.pointsAwarded.toLocaleString()} reward points issued`}
        />
        <AdminMetric
          label="Outstanding wallet liability"
          value={formatAdminMoney(data.walletLiabilityEstimateKes, "KES")}
          detail={`${data.pointsOutstanding.toLocaleString()} points`}
        />
        <AdminMetric
          label="Estimated advertiser revenue"
          value={formatAdminMoney(data.advertiserRevenueEstimateKes, "KES")}
        />
        <AdminMetric
          label="Estimated reward cost"
          value={formatAdminMoney(data.rewardsEstimateKes, "KES")}
        />
        <AdminMetric
          label="Estimated gross spread"
          value={formatAdminMoney(data.grossSpreadEstimateKes, "KES")}
          detail="Before operating costs and payout fees"
        />
        <AdminMetric label="Pending payouts" value={moneyTotals(data.pendingPayoutsByCurrency)} />
        <AdminMetric
          label="Pending agent payroll"
          value={moneyTotals(data.pendingPayrollByCurrency)}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <MoneyPanel title="Paid out" values={data.paidPayoutsByCurrency} />
        <MoneyPanel title="Pending payouts" values={data.pendingPayoutsByCurrency} />
      </div>
    </section>
  );
}

function moneyTotals(values: Record<string, number>) {
  const entries = Object.entries(values);
  return entries.length
    ? entries.map(([currency, amount]) => formatAdminMoney(amount, currency)).join(" · ")
    : "—";
}

function MoneyPanel({ title, values }: { title: string; values: Record<string, number> }) {
  const entries = Object.entries(values);
  return (
    <div className="border border-border bg-card p-4">
      <h3 className="font-bold">{title}</h3>
      {entries.length ? (
        <ul className="mt-3 space-y-2">
          {entries.map(([currency, amount]) => (
            <li key={currency} className="flex justify-between text-sm">
              <span>{currency}</span>
              <span className="font-semibold tabular">{formatAdminMoney(amount, currency)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">No recorded amounts.</p>
      )}
    </div>
  );
}
