import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AdminError, AdminLoading } from "@/components/app/AdminPrimitives";
import { getAdminSettings, saveAdminSettings } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/settings")({ component: SettingsPage });

function SettingsPage() {
  const queryClient = useQueryClient();
  const load = useServerFn(getAdminSettings);
  const save = useServerFn(saveAdminSettings);
  const settings = useQuery({ queryKey: ["admin-settings"], queryFn: () => load() });
  const [maintenance, setMaintenance] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!settings.data) return;
    setMaintenance(settings.data.maintenance_mode);
    setAnnouncement(settings.data.announcement ?? "");
    setEmail(settings.data.support_email ?? "");
  }, [settings.data]);
  if (settings.isLoading) return <AdminLoading label="Loading platform settings…" />;
  if (settings.error)
    return <AdminError message={settings.error.message} onRetry={() => void settings.refetch()} />;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await save({ data: { maintenance_mode: maintenance, announcement, support_email: email } });
      await queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      await queryClient.invalidateQueries({ queryKey: ["platform-settings", "global"] });
      toast.success("Platform settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save settings");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="max-w-2xl">
      <h2 className="text-xl font-bold">Platform settings</h2>
      <p className="mt-1 mb-5 text-sm text-muted-foreground">
        Maintenance mode limits member pages while leaving administrator access available.
      </p>
      <form onSubmit={submit} className="space-y-5">
        <label className="flex items-start gap-3 border border-border bg-card p-4">
          <input
            type="checkbox"
            checked={maintenance}
            onChange={(event) => setMaintenance(event.target.checked)}
            className="mt-1 h-4 w-4 accent-primary"
          />
          <span>
            <span className="block font-semibold">Maintenance mode</span>
            <span className="mt-1 block text-sm text-muted-foreground">
              Show a service notice to members and pause access to earning and wallet pages.
            </span>
          </span>
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Member announcement</span>
          <Textarea
            maxLength={500}
            value={announcement}
            onChange={(event) => setAnnouncement(event.target.value)}
            placeholder="Optional notice shown at the top of member pages"
            className="mt-1.5 min-h-28"
          />
          <span className="mt-1 block text-right text-xs text-muted-foreground">
            {announcement.length}/500
          </span>
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Support email</span>
          <Input
            type="email"
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="support@example.com"
            className="mt-1.5"
          />
        </label>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save settings"}
        </Button>
      </form>
    </section>
  );
}
