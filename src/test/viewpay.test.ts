import { describe, expect, it } from "vitest";
import {
  canCreateAccountOnDevice,
  formatKes,
  MAX_ACCOUNTS_PER_DEVICE,
  MPESA_MIN_KES,
  normalizePhone,
  summarizeWalletActivity,
} from "@/lib/viewpay";

describe("KES wallet rules", () => {
  it("uses a KSh 50 M-Pesa minimum", () => expect(MPESA_MIN_KES).toBe(50));
  it("normalizes Kenyan numbers", () => {
    expect(normalizePhone("0712 345 678")).toBe("254712345678");
    expect(normalizePhone("+254 110 123456")).toBe("254110123456");
    expect(normalizePhone("12345")).toBeNull();
  });
  it("formats KES", () => expect(formatKes(250)).toBe("KSh 250.00"));
  it("allows no more than two accounts per browser installation", () => {
    expect(canCreateAccountOnDevice(0)).toBe(true);
    expect(canCreateAccountOnDevice(1)).toBe(true);
    expect(canCreateAccountOnDevice(MAX_ACCOUNTS_PER_DEVICE)).toBe(false);
  });
  it("calculates KES earnings and paid M-Pesa withdrawals", () => {
    const totals = summarizeWalletActivity(
      [
        { kind: "task_reward", amount: 10 },
        { kind: "agent_commission", amount: 5 },
        { kind: "payout", amount: -50 },
        { kind: "payout_refund", amount: 25 },
      ],
      [
        { status: "paid", amount: 50, currency: "KES" },
        { status: "rejected", amount: 25, currency: "KES" },
      ],
    );
    expect(totals.earnedKes).toBe(15);
    expect(totals.withdrawnKes).toBe(50);
  });
});
