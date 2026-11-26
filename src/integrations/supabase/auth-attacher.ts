import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "./client";

// Registered as global function middleware so protected server functions receive
// the signed-in user's Supabase bearer token.
export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);
