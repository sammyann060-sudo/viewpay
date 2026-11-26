import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export const KES_PER_POINT = 0.2;
export const KES_PER_USDT = 130;
export const MPESA_MIN_POINTS = 250;
export const USDT_MIN_POINTS = 650;
export const DAILY_LIMIT = 20;
export const REFERRAL_BONUS = 50;
export const MAX_ACCOUNTS_PER_DEVICE = 2;

export type PayoutMethod = "mpesa" | "usdt";

export function isKenyanCountry(country: string | null | undefined): boolean {
  return country?.toUpperCase() === "KE";
}

export function getAvailablePayoutMethods(country: string | null | undefined): PayoutMethod[] {
  return isKenyanCountry(country) ? ["mpesa", "usdt"] : ["usdt"];
}

export function canCreateAccountOnDevice(existingAccounts: number): boolean {
  return existingAccounts < MAX_ACCOUNTS_PER_DEVICE;
}

export function summarizeWalletActivity(
  transactions: ReadonlyArray<{ kind: string; points_delta: number }>,
  payouts: ReadonlyArray<{ status: string; amount: number; currency: string }>,
) {
  const earnedPoints = transactions.reduce((total, transaction) => {
    if (transaction.kind !== "ad_reward" && transaction.kind !== "referral_reward") return total;
    return total + Math.max(0, transaction.points_delta);
  }, 0);
  const withdrawnByCurrency: Record<string, number> = {};
  for (const payout of payouts) {
    if (payout.status !== "paid") continue;
    withdrawnByCurrency[payout.currency] =
      (withdrawnByCurrency[payout.currency] ?? 0) + Number(payout.amount);
  }
  return { earnedPoints, withdrawnByCurrency };
}

export function formatPointsValue(points: number, country: string | null | undefined): string {
  if (isKenyanCountry(country)) return formatKes(points);
  return `${((points * KES_PER_POINT) / KES_PER_USDT).toFixed(2)} USDT`;
}

export const COUNTRY_OPTIONS = (() => {
  const labels = new Intl.DisplayNames(["en"], { type: "region" });
  const options: Array<{ code: string; name: string }> = [];
  for (let first = 65; first <= 90; first += 1) {
    for (let second = 65; second <= 90; second += 1) {
      const code = String.fromCharCode(first, second);
      const name = labels.of(code);
      if (name && name !== code && name !== "Unknown Region") options.push({ code, name });
    }
  }
  return options.sort((a, b) => a.name.localeCompare(b.name));
})();

export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") throw new Error("Browser storage is unavailable");
  const key = "viewpay:device-id";
  const saved = window.localStorage.getItem(key);
  if (
    saved &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(saved)
  ) {
    return saved;
  }
  const bytes = window.crypto.getRandomValues(new Uint8Array(16));
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20)}`;
  window.localStorage.setItem(key, id);
  return id;
}

export function normalizePhone(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  let n = d;
  if (n.startsWith("0")) n = "254" + n.slice(1);
  else if (n.length === 9) n = "254" + n;
  return /^254(7|1)\d{8}$/.test(n) ? n : null;
}
export const phoneToEmail = (p: string) => `${p}@phone.viewpay.app`;
export const formatKes = (pts: number) =>
  `KSh ${(pts * KES_PER_POINT).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const formatPhone = (p: string) =>
  `+${p.slice(0, 3)} ${p.slice(3, 6)} ${p.slice(6, 9)} ${p.slice(9)}`;

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return { session, ready };
}

export function errMsg(e: unknown) {
  if (e && typeof e === "object" && "message" in e)
    return String((e as { message: string }).message);
  return "Something went wrong";
}
