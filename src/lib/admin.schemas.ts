import { z } from "zod";

export const marketplaceTaskSchema = z
  .object({
    title: z.string().trim().min(5).max(120),
    category: z.string().trim().min(2).max(48),
    description: z.string().trim().min(10).max(600),
    instructions: z.string().trim().min(10).max(10_000),
    proof_prompt: z.string().trim().min(5).max(500),
    reward_kes: z.coerce.number().int().min(1).max(100_000),
    slots: z.coerce.number().int().min(1).max(10_000),
  })
  .superRefine((task, context) => {
    const content = `${task.title}\n${task.description}\n${task.instructions}\n${task.proof_prompt}`;
    const prohibited = [
      /\b(?:create|register|open|make|set up)\s+(?:multiple|bulk|\d+)?\s*(?:new\s+)?(?:gmail|google|email)\s+accounts?\b/i,
      /\b(?:gmail|google|email)\s+accounts?\b.{0,60}\b(?:create|register|open|make|set up)\b/i,
      /\b(?:password|passcode|login credential|verification code|one[- ]time code)\b/i,
      /\b(?:fake review|fake rating|fake engagement|buy followers|click farm)\b/i,
    ];
    if (prohibited.some((pattern) => pattern.test(content))) {
      context.addIssue({
        code: "custom",
        path: ["instructions"],
        message:
          "This task requests credentials, bulk third-party accounts or deceptive engagement, which ViewPay does not allow.",
      });
    }
  });

export const marketplaceTaskStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["published", "paused", "closed"]),
});

export const taskReviewSchema = z.object({
  claim_id: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  admin_note: z.string().trim().max(2000),
});

export const agentSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().or(z.literal("")),
  phone: z.string().trim().max(40),
  country: z
    .string()
    .trim()
    .length(2)
    .transform((value) => value.toUpperCase()),
  commission_unit: z.string().trim().min(1).max(80),
  commission_rate: z.coerce.number().finite().positive().max(1_000_000),
  currency: z.enum(["KES", "USD", "USDT"]),
});

export const updateAgentSchema = z
  .object({
    id: z.string().uuid(),
    active: z.boolean().optional(),
    commission_unit: z.string().trim().min(1).max(80).optional(),
    commission_rate: z.coerce.number().finite().positive().max(1_000_000).optional(),
  })
  .refine(
    (value) =>
      value.active !== undefined ||
      value.commission_unit !== undefined ||
      value.commission_rate !== undefined,
    "At least one agent field must change",
  );

export const agentCommissionSchema = z
  .object({
    agent_id: z.string().uuid(),
    period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    units: z.coerce.number().int().positive().max(1_000_000),
    note: z.string().trim().max(500),
  })
  .refine((value) => value.period_end >= value.period_start, {
    path: ["period_end"],
    message: "End date must be on or after the start date",
  });

export const platformSettingsSchema = z.object({
  maintenance_mode: z.boolean(),
  announcement: z.string().trim().max(500),
  support_email: z
    .string()
    .trim()
    .max(254)
    .refine(
      (value) => value === "" || z.string().email().safeParse(value).success,
      "Enter a valid support email",
    ),
});

export const payoutActionSchema = z
  .object({
    id: z.string().uuid(),
    status: z.enum(["paid", "rejected"]),
    reference: z.string().trim().max(120),
  })
  .refine((value) => value.status !== "paid" || value.reference.length > 0, {
    path: ["reference"],
    message: "A payment reference is required to mark a payout paid",
  });

export const agentCommissionStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.literal("paid"),
  reference: z.string().trim().max(120),
});

export function hasAdminRole(roles: readonly string[]): boolean {
  return roles.includes("admin");
}
