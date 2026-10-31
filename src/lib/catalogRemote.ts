import type { Catalog, CatalogItem, ItemKind } from "../types.ts";
import { supabase } from "./supabase.ts";

export type DashboardStats = {
  frames: number;
  frameTotal: number;
  weapons: number;
  weaponTotal: number;
  ready: number;
  partTotal: number;
  sourceVersion: string | null;
  generatedAt: string | null;
};

export type ItemSummary = {
  id: string;
  name: string;
  kind: ItemKind;
  vaulted: boolean;
  image: string | null;
  partCount: number;
  ownedCount: number;
  built: boolean;
  ownedItem: boolean;
};

const emptyStats = (): DashboardStats => ({
  frames: 0,
  frameTotal: 0,
  weapons: 0,
  weaponTotal: 0,
  ready: 0,
  partTotal: 0,
  sourceVersion: null,
  generatedAt: null,
});

function asStats(value: unknown): DashboardStats {
  if (!value || typeof value !== "object") return emptyStats();
  const stats = value as DashboardStats;
  return {
    frames: Number(stats.frames) || 0,
    frameTotal: Number(stats.frameTotal) || 0,
    weapons: Number(stats.weapons) || 0,
    weaponTotal: Number(stats.weaponTotal) || 0,
    ready: Number(stats.ready) || 0,
    partTotal: Number(stats.partTotal) || 0,
    sourceVersion: typeof stats.sourceVersion === "string" ? stats.sourceVersion : null,
    generatedAt: typeof stats.generatedAt === "string" ? stats.generatedAt : null,
  };
}

export async function fetchDashboard(): Promise<DashboardStats> {
  if (!supabase) throw new Error("supabase");
  const { data, error } = await supabase.rpc("dashboard_stats");
  if (error) throw error;
  return asStats(data);
}

export const ITEM_PAGE_SIZE = 24;

export type ItemPage = {
  items: ItemSummary[];
  total: number;
};

export async function fetchItemList(kind: string, query: string, status: string, offset = 0): Promise<ItemPage> {
  if (!supabase) throw new Error("supabase");
  const { data, error } = await supabase.rpc("list_items", {
    p_kind: kind,
    p_query: query,
    p_status: status,
    p_limit: ITEM_PAGE_SIZE,
    p_offset: offset,
  });
  if (error) throw error;
  if (!data || typeof data !== "object" || Array.isArray(data)) return { items: [], total: 0 };
  const page = data as { items?: unknown; total?: unknown };
  return {
    items: Array.isArray(page.items) ? (page.items as ItemSummary[]) : [],
    total: Number(page.total) || 0,
  };
}

export async function fetchItemDetail(id: string): Promise<CatalogItem | null> {
  if (!supabase) throw new Error("supabase");
  const { data, error } = await supabase.rpc("item_detail", { p_id: id });
  if (error) throw error;
  if (!data || typeof data !== "object") return null;
  return data as CatalogItem;
}

export async function storeCatalog(catalog: Catalog): Promise<number> {
  if (!supabase) throw new Error("supabase");
  const { data, error } = await supabase.rpc("upsert_catalog", { payload: catalog });
  if (error) throw error;
  return typeof data === "number" ? data : 0;
}
