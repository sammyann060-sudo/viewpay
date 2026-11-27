import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { Check, CirclePause, CirclePlay, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AdminEmpty, AdminError, AdminLoading } from "@/components/app/AdminPrimitives";
import {
  createMarketplaceTask,
  getMarketplaceAdminData,
  reviewMarketplaceTask,
  updateMarketplaceTaskStatus,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/tasks")({ component: MarketplaceAdminPage });

function money(amount: number) {
  return `KSh ${amount.toLocaleString("en-KE")}`;
}

function MarketplaceAdminPage() {
  const queryClient = useQueryClient();
  const load = useServerFn(getMarketplaceAdminData);
  const create = useServerFn(createMarketplaceTask);
  const setStatus = useServerFn(updateMarketplaceTaskStatus);
  const review = useServerFn(reviewMarketplaceTask);
  const data = useQuery({ queryKey: ["marketplace-admin"], queryFn: () => load() });
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setCreating(true);
    const values = new FormData(form);
    try {
      await create({
        data: {
          title: String(values.get("title") ?? ""),
          category: String(values.get("category") ?? "General"),
          description: String(values.get("description") ?? ""),
          instructions: String(values.get("instructions") ?? ""),
          proof_prompt: String(values.get("proof_prompt") ?? ""),
          reward_kes: Number(values.get("reward_kes")),
          slots: Number(values.get("slots")),
        },
      });
      form.reset();
      toast.success("Task published");
      await queryClient.invalidateQueries({ queryKey: ["marketplace-admin"] });
      await queryClient.invalidateQueries({ queryKey: ["marketplace-tasks"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create task");
    } finally {
      setCreating(false);
    }
  }

  async function changeStatus(id: string, status: "published" | "paused" | "closed") {
    setBusy(id);
    try {
      await setStatus({ data: { id, status } });
      toast.success(`Task ${status}`);
      await queryClient.invalidateQueries({ queryKey: ["marketplace-admin"] });
      await queryClient.invalidateQueries({ queryKey: ["marketplace-tasks"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update task");
    } finally {
      setBusy(null);
    }
  }

  async function decide(claimId: string, decision: "approved" | "rejected") {
    setBusy(claimId);
    try {
      await review({ data: { claim_id: claimId, decision, admin_note: notes[claimId] ?? "" } });
      toast.success(
        decision === "approved"
          ? "Work approved and wallet credited"
          : "Work returned for correction",
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["marketplace-admin"] }),
        queryClient.invalidateQueries({ queryKey: ["marketplace-tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["my-task-claims"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-overview"] }),
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not review submission");
    } finally {
      setBusy(null);
    }
  }

  if (data.isLoading) return <AdminLoading label="Loading tasks and submissions…" />;
  if (data.error)
    return <AdminError message={data.error.message} onRetry={() => void data.refetch()} />;

  const tasks = data.data?.tasks ?? [];
  const submissions = data.data?.claims.filter((claim) => claim.status === "submitted") ?? [];
  const tasksById = new Map(tasks.map((task) => [task.id, task]));

  return (
    <section className="space-y-8 pb-10">
      <header>
        <h2 className="text-xl font-bold">Task marketplace</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Post clear, verifiable work, then review reports before earnings are credited.
        </p>
      </header>

      <div className="rounded-2xl border border-accent/40 bg-accent/10 p-4 text-sm">
        <p className="font-semibold text-accent">Allowed work only</p>
        <p className="mt-1 text-muted-foreground">
          Do not request third-party account creation, passwords or sign-in codes, fake reviews,
          deceptive clicks, or private personal data. Budget is reward × slots. This tracks a
          commitment; it is not escrow, so reserve funds before publishing.
        </p>
      </div>

      <form
        onSubmit={(event) => void createTask(event)}
        className="space-y-4 rounded-2xl border border-border bg-card p-5"
      >
        <div className="flex items-center gap-2">
          <Plus className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-bold">Post a task</h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm font-semibold">
            Task title
            <Input
              name="title"
              required
              minLength={5}
              maxLength={120}
              placeholder="e.g. Test the checkout flow"
            />
          </label>
          <label className="space-y-2 text-sm font-semibold">
            Category
            <Input
              name="category"
              required
              minLength={2}
              maxLength={48}
              defaultValue="General"
              placeholder="Research, testing, writing…"
            />
          </label>
        </div>
        <label className="block space-y-2 text-sm font-semibold">
          Summary
          <Textarea
            name="description"
            required
            minLength={10}
            maxLength={600}
            placeholder="Explain the work and who can do it."
          />
        </label>
        <label className="block space-y-2 text-sm font-semibold">
          Private instructions (shown after a worker claims a slot)
          <Textarea
            name="instructions"
            required
            minLength={10}
            maxLength={10000}
            className="min-h-32"
            placeholder="List the steps in order. Never include passwords or login codes."
          />
        </label>
        <label className="block space-y-2 text-sm font-semibold">
          Evidence link instructions (workers must provide a URL)
          <Input
            name="proof_prompt"
            required
            minLength={5}
            maxLength={500}
            placeholder="e.g. Link to the completed public test report"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm font-semibold">
            Reward per approved task (KES)
            <Input
              name="reward_kes"
              type="number"
              min={1}
              max={100000}
              step={1}
              required
              placeholder="10"
            />
          </label>
          <label className="space-y-2 text-sm font-semibold">
            Available slots
            <Input
              name="slots"
              type="number"
              min={1}
              max={10000}
              step={1}
              required
              placeholder="20"
            />
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          Total commitment: reward per task × available slots. Approval credits the worker’s ViewPay
          balance; cash payouts are a separate admin workflow.
        </p>
        <Button disabled={creating} type="submit">
          {creating ? "Publishing…" : "Publish task"}
        </Button>
      </form>

      <section className="space-y-3">
        <h3 className="text-lg font-bold">Submitted work ({submissions.length})</h3>
        {submissions.length === 0 ? (
          <AdminEmpty>No reports are waiting for review.</AdminEmpty>
        ) : (
          submissions.map((claim) => {
            const task = tasksById.get(claim.task_id);
            return (
              <article
                key={claim.id}
                className="space-y-3 rounded-2xl border border-border bg-card p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold">{task?.title ?? "Task"}</h4>
                    <p className="text-sm text-muted-foreground">
                      {claim.username} · submitted{" "}
                      {claim.submitted_at ? new Date(claim.submitted_at).toLocaleString() : ""}
                    </p>
                  </div>
                  <strong className="text-primary">{money(task?.reward_kes ?? 0)}</strong>
                </div>
                <div className="whitespace-pre-wrap rounded-xl bg-secondary/60 p-3 text-sm">
                  {claim.report}
                </div>
                {claim.evidence_url && (
                  <a
                    className="block break-all text-sm text-primary underline"
                    href={claim.evidence_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open submitted evidence
                  </a>
                )}
                <label className="block space-y-2 text-sm font-semibold">
                  Review note
                  <Textarea
                    value={notes[claim.id] ?? ""}
                    maxLength={2000}
                    onChange={(event) =>
                      setNotes((current) => ({ ...current, [claim.id]: event.target.value }))
                    }
                    placeholder="Explain what needs changing if you reject this work."
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={busy !== null}
                    onClick={() => void decide(claim.id, "approved")}
                  >
                    <Check className="h-4 w-4" />{" "}
                    {busy === claim.id ? "Saving…" : "Approve & credit"}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={busy !== null}
                    onClick={() => void decide(claim.id, "rejected")}
                  >
                    <X className="h-4 w-4" /> Return for correction
                  </Button>
                </div>
              </article>
            );
          })
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-bold">Posted tasks</h3>
        {tasks.length === 0 ? (
          <AdminEmpty>You have not posted any tasks yet.</AdminEmpty>
        ) : (
          tasks.map((task) => (
            <article
              key={task.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
            >
              <div className="min-w-0">
                <h4 className="truncate font-bold">{task.title}</h4>
                <p className="text-sm text-muted-foreground">
                  {task.category} · {task.claimed_count}/{task.slots} slots ·{" "}
                  {money(task.reward_kes)} each
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs capitalize text-muted-foreground">{task.status}</span>
                {task.status === "published" ? (
                  <Button
                    size="icon"
                    variant="secondary"
                    aria-label="Pause task"
                    disabled={busy !== null}
                    onClick={() => void changeStatus(task.id, "paused")}
                  >
                    <CirclePause className="h-4 w-4" />
                  </Button>
                ) : task.status === "paused" || task.status === "closed" ? (
                  <Button
                    size="icon"
                    variant="secondary"
                    aria-label="Publish task"
                    disabled={busy !== null}
                    onClick={() => void changeStatus(task.id, "published")}
                  >
                    <CirclePlay className="h-4 w-4" />
                  </Button>
                ) : null}
                {task.status !== "closed" && (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Close task"
                    disabled={busy !== null}
                    onClick={() => void changeStatus(task.id, "closed")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </article>
          ))
        )}
      </section>
    </section>
  );
}
