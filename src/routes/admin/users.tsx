import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AdminError,
  AdminLoading,
  AdminStatus,
  formatAdminDate,
} from "@/components/app/AdminPrimitives";
import { getAdminUsers, setUserAgentStatus } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/users")({ component: UsersPage });

function UsersPage() {
  const load = useServerFn(getAdminUsers);
  const setAgent = useServerFn(setUserAgentStatus);
  const client = useQueryClient();
  const users = useQuery({ queryKey: ["admin-users"], queryFn: () => load() });
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
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
  async function toggleAgent(userId: string, active: boolean) {
    setBusy(userId);
    try {
      await setAgent({ data: { user_id: userId, active } });
      await client.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success(active ? "Member promoted to agent" : "Agent access removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update agent access");
    } finally {
      setBusy(null);
    }
  }
  if (users.isLoading) return <AdminLoading label="Loading accounts…" />;
  if (users.error)
    return <AdminError message={users.error.message} onRetry={() => void users.refetch()} />;
  return (
    <section>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">Accounts</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtered.length} of {(users.data ?? []).length} members · promote members to agents
            here
          </p>
        </div>
        <Input
          aria-label="Search accounts"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name, email, phone or country"
          className="sm:max-w-sm"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
        {filtered.map((user) => (
          <article key={user.id} className="min-w-0 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate font-semibold">
                  {user.username ? `@${user.username}` : user.id.slice(0, 8)}
                </h3>
                <p className="break-all text-sm text-muted-foreground">
                  {user.email ?? user.phone ?? "No contact details"}
                </p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{user.country ?? "—"}</span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="font-semibold tabular">
                KSh {user.balanceKes.toLocaleString("en-KE", { minimumFractionDigits: 2 })}
              </span>
              <Button
                size="sm"
                variant={user.isAgent ? "secondary" : "default"}
                disabled={busy !== null}
                onClick={() => void toggleAgent(user.id, !user.isAgent)}
              >
                {busy === user.id ? "Saving…" : user.isAgent ? "Remove agent" : "Promote to agent"}
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              <AdminStatus status={user.emailVerified ? "Email verified" : "Email unverified"} />
              {user.phone && (
                <AdminStatus status={user.phoneVerified ? "Phone verified" : "Phone unverified"} />
              )}
              {user.deviceVerificationRequired && <AdminStatus status="Verification required" />}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Joined {formatAdminDate(user.createdAt)}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
