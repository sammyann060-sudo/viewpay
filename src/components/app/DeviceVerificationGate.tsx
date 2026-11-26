import { useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { errMsg } from "@/lib/viewpay";

type VerificationMethod = "email" | "phone";

export function DeviceVerificationGate({
  deviceId,
  profile,
  session,
  onVerified,
}: {
  deviceId: string;
  profile: Tables<"profiles"> | undefined;
  session: Session;
  onVerified: () => void;
}) {
  const currentEmail = session.user.email?.endsWith("@phone.viewpay.app")
    ? null
    : session.user.email;
  const emailVerified = Boolean(currentEmail && session.user.email_confirmed_at);
  const verifiedPhone = profile?.phone_verified_at ? profile.phone_number : null;
  const [newEmail, setNewEmail] = useState("");
  const [code, setCode] = useState("");
  const [method, setMethod] = useState<VerificationMethod | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function sendCode() {
    setBusy(true);
    setMessage("");
    try {
      if (emailVerified && currentEmail) {
        const { error } = await supabase.auth.signInWithOtp({
          email: currentEmail,
          options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/auth` },
        });
        if (error) throw error;
        setMethod("email");
        setMessage(`A one-time link or code was sent to ${currentEmail}.`);
      } else if (verifiedPhone) {
        const { error } = await supabase.auth.signInWithOtp({
          phone: verifiedPhone,
          options: { shouldCreateUser: false },
        });
        if (error) throw error;
        setMethod("phone");
        setMessage(`A one-time code was sent to ${verifiedPhone}.`);
      } else {
        setMessage("Add a contact email and verify it before unlocking this browser.");
      }
    } catch (error) {
      setMessage(errMsg(error));
    } finally {
      setBusy(false);
    }
  }

  async function requestEmailVerification(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.updateUser(
        { email: newEmail.trim().toLowerCase() },
        { emailRedirectTo: `${window.location.origin}/auth` },
      );
      if (error) throw error;
      setMessage("Check the new email address and confirm it, then return here.");
    } catch (error) {
      setMessage(errMsg(error));
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault();
    if (!method || !code.trim()) return;
    setBusy(true);
    setMessage("");
    try {
      if (method === "email" && currentEmail) {
        const { error } = await supabase.auth.verifyOtp({
          email: currentEmail,
          token: code.trim(),
          type: "email",
        });
        if (error) throw error;
      } else if (method === "phone" && verifiedPhone) {
        const { error } = await supabase.auth.verifyOtp({
          phone: verifiedPhone,
          token: code.trim(),
          type: "sms",
        });
        if (error) throw error;
      }
      const { error: deviceError } = await supabase.rpc("complete_device_verification", {
        _device_id: deviceId,
      });
      if (deviceError) throw deviceError;
      onVerified();
    } catch (error) {
      setMessage(errMsg(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <p className="text-sm font-semibold text-primary">VIEWPAY SECURITY</p>
      <h1 className="mt-3 text-3xl font-extrabold">Verify this browser</h1>
      <p className="mt-2 text-muted-foreground">
        A new browser needs a verified contact before earning or cashing out.
      </p>

      {emailVerified || verifiedPhone ? (
        <div className="mt-8 space-y-4">
          <Button className="h-12 w-full font-bold" disabled={busy} onClick={() => void sendCode()}>
            {busy ? "Sending…" : method ? "Send another code" : "Send verification code"}
          </Button>
          {method && (
            <form onSubmit={verifyCode} className="space-y-3">
              <label className="block">
                <span className="text-sm font-medium">One-time code</span>
                <Input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  className="mt-1.5 h-12"
                />
              </label>
              <Button
                type="submit"
                className="h-12 w-full font-bold"
                disabled={busy || !code.trim()}
              >
                {busy ? "Verifying…" : "Verify browser"}
              </Button>
              {method === "email" && (
                <p className="text-sm text-muted-foreground">
                  If the email contains a link, open it on this browser.
                </p>
              )}
            </form>
          )}
        </div>
      ) : (
        <form onSubmit={requestEmailVerification} className="mt-8 space-y-3">
          <label className="block">
            <span className="text-sm font-medium">Email address</span>
            <Input
              type="email"
              required
              autoComplete="email"
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              className="mt-1.5 h-12"
            />
          </label>
          <Button
            type="submit"
            className="h-12 w-full font-bold"
            disabled={busy || !newEmail.trim()}
          >
            {busy ? "Sending…" : "Verify email"}
          </Button>
        </form>
      )}

      {message && (
        <p role="status" className="mt-4 text-sm text-muted-foreground">
          {message}
        </p>
      )}
      <p className="mt-8 text-xs text-muted-foreground">
        Browser IDs can be reset. This site cannot read a device’s MAC address.
      </p>
    </main>
  );
}
