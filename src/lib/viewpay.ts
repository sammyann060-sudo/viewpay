import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export const MPESA_MIN_KES = 50;
export const MAX_ACCOUNTS_PER_DEVICE = 2;

export function canCreateAccountOnDevice(existingAccounts: number): boolean {
  return existingAccounts < MAX_ACCOUNTS_PER_DEVICE;
}

export function summarizeWalletActivity(
  transactions: ReadonlyArray<{ kind: string; amount: number | null }>,
  payouts: ReadonlyArray<{ status: string; amount: number; currency: string }>,
) {
  const earnedKes = transactions.reduce((total, transaction) => {
    if (!["task_reward", "agent_commission", "referral_reward"].includes(transaction.kind))
      return total;
    return total + Math.max(0, Number(transaction.amount ?? 0));
  }, 0);
  const withdrawnKes = payouts.reduce(
    (total, payout) =>
      total + (payout.status === "paid" && payout.currency === "KES" ? Number(payout.amount) : 0),
    0,
  );
  return { earnedKes, withdrawnKes };
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
  )
    return saved;
  const bytes = window.crypto.getRandomValues(new Uint8Array(16));
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20)}`;
  window.localStorage.setItem(key, id);
  return id;
}

export function normalizePhone(raw: string): string | null {
  let number = raw.replace(/\D/g, "");
  if (number.startsWith("0")) number = `254${number.slice(1)}`;
  else if (number.length === 9) number = `254${number}`;
  return /^254(7|1)\d{8}$/.test(number) ? number : null;
}
export const phoneToEmail = (phone: string) => `${phone}@phone.viewpay.app`;
export const formatKes = (amount: number) =>
  `KSh ${Number(amount).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const formatPhone = (phone: string) =>
  `+${phone.slice(0, 3)} ${phone.slice(3, 6)} ${phone.slice(6, 9)} ${phone.slice(9)}`;

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, current) => {
      setSession(current);
      setReady(true);
    });
    supabase.auth.getSession().then(({ data: current }) => {
      setSession(current.session);
      setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return { session, ready };
}

export function errMsg(error: unknown) {
  if (error && typeof error === "object" && "message" in error)
    return String((error as { message: string }).message);
  return "Something went wrong";
}
