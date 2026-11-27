import { z } from "zod";

export const marketplaceTaskSchema = z
  .object({
    title: z.string().trim().min(5).max(120),
    task_type: z.enum(["general", "ad", "account_subscription"]),
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
          "This task requests credentials, bulk third-party accounts or deceptive engagement, which Gig Nova does not allow.",
      });
    }
    if (task.task_type === "general" && task.slots !== 1) {
      context.addIssue({
        code: "custom",
        path: ["slots"],
        message: "A general gig can only be claimed by one worker.",
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

export const agentStatusSchema = z.object({ user_id: z.string().uuid(), active: z.boolean() });

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

export function hasAdminRole(roles: readonly string[]): boolean {
  return roles.includes("admin");
}
