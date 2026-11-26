import { describe, expect, it } from "vitest";
import {
  agentCommissionStatusSchema,
  agentSchema,
  hasAdminRole,
  payoutActionSchema,
} from "@/lib/admin.schemas";
import { summarizeAdminFinances } from "@/lib/admin.metrics";

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

  it("uses the configured KSh 2 estimate per completed ad view", () => {
    expect(
      summarizeAdminFinances({ completedViews: 2, pointsAwarded: 0, pointsOutstanding: 0 })
        .advertiserRevenueEstimateKes,
    ).toBe(4);
  });

  it("values 500 outstanding points at KSh 100", () => {
    expect(
      summarizeAdminFinances({ completedViews: 0, pointsAwarded: 0, pointsOutstanding: 500 })
        .walletLiabilityEstimateKes,
    ).toBe(100);
  });

  it("values 30 rewarded points at KSh 6", () => {
    expect(
      summarizeAdminFinances({ completedViews: 0, pointsAwarded: 30, pointsOutstanding: 0 })
        .rewardsEstimateKes,
    ).toBe(6);
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
