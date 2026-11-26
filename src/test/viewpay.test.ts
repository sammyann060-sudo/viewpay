import { describe, expect, it } from "vitest";
import {
  canCreateAccountOnDevice,
  DAILY_LIMIT,
  formatKes,
  getAvailablePayoutMethods,
  KES_PER_POINT,
  MAX_ACCOUNTS_PER_DEVICE,
  MPESA_MIN_POINTS,
  normalizePhone,
  summarizeWalletActivity,
  USDT_MIN_POINTS,
} from "@/lib/viewpay";

describe("viewpay rules", () => {
  it("500 points = KSh 100", () => expect(500 * KES_PER_POINT).toBe(100));
  it("M-Pesa minimum is KSh 50", () => expect(MPESA_MIN_POINTS * KES_PER_POINT).toBe(50));
  it("USDT minimum covers $1 at KSh 130", () =>
    expect(USDT_MIN_POINTS * KES_PER_POINT).toBeGreaterThanOrEqual(130));
  it("daily limit is 20 ads", () => expect(DAILY_LIMIT).toBe(20));
  it("normalizes Kenyan numbers", () => {
    expect(normalizePhone("0712 345 678")).toBe("254712345678");
    expect(normalizePhone("+254 110 123456")).toBe("254110123456");
    expect(normalizePhone("12345")).toBeNull();
  });
  it("formats KES", () => expect(formatKes(250)).toBe("KSh 50.00"));
  it("allows no more than two accounts per browser installation", () => {
    expect(canCreateAccountOnDevice(0)).toBe(true);
    expect(canCreateAccountOnDevice(1)).toBe(true);
    expect(canCreateAccountOnDevice(MAX_ACCOUNTS_PER_DEVICE)).toBe(false);
  });
  it("offers M-Pesa only to Kenyan accounts", () => {
    expect(getAvailablePayoutMethods("KE")).toContain("mpesa");
    expect(getAvailablePayoutMethods("US")).not.toContain("mpesa");
  });
  it("offers crypto payouts worldwide", () => {
    expect(getAvailablePayoutMethods("KE")).toContain("usdt");
    expect(getAvailablePayoutMethods("US")).toEqual(["usdt"]);
    expect(getAvailablePayoutMethods("JP")).toEqual(["usdt"]);
  });
  it("calculates lifetime totals from recorded wallet and payout activity", () => {
    const totals = summarizeWalletActivity(
      [
        { kind: "ad_reward", points_delta: 20 },
        { kind: "referral_reward", points_delta: 50 },
        { kind: "payout", points_delta: -250 },
        { kind: "payout_refund", points_delta: 250 },
      ],
      [
        { status: "paid", amount: 50, currency: "KES" },
        { status: "rejected", amount: 25, currency: "KES" },
        { status: "paid", amount: 1, currency: "USDT" },
      ],
    );
    expect(totals.earnedPoints).toBe(70);
    expect(totals.withdrawnByCurrency).toEqual({ KES: 50, USDT: 1 });
  });
});
