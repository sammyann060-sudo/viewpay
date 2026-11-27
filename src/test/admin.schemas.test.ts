import { describe, expect, it } from "vitest";
import {
  agentCommissionStatusSchema,
  agentSchema,
  hasAdminRole,
  marketplaceTaskSchema,
  payoutActionSchema,
} from "@/lib/admin.schemas";

describe("admin workspace rules", () => {
  it("allows an admin role but not a regular user role", () => {
    expect(hasAdminRole(["admin"])).toBe(true);
    expect(hasAdminRole(["user"])).toBe(false);
  });

  it("keeps each agent's commission unit freely configurable", () => {
    const agent = agentSchema.parse({
      name: "Example Agent",
      email: "",
      phone: "",
      country: "us",
      commission_unit: "Verified referrals",
      commission_rate: "2.5",
      currency: "USD",
    });
    expect(agent.commission_unit).toBe("Verified referrals");
    expect(agent.country).toBe("US");
    expect(() =>
      agentSchema.parse({
        name: "Example Agent",
        email: "",
        phone: "",
        country: "US",
        commission_unit: "",
        commission_rate: "2.5",
        currency: "USD",
      }),
    ).toThrow();
  });

  it("rejects tasks requesting mass account creation or credentials", () => {
    const unsafeTask = {
      title: "Create Gmail accounts",
      category: "Online work",
      description: "Create multiple Gmail accounts for the requester.",
      instructions: "Use the password supplied in the task and submit the new accounts.",
      proof_prompt: "Send the account email and password.",
      reward_kes: 10,
      slots: 20,
    };
    expect(marketplaceTaskSchema.safeParse(unsafeTask).success).toBe(false);
  });

  it("accepts an ordinary research task and caps its fields", () => {
    const task = marketplaceTaskSchema.parse({
      title: "Review a local product catalogue",
      category: "Research",
      description: "Check these public product descriptions for missing details.",
      instructions: "Open each public product page and report any missing size or color details.",
      proof_prompt: "Link to your completed checklist.",
      reward_kes: "10",
      slots: "20",
    });
    expect(task.reward_kes * task.slots).toBe(200);
  });

  it("does not allow a paid commission to be reopened", () => {
    expect(
      agentCommissionStatusSchema.parse({
        id: "db209318-f03a-4c3a-8614-2e29e8303880",
        status: "paid",
        reference: "TX-1",
      }).status,
    ).toBe("paid");
    expect(() =>
      agentCommissionStatusSchema.parse({
        id: "db209318-f03a-4c3a-8614-2e29e8303880",
        status: "pending",
        reference: "",
      }),
    ).toThrow();
  });

  it("requires a transfer reference before a payout can be marked paid", () => {
    const id = "db209318-f03a-4c3a-8614-2e29e8303880";
    expect(payoutActionSchema.safeParse({ id, status: "paid", reference: "" }).success).toBe(false);
    expect(payoutActionSchema.parse({ id, status: "paid", reference: "MPESA-123" }).status).toBe(
      "paid",
    );
    expect(payoutActionSchema.parse({ id, status: "rejected", reference: "" }).status).toBe(
      "rejected",
    );
  });
});
