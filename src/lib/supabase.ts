import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { Session } from "./account.ts";

const url = import.meta.env.VITE_SUPABASE_URL ?? "";
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

export const supabaseEnabled = url.length > 0 && anonKey.length > 0;

export const supabase: SupabaseClient | null = supabaseEnabled ? createClient(url, anonKey) : null;

export function sessionFromUser(user: User): Session {
  const meta = user.user_metadata as { full_name?: string; name?: string; avatar_url?: string; picture?: string };
  return {
    sub: user.id,
    name: meta.full_name || meta.name || user.email || "Cuenta",
    email: user.email ?? "",
    picture: meta.avatar_url || meta.picture || "",
  };
}

export function redirectToApp(): string {
  return new URL(import.meta.env.BASE_URL, window.location.origin).href;
}
