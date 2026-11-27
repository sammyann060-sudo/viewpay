import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BadgeCheck, CircleAlert, Mail, Phone, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Shell, useProfile } from "@/components/app/Shell";
import { supabase } from "@/integrations/supabase/client";
import { COUNTRY_OPTIONS, errMsg, useSession } from "@/lib/viewpay";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — ViewPay" },
      {
        name: "description",
        content: "View your ViewPay account details and verification status.",
      },
      { property: "og:title", content: "Your profile — ViewPay" },
      {
        property: "og:description",
        content: "View your ViewPay account details and verification status.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <Shell>{(uid) => <ProfilePage userId={uid} />}</Shell>,
});

function ProfilePage({ userId }: { userId: string }) {
  const profile = useProfile(userId);
  const { session } = useSession();
  const [sending, setSending] = useState(false);
  const email = session?.user.email?.endsWith("@phone.viewpay.app")
    ? null
    : (session?.user.email ?? null);
  const emailVerified = Boolean(email && session?.user.email_confirmed_at);

  async function resendEmailVerification() {
    if (!email) return;
    setSending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth` },
    });
    setSending(false);
    if (error) {
      toast.error(errMsg(error));
      return;
    }
    toast.success("A new verification email has been sent.");
  }

  if (profile.isLoading) return <p className="text-muted-foreground">Loading profile…</p>;
  if (profile.error)
    return (
      <p role="alert" className="text-destructive">
        Couldn’t load your profile: {errMsg(profile.error)}
      </p>
    );
  if (!profile.data)
    return <p className="text-muted-foreground">Profile details are unavailable.</p>;

  const country =
    COUNTRY_OPTIONS.find((option) => option.code === profile.data.country)?.name ??
    profile.data.country;
  const phoneStatus = profile.data.phone_verified_at
    ? "Verified"
    : profile.data.phone_number
      ? "Not verified"
      : "Not added";

  return (
    <div className="space-y-7 pb-8">
      <header>
        <p className="text-sm font-semibold text-primary">ACCOUNT</p>
        <h1 className="mt-1 text-3xl font-extrabold">Your profile</h1>
        <p className="mt-2 text-muted-foreground">Your account details and contact verification.</p>
      </header>

      <section className="flex items-center gap-4 border-b border-border pb-6">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
          <UserRound className="h-7 w-7" />
        </div>
        <div className="min-w-0">
          <h2 className="break-words text-xl font-bold">
            {profile.data.username ? `@${profile.data.username}` : "ViewPay member"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Member since{" "}
            {new Date(profile.data.created_at).toLocaleDateString(undefined, {
              year: "numeric",
              month: "long",
            })}
          </p>
        </div>
      </section>

      <section aria-label="Contact verification" className="space-y-5">
        <h2 className="font-bold">Contact details</h2>
        <div className="flex items-start gap-3">
          <Mail className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground">Email address</p>
            <p className="mt-0.5 break-all font-medium">{email ?? "Not added"}</p>
            <p
              className={`mt-1 flex items-center gap-1.5 text-sm ${emailVerified ? "text-success" : "text-muted-foreground"}`}
            >
              {emailVerified ? (
                <BadgeCheck className="h-4 w-4" />
              ) : (
                <CircleAlert className="h-4 w-4" />
              )}
              {emailVerified
                ? "Verified"
                : email
                  ? "Not verified"
                  : "Not available on this account"}
            </p>
            {email && !emailVerified && (
              <Button
                type="button"
                variant="link"
                disabled={sending}
                onClick={() => void resendEmailVerification()}
                className="mt-1 h-auto p-0"
              >
                {sending ? "Sending…" : "Resend verification email"}
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Phone className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground">Phone number</p>
            <p className="mt-0.5 break-all font-medium">
              {profile.data.phone_number ?? "Not added"}
            </p>
            <p
              className={`mt-1 flex items-center gap-1.5 text-sm ${profile.data.phone_verified_at ? "text-success" : "text-muted-foreground"}`}
            >
              {profile.data.phone_verified_at ? (
                <BadgeCheck className="h-4 w-4" />
              ) : (
                <CircleAlert className="h-4 w-4" />
              )}
              {phoneStatus}
            </p>
          </div>
        </div>
        <p className="border-l-2 border-primary bg-secondary px-4 py-3 text-sm text-muted-foreground">
          Verified contact details are protected. A replacement email or phone number must be
          verified before it can be used.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-x-5 gap-y-5 border-t border-border pt-6">
        <div>
          <p className="text-sm text-muted-foreground">Country</p>
          <p className="mt-1 font-semibold">{country}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Available balance</p>
          <p className="mt-1 font-semibold tabular">
            KSh{" "}
            {Number(profile.data.balance_kes).toLocaleString("en-KE", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Referral code</p>
          <p className="mt-1 font-mono font-semibold">{profile.data.referral_code}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Browser security</p>
          <p className="mt-1 flex items-center gap-1.5 font-semibold">
            <ShieldCheck className="h-4 w-4 text-primary" />
            {profile.data.device_lock_required ? "Verification required" : "Protected"}
          </p>
        </div>
      </section>
    </div>
  );
}
