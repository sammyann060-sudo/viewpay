import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandLogo } from "@/components/app/Brand";
import { supabase } from "@/integrations/supabase/client";
import { signInWithUsername } from "@/lib/auth.functions";
import {
  COUNTRY_OPTIONS,
  errMsg,
  getOrCreateDeviceId,
  normalizePhone,
  phoneToEmail,
  useSession,
} from "@/lib/viewpay";

type Search = { mode?: "login" | "signup"; ref?: string };

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    ...(s["mode"] === "login" ? { mode: "login" as const } : {}),
    ...(typeof s["ref"] === "string" ? { ref: s["ref"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Sign in or join — Gig Nova" },
      {
        name: "description",
        content: "Create a worldwide Gig Nova account or sign in to your earning wallet.",
      },
      { property: "og:title", content: "Sign in or join — Gig Nova" },
      {
        property: "og:description",
        content: "Create a worldwide Gig Nova account or sign in to your earning wallet.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const usernameSignIn = useServerFn(signInWithUsername);
  const { session } = useSession();
  const [mode, setMode] = useState<"login" | "signup">(search.mode ?? "signup");
  const [identifier, setIdentifier] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [ref, setRef] = useState(search.ref ?? "");
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session) void navigate({ to: "/tasks" });
  }, [session, navigate]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setConfirmationEmail("");
    try {
      if (mode === "signup") {
        const normalizedUsername = username.trim().toLowerCase();
        const normalizedEmail = email.trim().toLowerCase();
        if (!/^[a-z0-9_]{3,24}$/.test(normalizedUsername)) {
          throw new Error("Choose a username with 3–24 letters, numbers, or underscores.");
        }
        if (!country) throw new Error("Choose your country to set the right payout options.");
        if (password.length < 8) throw new Error("Your password must be at least 8 characters.");

        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth`,
            data: {
              username: normalizedUsername,
              country,
              ref: ref.trim().toUpperCase(),
              device_id: getOrCreateDeviceId(),
            },
          },
        });
        if (error) {
          if (error.message.toLowerCase().includes("duplicate key")) {
            throw new Error("That username is already taken. Try another one.");
          }
          if (error.message.toLowerCase().includes("weak")) {
            throw new Error("That password is too common. Try a stronger one.");
          }
          throw error;
        }
        if (data.session) {
          await navigate({ to: "/tasks" });
        } else {
          setConfirmationEmail(normalizedEmail);
        }
        return;
      }

      const value = identifier.trim();
      if (!value) throw new Error("Enter your username or email.");
      if (value.includes("@")) {
        const { error } = await supabase.auth.signInWithPassword({
          email: value.toLowerCase(),
          password,
        });
        if (error) throw new Error("Wrong username, email, or password.");
      } else {
        const legacyPhone = normalizePhone(value);
        if (legacyPhone) {
          const { error } = await supabase.auth.signInWithPassword({
            email: phoneToEmail(legacyPhone),
            password,
          });
          if (error) throw new Error("Wrong username, email, or password.");
        } else if (/^[a-z0-9_]{3,24}$/i.test(value)) {
          const result = await usernameSignIn({
            data: { username: value.toLowerCase(), password },
          });
          const { error } = await supabase.auth.setSession({
            access_token: result.accessToken,
            refresh_token: result.refreshToken,
          });
          if (error) throw error;
        } else {
          throw new Error("Enter a valid username or email.");
        }
      }
    } catch (error) {
      toast.error(errMsg(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <BrandLogo className="mb-8 h-11 w-auto self-start" />
      <h1 className="text-3xl font-extrabold tracking-tight">
        {mode === "signup" ? "Create your account" : "Welcome back"}
      </h1>
      <p className="mt-2 text-muted-foreground">
        {mode === "signup"
          ? "Join from anywhere. Your country sets the payout methods available to you."
          : "Sign in with your username or email and password."}
      </p>

      {confirmationEmail && (
        <div role="status" className="mt-6 border-l-2 border-primary bg-secondary px-4 py-3">
          <p className="font-semibold">Check your email to confirm your account.</p>
          <p className="mt-1 break-all text-sm text-muted-foreground">
            We sent a confirmation link to {confirmationEmail}.
          </p>
        </div>
      )}

      <form onSubmit={submit} className="mt-7 space-y-4">
        {mode === "signup" ? (
          <>
            <label className="block">
              <span className="text-sm font-medium">Username</span>
              <Input
                autoComplete="username"
                minLength={3}
                maxLength={24}
                required
                placeholder="e.g. annsammy"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="mt-1.5 h-12 text-base"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Email</span>
              <Input
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1.5 h-12 text-base"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Country</span>
              <select
                required
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                className="mt-1.5 h-12 w-full border border-input bg-background px-3 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Choose your country</option>
                {COUNTRY_OPTIONS.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <label className="block">
            <span className="text-sm font-medium">Username or email</span>
            <Input
              autoComplete="username"
              required
              placeholder="Username or you@example.com"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              className="mt-1.5 h-12 text-base"
            />
          </label>
        )}

        <label className="block">
          <span className="text-sm font-medium">Password</span>
          <span className="relative mt-1.5 block">
            <Input
              type={showPassword ? "text" : "password"}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              minLength={8}
              maxLength={128}
              placeholder="At least 8 characters"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-12 pr-12 text-base"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={showPassword ? "Hide password" : "Show password"}
              title={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((visible) => !visible)}
              className="absolute right-1 top-1 h-10 w-10"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </span>
        </label>

        {mode === "signup" && (
          <label className="block">
            <span className="text-sm font-medium">
              Invite code <span className="text-muted-foreground">(optional)</span>
            </span>
            <Input
              placeholder="e.g. 7F3K2A"
              value={ref}
              onChange={(event) => setRef(event.target.value)}
              className="mt-1.5 h-12 font-mono uppercase"
            />
          </label>
        )}

        <Button type="submit" disabled={busy} className="h-12 w-full text-base font-bold">
          {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
        </Button>
      </form>

      <Button
        type="button"
        variant="ghost"
        onClick={() => {
          setConfirmationEmail("");
          setMode((current) => (current === "signup" ? "login" : "signup"));
        }}
        className="mt-4 self-start px-0 text-sm text-muted-foreground hover:text-foreground"
      >
        {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
      </Button>
    </main>
  );
}
