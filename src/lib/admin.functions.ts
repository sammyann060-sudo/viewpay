import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import {
  agentStatusSchema,
  hasAdminRole,
  marketplaceTaskSchema,
  marketplaceTaskStatusSchema,
  payoutActionSchema,
  platformSettingsSchema,
  taskReviewSchema,
} from "@/lib/admin.schemas";

type PageResult<T> = { data: T[] | null; error: { message: string } | null };

async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<PageResult<T>>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await fetchPage(from, from + 999);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

async function assertAdmin(supabase: SupabaseClient<Database>, userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();
  if (error || !data || !hasAdminRole([data.role]))
    throw new Error("Administrator access is required");
}

async function listAuthUsers(supabaseAdmin: SupabaseClient<Database>) {
  const users: Array<{
    id: string;
    email?: string;
    email_confirmed_at?: string;
  }> = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

export const getAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const profiles = await fetchAllPages(
      async (from, to) =>
        await supabaseAdmin
          .from("profiles")
          .select(
            "id, username, country, phone, phone_number, phone_verified_at, balance_kes, created_at, device_lock_required",
          )
          .order("created_at", { ascending: false })
          .range(from, to),
    );
    const [authUsers, agents] = await Promise.all([
      listAuthUsers(supabaseAdmin),
      fetchAllPages(
        async (from, to) =>
          await supabaseAdmin.from("agent_profiles").select("user_id,active").range(from, to),
      ),
    ]);
    const authById = new Map(authUsers.map((user) => [user.id, user]));
    const agentById = new Map(agents.map((agent) => [agent.user_id, agent.active]));

    return profiles.map((profile) => {
      const authUser = authById.get(profile.id);
      return {
        id: profile.id,
        username: profile.username,
        email: authUser?.email ?? null,
        emailVerified: Boolean(authUser?.email_confirmed_at),
        country: profile.country,
        phone: profile.phone_number ?? profile.phone,
        phoneVerified: Boolean(profile.phone_verified_at),
        balanceKes: Number(profile.balance_kes),
        isAgent: agentById.get(profile.id) === true,
        createdAt: profile.created_at,
        deviceVerificationRequired: profile.device_lock_required,
      };
    });
  });

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [profiles, tasks, claims, payouts, activeAgents, commissions] = await Promise.all([
      fetchAllPages(
        async (from, to) =>
          await supabaseAdmin.from("profiles").select("balance_kes").range(from, to),
      ),
      fetchAllPages(
        async (from, to) =>
          await supabaseAdmin
            .from("tasks")
            .select("id,reward_kes,slots,claimed_count,status")
            .range(from, to),
      ),
      fetchAllPages(
        async (from, to) =>
          await supabaseAdmin.from("task_claims").select("task_id,status").range(from, to),
      ),
      fetchAllPages(
        async (from, to) =>
          await supabaseAdmin.from("payouts").select("amount, currency, status").range(from, to),
      ),
      fetchAllPages(
        async (from, to) =>
          await supabaseAdmin
            .from("agent_profiles")
            .select("user_id")
            .eq("active", true)
            .range(from, to),
      ),
      fetchAllPages(
        async (from, to) =>
          await supabaseAdmin.from("agent_client_commissions").select("amount_kes").range(from, to),
      ),
    ]);

    const walletLiabilityKes = profiles.reduce(
      (total, profile) => total + Number(profile.balance_kes),
      0,
    );
    const taskById = new Map(tasks.map((task) => [task.id, task]));
    const activeClaimCounts = new Map<string, number>();
    for (const claim of claims) {
      if (claim.status === "claimed" || claim.status === "submitted") {
        activeClaimCounts.set(claim.task_id, (activeClaimCounts.get(claim.task_id) ?? 0) + 1);
      }
    }
    const approvedTasks = claims.filter((claim) => claim.status === "approved");
    const approvedRewardsKes = approvedTasks.reduce(
      (total, claim) => total + (taskById.get(claim.task_id)?.reward_kes ?? 0),
      0,
    );
    const pendingSubmissions = claims.filter((claim) => claim.status === "submitted").length;
    const postedTaskBudgetKes = tasks.reduce((total, task) => {
      const unclaimedPublishedSlots =
        task.status === "published" ? Math.max(0, task.slots - task.claimed_count) : 0;
      const assignedWork = activeClaimCounts.get(task.id) ?? 0;
      return total + (unclaimedPublishedSlots + assignedWork) * task.reward_kes;
    }, 0);
    const sumByCurrency = (
      rows: Array<{ amount: number | null; currency: string; status: string }>,
      status: string,
    ) => {
      const totals: Record<string, number> = {};
      for (const row of rows) {
        if (row.status !== status) continue;
        totals[row.currency] = (totals[row.currency] ?? 0) + Number(row.amount ?? 0);
      }
      return totals;
    };
    return {
      accountCount: profiles.length,
      taskCount: tasks.length,
      pendingSubmissions,
      approvedTaskCount: approvedTasks.length,
      approvedRewardsKes,
      postedTaskBudgetKes,
      walletLiabilityKes,
      pendingPayoutsByCurrency: sumByCurrency(payouts, "pending"),
      paidPayoutsByCurrency: sumByCurrency(payouts, "paid"),
      activeAgentCount: activeAgents.length,
      agentCommissionsKes: commissions.reduce((sum, item) => sum + item.amount_kes, 0),
    };
  });

