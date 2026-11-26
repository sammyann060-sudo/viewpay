import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import {
  ChartNoAxesCombined,
  LogOut,
  PlayCircle,
  ShieldCheck,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeviceVerificationGate } from "@/components/app/DeviceVerificationGate";
import { supabase } from "@/integrations/supabase/client";
import { formatPointsValue, getOrCreateDeviceId, useSession } from "@/lib/viewpay";

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) throw new Error("A signed-in account is required");
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
      if (error) throw error;
      return data;
    },
  });
}

export function useIsAdmin(userId: string | undefined) {
  return useQuery({
    queryKey: ["admin", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin");
      return (data?.length ?? 0) > 0;
    },
  });
}

const nav = [
  { to: "/earn", label: "Earn", icon: PlayCircle },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/history", label: "History", icon: ChartNoAxesCombined },
  { to: "/invite", label: "Invite", icon: Users },
] as const;

export function Shell({ children }: { children: (userId: string) => ReactNode }) {
  const { session, ready } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userId = session?.user.id;
  const profile = useProfile(userId);
  const isAdmin = useIsAdmin(userId);
  const isAdminPath = location.pathname.startsWith("/admin");
  const platformSettings = useQuery({
    queryKey: ["platform-settings", "global"],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("maintenance_mode, announcement, support_email")
        .eq("setting_key", "global")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const [deviceState, setDeviceState] = useState<"checking" | "allowed" | "verify" | "error">(
    "checking",
  );
  const [deviceId, setDeviceId] = useState("");
  const [deviceError, setDeviceError] = useState("");

  useEffect(() => {
    if (ready && !session) navigate({ to: "/auth" });
  }, [ready, session, navigate]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    setDeviceState("checking");
    void (async () => {
      try {
        const id = getOrCreateDeviceId();
        setDeviceId(id);
        const { data, error } = await supabase.rpc("register_device", { _device_id: id });
        if (error) throw error;
        const requiresVerification = Boolean(
          data &&
          typeof data === "object" &&
          !Array.isArray(data) &&
          data["requires_verification"] === true,
        );
        if (requiresVerification) {
          const { error: verificationError } = await supabase.rpc("complete_device_verification", {
            _device_id: id,
          });
          if (verificationError) {
            if (active) setDeviceState("verify");
            return;
          }
        }
        if (active) setDeviceState("allowed");
      } catch (error) {
        if (active) {
          setDeviceError(
            error instanceof Error ? error.message : "This browser could not be checked.",
          );
          setDeviceState("error");
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (!ready || !userId) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (deviceState === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Checking this browser…
      </div>
    );
  }

  if (deviceState === "error") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5">
        <h1 className="text-2xl font-extrabold">Browser check failed</h1>
        <p className="mt-2 text-muted-foreground">{deviceError}</p>
        <Button className="mt-6 h-12" onClick={() => void signOut()}>
          Sign out
        </Button>
      </main>
    );
  }

  if (deviceState === "verify" && session && deviceId) {
    return (
      <DeviceVerificationGate
        deviceId={deviceId}
        profile={profile.data}
        session={session}
        onVerified={() => {
          setDeviceState("allowed");
          void queryClient.invalidateQueries({ queryKey: ["profile", userId] });
        }}
      />
    );
  }

  return (
    <div
      className={`mx-auto flex min-h-screen flex-col ${isAdminPath ? "max-w-7xl" : "max-w-lg pb-24"}`}
    >
      <header
        className={`flex items-center justify-between pt-6 pb-4 ${isAdminPath ? "px-4 sm:px-6 lg:px-8" : "px-5"}`}
      >
        <Link to="/earn" className="text-xl font-extrabold tracking-tight">
          view<span className="text-primary">pay</span>
        </Link>
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-secondary px-3 py-1.5 text-sm font-semibold tabular">
            {profile.data
              ? `${profile.data.points} pts · ${formatPointsValue(profile.data.points, profile.data.country)}`
              : "—"}
          </div>
          {isAdmin.data && (
            <Button asChild aria-label="Admin" variant="ghost" size="icon">
              <Link to="/admin">
                <ShieldCheck className="h-5 w-5" />
              </Link>
            </Button>
          )}
          <Button asChild aria-label="Profile" variant="ghost" size="icon">
            <Link to="/profile">
              <UserRound className="h-5 w-5" />
            </Link>
          </Button>
          <Button aria-label="Sign out" onClick={() => void signOut()} variant="ghost" size="icon">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>
      <main className={`flex-1 ${isAdminPath ? "px-4 sm:px-6 lg:px-8" : "px-5"}`}>
        {platformSettings.data?.announcement && (
          <div
            role="status"
            className="mb-5 border-l-2 border-primary bg-secondary px-4 py-3 text-sm"
          >
            {platformSettings.data.announcement}
          </div>
        )}
        {platformSettings.data?.maintenance_mode && !isAdmin.data ? (
          <section className="mx-auto max-w-2xl border-y border-accent py-10 text-center">
            <p className="text-sm font-semibold text-accent">MAINTENANCE</p>
            <h1 className="mt-2 text-2xl font-extrabold">ViewPay is temporarily unavailable</h1>
            <p className="mt-2 text-muted-foreground">
              Your account and balance are safe. Please check back soon.
              {platformSettings.data.support_email ? (
                <>
                  {" "}
                  For help, contact{" "}
                  <a
                    className="underline underline-offset-4"
                    href={`mailto:${platformSettings.data.support_email}`}
                  >
                    {platformSettings.data.support_email}
                  </a>
                  .
                </>
              ) : null}
            </p>
          </section>
        ) : (
          children(userId)
        )}
      </main>
      {!isAdminPath && (
        <nav className="fixed inset-x-0 bottom-0 border-t border-border bg-card/95 backdrop-blur">
          <div className="mx-auto grid max-w-lg grid-cols-4">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="flex flex-col items-center gap-1 py-3 text-xs text-muted-foreground"
                activeProps={{ className: "text-primary" }}
              >
                <n.icon className="h-5 w-5" />
                {n.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
