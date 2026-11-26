import type { ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-primary">{eyebrow}</p>
        <h1 className="mt-1 break-words text-3xl font-extrabold">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </header>
  );
}

export function AdminMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="min-w-0 border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 break-words text-2xl font-extrabold tabular">{value}</p>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

export function AdminLoading({ label }: { label: string }) {
  return (
    <div role="status" className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
      <LoaderCircle className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

export function AdminError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="border border-destructive/40 bg-destructive/10 p-4">
      <p className="font-semibold">This information could not be loaded.</p>
      <p className="mt-1 break-words text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button className="mt-3" size="sm" variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function AdminEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="border-y border-border py-8 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

export function AdminStatus({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const tone = ["paid", "active", "verified"].includes(normalized)
    ? "bg-success/15 text-success"
    : ["rejected", "inactive", "verification required"].includes(normalized)
      ? "bg-destructive/15 text-destructive"
      : ["pending", "maintenance"].includes(normalized)
        ? "bg-accent/15 text-accent"
        : "bg-secondary text-secondary-foreground";

  return (
    <span
      className={`inline-flex max-w-full break-words px-2 py-1 text-xs font-semibold capitalize ${tone}`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

export function formatAdminMoney(amount: number | null | undefined, currency: string): string {
  const value = Number(amount ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency === "KES" ? `KSh ${value}` : `${value} ${currency}`;
}

export function formatAdminDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
