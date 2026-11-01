import type { Catalog, CatalogItem, CatalogPart, ItemKind } from "../types.ts";
import { supabase } from "./supabase.ts";

export type DashboardHighlight = {
  id: string;
  name: string;
  kind: ItemKind;
  image: string | null;
  missing: number;
  caption: string;
};

export type DashboardStats = {
  frames: number;
  frameTotal: number;
  weapons: number;
  weaponTotal: number;
  primary: number;
  primaryTotal: number;
  secondary: number;
  secondaryTotal: number;
  melee: number;
  meleeTotal: number;
  ready: number;
  almost: number;
  ownedParts: number;
  partTotal: number;
  readyItems: DashboardHighlight[];
  almostItems: DashboardHighlight[];
  sellCopies: number;
  sellItemCount: number;
  sellItems: DashboardHighlight[];
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
  primary: 0,
  primaryTotal: 0,
  secondary: 0,
  secondaryTotal: 0,
  melee: 0,
  meleeTotal: 0,
  ready: 0,
  almost: 0,
  ownedParts: 0,
  partTotal: 0,
  readyItems: [],
  almostItems: [],
  sellCopies: 0,
  sellItemCount: 0,
  sellItems: [],
  sourceVersion: null,
  generatedAt: null,
});

function asHighlights(value: unknown): DashboardHighlight[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Partial<DashboardHighlight>;
    if (typeof row.id !== "string" || typeof row.name !== "string") return [];
    const kind = row.kind;
    if (kind !== "warframe" && kind !== "primary" && kind !== "secondary" && kind !== "melee") return [];
    return [
      {
        id: row.id,
        name: row.name,
        kind,
        image: typeof row.image === "string" ? row.image : null,
        missing: Number(row.missing) || 0,
        caption: typeof row.caption === "string" ? row.caption : "",
      },
    ];
  });
}

function asStats(value: unknown): DashboardStats {
  if (!value || typeof value !== "object") return emptyStats();
  const stats = value as DashboardStats;
  return {
    frames: Number(stats.frames) || 0,
    frameTotal: Number(stats.frameTotal) || 0,
    weapons: Number(stats.weapons) || 0,
    weaponTotal: Number(stats.weaponTotal) || 0,
    primary: Number(stats.primary) || 0,
    primaryTotal: Number(stats.primaryTotal) || 0,
    secondary: Number(stats.secondary) || 0,
    secondaryTotal: Number(stats.secondaryTotal) || 0,
    melee: Number(stats.melee) || 0,
    meleeTotal: Number(stats.meleeTotal) || 0,
    ready: Number(stats.ready) || 0,
    almost: Number(stats.almost) || 0,
    ownedParts: Number(stats.ownedParts) || 0,
    partTotal: Number(stats.partTotal) || 0,
    readyItems: asHighlights(stats.readyItems),
    almostItems: asHighlights(stats.almostItems),
    sellCopies: Number(stats.sellCopies) || 0,
    sellItemCount: Number(stats.sellItemCount) || 0,
    sellItems: asHighlights(stats.sellItems),
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

function asPart(value: unknown): CatalogPart | null {
  if (!value || typeof value !== "object") return null;
  const part = value as CatalogPart;
  if (typeof part.id !== "string" || typeof part.title !== "string") return null;
  const slug = typeof part.slug === "string" && part.slug ? part.slug : null;
  return {
    id: part.id,
    short: typeof part.short === "string" ? part.short : part.title,
    title: part.title,
    english: typeof part.english === "string" ? part.english : part.title,
    tradable: part.tradable === true || slug !== null,
    slug,
    image: typeof part.image === "string" ? part.image : null,
  };
}

export async function fetchItemDetail(id: string): Promise<CatalogItem | null> {
  if (!supabase) throw new Error("supabase");
  const { data, error } = await supabase.rpc("item_detail", { p_id: id });
  if (error) throw error;
  if (!data || typeof data !== "object") return null;
  const item = data as CatalogItem;
  if (typeof item.id !== "string" || typeof item.name !== "string" || !Array.isArray(item.parts)) return null;
  const slug = typeof item.slug === "string" && item.slug && !item.slug.endsWith("_set") ? item.slug : null;
  return {
    ...item,
    tradable: item.tradable === true || slug !== null,
    slug,
    setSlug: typeof item.setSlug === "string" && item.setSlug.endsWith("_set") ? item.setSlug : null,
    parts: item.parts.flatMap((part) => {
      const next = asPart(part);
      return next ? [next] : [];
    }),
  };
}

export type SellPart = {
  id: string;
  title: string;
  slug: string | null;
  qty: number;
};

export type SellRow = {
  id: string;
  name: string;
  kind: ItemKind;
  image: string | null;
  setSlug: string | null;
  parts: SellPart[];
};

function asSellRows(value: unknown): SellRow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Partial<SellRow>;
    if (typeof row.id !== "string" || typeof row.name !== "string") return [];
    const kind = row.kind;
    if (kind !== "warframe" && kind !== "primary" && kind !== "secondary" && kind !== "melee") return [];
    const parts = Array.isArray(row.parts)
      ? row.parts.flatMap((part) => {
          if (!part || typeof part !== "object") return [];
          const piece = part as Partial<SellPart>;
          if (typeof piece.id !== "string" || typeof piece.title !== "string") return [];
          const qty = Number(piece.qty);
          if (!Number.isInteger(qty) || qty <= 0) return [];
          return [
            {
              id: piece.id,
              title: piece.title,
              slug: typeof piece.slug === "string" ? piece.slug : null,
              qty,
            },
          ];
        })
      : [];
    if (parts.length === 0) return [];
    return [
      {
        id: row.id,
        name: row.name,
        kind,
        image: typeof row.image === "string" ? row.image : null,
        setSlug: typeof row.setSlug === "string" ? row.setSlug : null,
        parts,
      },
    ];
  });
}

export async function fetchSellStock(): Promise<SellRow[]> {
  if (!supabase) throw new Error("supabase");
  const { data, error } = await supabase.rpc("sell_stock");
  if (error) throw error;
  return asSellRows(data);
}

export async function storeCatalog(catalog: Catalog): Promise<number> {
  if (!supabase) throw new Error("supabase");
  const { data, error } = await supabase.rpc("upsert_catalog", { payload: catalog });
  if (error) throw error;
  return typeof data === "number" ? data : 0;
}
