import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  AdminEmpty,
  AdminError,
  AdminLoading,
  AdminStatus,
  formatAdminDate,
  formatAdminMoney,
} from "@/components/app/AdminPrimitives";
import { getAdminTransactions } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/transactions")({ component: TransactionsPage });

function TransactionsPage() {
  const load = useServerFn(getAdminTransactions);
  const transactions = useQuery({ queryKey: ["admin-transactions"], queryFn: () => load() });
  const [search, setSearch] = useState("");
  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (transactions.data ?? []).filter(
      (row) =>
        !query ||
        [row.account, row.kind, row.status, row.currency, row.reference].some((value) =>
          value?.toLowerCase().includes(query),
        ),
    );
  }, [transactions.data, search]);
  if (transactions.isLoading) return <AdminLoading label="Loading transactions…" />;
  if (transactions.error)
    return (
      <AdminError
        message={transactions.error.message}
        onRetry={() => void transactions.refetch()}
      />
    );
  return (
    <section>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">Transactions</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Latest 200 wallet entries and 200 payout requests.
          </p>
        </div>
        <Input
          aria-label="Search transactions"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search account, type, status"
          className="sm:max-w-xs"
        />
      </div>
      {rows.length === 0 ? (
        <AdminEmpty>No matching transactions.</AdminEmpty>
      ) : (
        <div className="overflow-x-auto border-y border-border">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                {["Date", "Account", "Activity", "Points", "Amount", "Status", "Reference"].map(
                  (label) => (
                    <th key={label} className="px-3 py-3 font-semibold">
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">
                    {formatAdminDate(row.createdAt)}
                  </td>
                  <td className="px-3 py-3 font-semibold">{row.account}</td>
                  <td className="px-3 py-3 capitalize">{row.kind}</td>
                  <td className="px-3 py-3 tabular">
                    {row.points > 0 ? "+" : ""}
                    {row.points.toLocaleString()}
                  </td>
                  <td className="px-3 py-3 tabular">
                    {row.amount === null
                      ? "—"
                      : formatAdminMoney(row.amount, row.currency ?? "KES")}
                  </td>
                  <td className="px-3 py-3">
                    <AdminStatus status={row.status} />
                  </td>
                  <td className="max-w-48 break-all px-3 py-3 text-muted-foreground">
                    {row.reference ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
