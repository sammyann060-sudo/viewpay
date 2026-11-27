import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BriefcaseBusiness, CheckCircle2, Clock3, LockKeyhole, Send } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Shell } from "@/components/app/Shell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/tasks")({
  head: () => ({
    meta: [
      { title: "Available gigs - Gig Nova" },
      {
        name: "description",
        content: "Choose a task, follow its instructions and get paid when your work is approved.",
      },
    ],
  }),
  component: () => <Shell>{(uid) => <TasksPage userId={uid} />}</Shell>,
});

function kes(amount: number) {
  return `KSh ${amount.toLocaleString("en-KE")}`;
}

function TasksPage({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [reports, setReports] = useState<Record<string, string>>({});
  const [evidence, setEvidence] = useState<Record<string, string>>({});

  const tasks = useQuery({
    queryKey: ["marketplace-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id,title,category,task_type,description,reward_kes,slots,claimed_count,status,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const claims = useQuery({
    queryKey: ["my-task-claims", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_claims")
        .select(
          "id,task_id,status,report,evidence_url,admin_note,claimed_at,submitted_at,reviewed_at",
        )
        .eq("user_id", userId)
        .order("claimed_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const inProgressIds = (claims.data ?? [])
    .filter((claim) => claim.status === "claimed")
    .map((claim) => claim.task_id);
  const instructions = useQuery({
    queryKey: ["task-instructions", userId, inProgressIds.join(",")],
    enabled: inProgressIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_private_instructions")
        .select("task_id,instructions,proof_prompt")
        .in("task_id", inProgressIds);
      if (error) throw error;
      return data;
    },
  });

  const claimByTask = new Map((claims.data ?? []).map((claim) => [claim.task_id, claim]));
  const instructionsByTask = new Map((instructions.data ?? []).map((item) => [item.task_id, item]));

  async function claimTask(taskId: string) {
    setBusy(taskId);
    const { error } = await supabase.rpc("claim_task", { _task_id: taskId });
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Task claimed. Read the instructions below.");
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["my-task-claims", userId] }),
      queryClient.invalidateQueries({ queryKey: ["marketplace-tasks"] }),
    ]);
  }

  async function submitWork(claimId: string) {
    setBusy(claimId);
    const { error } = await supabase.rpc("submit_task", {
      _claim_id: claimId,
      _report: reports[claimId] ?? "",
      _evidence_url: evidence[claimId]?.trim() || null,
    });
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Work submitted for review.");
    await queryClient.invalidateQueries({ queryKey: ["my-task-claims", userId] });
  }

  return (
    <div className="space-y-6 pb-8">
      <header>
        <p className="text-sm font-semibold text-primary">GIG NOVA MARKETPLACE</p>
        <h1 className="mt-1 text-3xl font-extrabold">Choose a gig</h1>
        <p className="mt-2 text-muted-foreground">
          Claim an available spot, follow the private instructions and submit your work. Approved
          tasks add earnings to your wallet.
        </p>
      </header>

      <div className="flex items-start gap-3 rounded-2xl border border-border bg-secondary/60 p-4 text-sm">
        <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-muted-foreground">
          Keep your accounts safe. Never send passwords, sign-in codes or private account access as
          task evidence.
        </p>
      </div>

      {tasks.isLoading || claims.isLoading ? (
        <p className="text-muted-foreground">Loading tasksâ€¦</p>
      ) : null}
      {(tasks.error || claims.error) && (
        <p role="alert" className="text-destructive">
          {(tasks.error ?? claims.error)?.message}
        </p>
      )}
      {tasks.data?.length === 0 && (
        <div className="rounded-2xl border border-border bg-card px-5 py-10 text-center">
          <BriefcaseBusiness className="mx-auto h-8 w-8 text-primary" />
          <h2 className="mt-3 font-bold">No tasks available right now</h2>
          <p className="mt-1 text-sm text-muted-foreground">Check back later for new work.</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {tasks.data?.map((task) => {
          const claim = claimByTask.get(task.id);
          const taskInstructions = instructionsByTask.get(task.id);
          const available = Math.max(0, task.slots - task.claimed_count);
          return (
            <article
              key={task.id}
              className="h-full rounded-2xl border border-border bg-card p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge variant="secondary">
                  {task.task_type === "ad"
                    ? "Ad"
                    : task.task_type === "account_subscription"
                      ? "Account subscription"
                      : task.category}
                </Badge>
                <span className="font-bold text-primary">{kes(task.reward_kes)}</span>
              </div>
              <h2 className="mt-3 text-xl font-bold">{task.title}</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                {task.description}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                {task.task_type === "general"
                  ? "One worker can claim this gig"
                  : `${available} of ${task.slots} spots available · visible to everyone`}
              </p>

              {!claim || claim.status === "rejected" ? (
                <div className="mt-4">
                  {claim?.status === "rejected" && (
                    <p className="mb-3 rounded-lg bg-destructive/10 p-3 text-sm text-muted-foreground">
                      Needs changes
                      {claim.admin_note
                        ? `: ${claim.admin_note}`
                        : ". You can review the task and try again."}
                    </p>
                  )}
                  <Button
                    disabled={task.status !== "published" || available === 0 || busy !== null}
                    onClick={() => void claimTask(task.id)}
                  >
                    {busy === task.id ? "Claimingâ€¦" : claim ? "Reclaim task" : "Pick this task"}
                  </Button>
                </div>
              ) : claim.status === "submitted" ? (
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-secondary p-3 text-sm">
                  <Clock3 className="h-4 w-4 text-primary" />
                  Your work is submitted and waiting for review.
                </div>
              ) : claim.status === "approved" ? (
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-secondary p-3 text-sm text-success">
                  <CheckCircle2 className="h-4 w-4" /> Approved. {kes(task.reward_kes)} has been
                  credited to your wallet.
                </div>
              ) : (
                <div className="mt-5 space-y-4 border-t border-border pt-4">
                  <section>
                    <h3 className="font-semibold">Instructions</h3>
                    {taskInstructions ? (
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                        {taskInstructions.instructions}
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Loading task instructionsâ€¦
                      </p>
                    )}
                  </section>
                  <div>
                    <label className="text-sm font-semibold" htmlFor={`report-${claim.id}`}>
                      Your report
                    </label>
                    <Textarea
                      id={`report-${claim.id}`}
                      className="mt-2 min-h-28"
                      maxLength={5000}
                      placeholder="Describe the work you completedâ€¦"
                      value={reports[claim.id] ?? ""}
                      onChange={(event) =>
                        setReports((current) => ({ ...current, [claim.id]: event.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold" htmlFor={`evidence-${claim.id}`}>
                      Evidence link
                    </label>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {taskInstructions?.proof_prompt ??
                        "Add the link requested by the task owner."}
                    </p>
                    <input
                      id={`evidence-${claim.id}`}
                      type="url"
                      required
                      className="mt-2 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="https://â€¦"
                      value={evidence[claim.id] ?? ""}
                      onChange={(event) =>
                        setEvidence((current) => ({ ...current, [claim.id]: event.target.value }))
                      }
                    />
                  </div>
                  <Button disabled={busy !== null} onClick={() => void submitWork(claim.id)}>
                    <Send className="h-4 w-4" />{" "}
                    {busy === claim.id ? "Submittingâ€¦" : "Submit for review"}
                  </Button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
