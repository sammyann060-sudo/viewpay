import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getAgentDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: agent, error: agentError } = await supabaseAdmin
      .from("agent_profiles")
      .select("active")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (agentError) throw new Error(agentError.message);
    if (!agent?.active) throw new Error("Agent access is not active for this account.");
    const [
      { data: profile, error: profileError },
      { data: clients, error: clientsError },
      { data: commissions, error: commissionError },
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("referral_code").eq("id", context.userId).single(),
      supabaseAdmin
        .from("profiles")
        .select("id,username,created_at")
        .eq("referred_by", context.userId)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("agent_client_commissions")
        .select("client_id,amount_kes,credited_at")
        .eq("agent_id", context.userId)
        .order("credited_at", { ascending: false }),
    ]);
    if (profileError) throw new Error(profileError.message);
    if (clientsError) throw new Error(clientsError.message);
    if (commissionError) throw new Error(commissionError.message);
    const byClient = new Map((commissions ?? []).map((row) => [row.client_id, row]));
    return {
      referralCode: profile.referral_code,
      clients: (clients ?? []).map((client) => ({
        ...client,
        commission: byClient.get(client.id) ?? null,
      })),
      totalCommissionKes: (commissions ?? []).reduce((sum, row) => sum + row.amount_kes, 0),
      qualifiedClients: (commissions ?? []).length,
    };
  });