export const getAdminTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [payouts, transactions, profiles] = await Promise.all([
      supabaseAdmin
        .from("payouts")
        .select("id,user_id,method,amount,currency,status,reference,created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseAdmin
        .from("wallet_transactions")
        .select("id,user_id,kind,amount,currency,note,reference_id,created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      fetchAllPages(
        async (from, to) =>
          await supabaseAdmin.from("profiles").select("id, username").range(from, to),
      ),
    ]);
    if (payouts.error) throw new Error(payouts.error.message);
    if (transactions.error) throw new Error(transactions.error.message);
    const names = new Map(
      profiles.map((profile) => [profile.id, profile.username || profile.id.slice(0, 8)]),
    );
    const events = [
      ...(payouts.data ?? []).map((payout) => ({
        id: `payout-${payout.id}`,
        userId: payout.user_id,
        account: names.get(payout.user_id) ?? payout.user_id.slice(0, 8),
        kind: payout.method === "mpesa" ? "M-Pesa payout" : "Legacy payout",
        amount: -Number(payout.amount),
        currency: payout.currency,
        status: payout.status,
        reference: payout.reference,
        createdAt: payout.created_at,
        payoutId: payout.id,
      })),
      ...(transactions.data ?? []).map((transaction) => ({
        id: `wallet-${transaction.id}`,
        userId: transaction.user_id,
        account: names.get(transaction.user_id) ?? transaction.user_id.slice(0, 8),
        kind: transaction.kind.replaceAll("_", " "),
        amount: transaction.amount === null ? null : Number(transaction.amount),
        currency: transaction.currency,
        status: "recorded",
        reference: transaction.note ?? transaction.reference_id,
        createdAt: transaction.created_at,
        payoutId: null,
      })),
    ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return events;
  });

export const getAdminPayouts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payouts = await fetchAllPages(
      async (from, to) =>
        await supabaseAdmin
          .from("payouts")
          .select(
            "id, user_id, method, destination, amount, currency, status, reference, created_at",
          )
          .order("created_at", { ascending: false })
          .range(from, to),
    );
    const profiles = await fetchAllPages(
      async (from, to) =>
        await supabaseAdmin.from("profiles").select("id, username").range(from, to),
    );
    const names = new Map(
      profiles.map((profile) => [profile.id, profile.username || profile.id.slice(0, 8)]),
    );
    return payouts.map((payout) => ({
      ...payout,
      account: names.get(payout.user_id) ?? payout.user_id.slice(0, 8),
      amount: Number(payout.amount),
    }));
  });

export const processAdminPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => payoutActionSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: payout, error: payoutError } = await supabaseAdmin
      .from("payouts")
      .select("status")
      .eq("id", data.id)
      .maybeSingle();
    if (payoutError) throw new Error(payoutError.message);
    if (!payout || payout.status !== "pending")
      throw new Error("Only pending payouts can be processed");

    const { error } = await context.supabase.rpc("process_payout", {
      _id: data.id,
      _status: data.status,
      _reference: data.reference,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getAdminSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("platform_settings")
      .select("setting_key, maintenance_mode, announcement, support_email, updated_at")
      .eq("setting_key", "global")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (
      data ?? {
        setting_key: "global",
        maintenance_mode: false,
        announcement: null,
        support_email: null,
        updated_at: null,
      }
    );
  });

export const saveAdminSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => platformSettingsSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("platform_settings").upsert(
      {
        setting_key: "global",
        maintenance_mode: data.maintenance_mode,
        announcement: data.announcement || null,
        support_email: data.support_email || null,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "setting_key" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setUserAgentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => agentStatusSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("agent_profiles").upsert(
      {
        user_id: data.user_id,
        active: data.active,
        assigned_by: context.userId,
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMarketplaceAdminData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [tasks, claims] = await Promise.all([
      supabaseAdmin.from("tasks").select("*").order("created_at", { ascending: false }),
      supabaseAdmin
        .from("task_claims")
        .select("*")
        .order("submitted_at", { ascending: false, nullsFirst: false })
        .limit(500),
    ]);
    if (tasks.error) throw new Error(tasks.error.message);
    if (claims.error) throw new Error(claims.error.message);
    const userIds = [...new Set((claims.data ?? []).map((claim) => claim.user_id))];
    const users = userIds.length
      ? await supabaseAdmin.from("profiles").select("id, username").in("id", userIds)
      : { data: [], error: null };
    if (users.error) throw new Error(users.error.message);
    const usernames = new Map((users.data ?? []).map((user) => [user.id, user.username]));
    return {
      tasks: tasks.data ?? [],
      claims: (claims.data ?? []).map((claim) => ({
        ...claim,
        username: usernames.get(claim.user_id) ?? claim.user_id.slice(0, 8),
      })),
    };
  });

export const createMarketplaceTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => marketplaceTaskSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: task, error } = await supabaseAdmin
      .from("tasks")
      .insert({
        created_by: context.userId,
        title: data.title,
        task_type: data.task_type,
        category: data.category,
        description: data.description,
        reward_kes: data.reward_kes,
        slots: data.slots,
      })
      .select("id")
      .single();
    if (error || !task) throw new Error(error?.message ?? "Could not create task");
    const { error: instructionsError } = await supabaseAdmin
      .from("task_private_instructions")
      .insert({
        task_id: task.id,
        instructions: data.instructions,
        proof_prompt: data.proof_prompt,
      });
    if (instructionsError) {
      await supabaseAdmin.from("tasks").delete().eq("id", task.id);
      throw new Error(instructionsError.message);
    }
    return { id: task.id };
  });

export const updateMarketplaceTaskStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => marketplaceTaskStatusSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("tasks")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reviewMarketplaceTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => taskReviewSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.rpc("review_task_submission", {
      _claim_id: data.claim_id,
      _decision: data.decision,
      _admin_note: data.admin_note || null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
