import type { Account } from "./account.ts";
import { loadOrMigrate } from "./account.ts";
import type { Collection } from "../types.ts";
import { supabase } from "./supabase.ts";

function asCollection(value: unknown): Collection {
  if (!value || typeof value !== "object") return { parts: [], built: [], items: [] };
  const collection = value as Collection;
  const strings = (items: unknown) => (Array.isArray(items) ? items.filter((item) => typeof item === "string") : []);
  return {
    parts: strings(collection.parts),
    built: strings(collection.built),
    items: strings(collection.items),
  };
}

function asAccount(row: { warframe_account?: unknown; mastery?: unknown; collection?: unknown }): Account {
  return {
    warframeAccount: typeof row.warframe_account === "string" ? row.warframe_account : "",
    mastery: typeof row.mastery === "number" ? row.mastery : null,
    collection: asCollection(row.collection),
  };
}

export async function loadOrCreateRemote(userId: string): Promise<Account> {
  if (!supabase) throw new Error("supabase");
  const existing = await supabase
    .from("profiles")
    .select("warframe_account, mastery, collection")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return asAccount(existing.data);

  const local = loadOrMigrate(userId);
  const created = await supabase.from("profiles").insert({
    user_id: userId,
    warframe_account: local.warframeAccount,
    mastery: local.mastery,
    collection: local.collection,
  });
  if (created.error?.code === "23505") {
    const again = await supabase
      .from("profiles")
      .select("warframe_account, mastery, collection")
      .eq("user_id", userId)
      .single();
    if (again.error) throw again.error;
    return asAccount(again.data);
  }
  if (created.error) throw created.error;
  return local;
}

export async function saveRemoteAccount(userId: string, account: Account) {
  if (!supabase) return;
  const { error } = await supabase.from("profiles").upsert({
    user_id: userId,
    warframe_account: account.warframeAccount,
    mastery: account.mastery,
    collection: account.collection,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}
