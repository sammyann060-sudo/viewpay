import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { Shell, useIsAdmin } from "@/components/app/Shell";
import { AdminLoading } from "@/components/app/AdminPrimitives";
import { useSession } from "@/lib/viewpay";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin workspace — Gig Nova" },
      { name: "description", content: "Manage Gig Nova accounts, payouts and platform operations." },
    ],
  }),
  component: AdminLayout,
});

const sections = [
  ["/admin", "Overview"],
  ["/admin/tasks", "Tasks"],
  ["/admin/users", "Users"],
  ["/admin/payouts", "Payouts"],
  ["/admin/transactions", "Transactions"],
  ["/admin/settings", "Settings"],
] as const;

function AdminLayout() {
  const { session, ready } = useSession();
  const admin = useIsAdmin(session?.user.id);

  return (
    <Shell>
      {() => {
        if (!ready || admin.isLoading)
          return <AdminLoading label="Checking administrator access…" />;
        if (!admin.data)
          return (
            <p role="alert" className="py-8 text-muted-foreground">
              You don't have access to this workspace.
            </p>
          );
        return (
          <div className="space-y-6 pb-10">
            <header className="border-b border-border pb-5">
              <p className="text-sm font-semibold text-primary">GIG NOVA OPERATIONS</p>
              <h1 className="mt-1 text-3xl font-extrabold">Admin workspace</h1>
              <nav aria-label="Admin sections" className="mt-5 flex gap-2 overflow-x-auto pb-1">
                {sections.map(([to, label]) => (
                  <Link
                    key={to}
                    to={to}
                    activeOptions={{ exact: to === "/admin" }}
                    activeProps={{ className: "border-primary bg-primary/10 text-primary" }}
                    className="shrink-0 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
                  >
                    {label}
                  </Link>
                ))}
              </nav>
            </header>
            <Outlet />
          </div>
        );
      }}
    </Shell>
  );
}
