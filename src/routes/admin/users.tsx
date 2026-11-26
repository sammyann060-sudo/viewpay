import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  AdminError,
  AdminLoading,
  AdminStatus,
  formatAdminDate,
} from "@/components/app/AdminPrimitives";
import { getAdminUsers } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/users")({ component: UsersPage });

function UsersPage() {
  const load = useServerFn(getAdminUsers);
  const users = useQuery({ queryKey: ["admin-users"], queryFn: () => load() });
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (users.data ?? []).filter(
      (user) =>
        !query ||
        [user.username, user.email, user.phone, user.country].some((value) =>
          value?.toLowerCase().includes(query),
        ),
    );
  }, [users.data, search]);
  if (users.isLoading) return <AdminLoading label="Loading accounts…" />;
  if (users.error)
    return <AdminError message={users.error.message} onRetry={() => void users.refetch()} />;
  return (
    <section>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">Accounts</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtered.length.toLocaleString()} of {(users.data ?? []).length.toLocaleString()}{" "}
            accounts
          </p>
        </div>
        <Input
          aria-label="Search accounts"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search username, email, phone, country"
          className="sm:max-w-sm"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="border-y border-border py-8 text-center text-sm text-muted-foreground">
          No matching accounts.
        </p>
      ) : (
        <div className="overflow-x-auto border-y border-border">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                {["Account", "Contact", "Country", "Balance", "Verification", "Joined"].map(
                  (name) => (
                    <th key={name} className="px-3 py-3 font-semibold">
                      {name}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((user) => (
                <tr key={user.id}>
                  <td className="px-3 py-3 font-semibold">
                    {user.username ? `@${user.username}` : user.id.slice(0, 8)}
                  </td>
                  <td className="px-3 py-3">
                    <div>{user.email ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{user.phone ?? "No phone"}</div>
                  </td>
                  <td className="px-3 py-3">{user.country ?? "—"}</td>
                  <td className="px-3 py-3 tabular">{user.points.toLocaleString()} pts</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      <AdminStatus
                        status={user.emailVerified ? "Email verified" : "Email unverified"}
                      />
                      {user.phone && (
                        <AdminStatus
                          status={user.phoneVerified ? "Phone verified" : "Phone unverified"}
                        />
                      )}
                      {user.deviceVerificationRequired && (
                        <AdminStatus status="Verification required" />
                      )}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">
                    {formatAdminDate(user.createdAt)}
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
