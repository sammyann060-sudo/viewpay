import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

export const signInWithUsername = createServerFn({ method: "POST" })
  .validator((input) =>
    z
      .object({
        username: z
          .string()
          .trim()
          .toLowerCase()
          .regex(/^[a-z0-9_]{3,24}$/),
        password: z.string().min(8).max(128),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("username", data.username)
      .maybeSingle();

    if (profileError || !profile) throw new Error("Wrong username or password");

    const { data: userResult, error: userError } = await supabaseAdmin.auth.admin.getUserById(
      profile.id,
    );
    const email = userResult.user?.email;
    if (userError || !email) throw new Error("Wrong username or password");

    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) throw new Error("Sign-in is temporarily unavailable");

    const authClient = createClient<Database>(url, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const headers = new Headers(
            typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
          );
          if (init?.headers)
            new Headers(init.headers).forEach((value, header) => headers.set(header, value));
          if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
            headers.delete("Authorization");
          }
          headers.set("apikey", key);
          return fetch(input, { ...init, headers });
        },
      },
    });

    const { data: signInResult, error: signInError } = await authClient.auth.signInWithPassword({
      email,
      password: data.password,
    });
    if (signInError || !signInResult.session) throw new Error("Wrong username or password");

    return {
      accessToken: signInResult.session.access_token,
      refreshToken: signInResult.session.refresh_token,
    };
  });
