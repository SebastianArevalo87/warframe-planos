import { isItemKind, type ItemKind, type PartRelic, type RelicRarity } from "../types.ts";
import type { SellGap, SellRow } from "./catalogRemote.ts";
import { supabase } from "./supabase.ts";

type PartRecord = {
  id: string;
  item_id: string;
  title: string;
  slug: string | null;
  tradable: boolean;
  relics: unknown;
};

type ItemRecord = {
  id: string;
  name: string;
  kind: string;
  image: string | null;
  set_slug: string | null;
};

function relicsOf(value: unknown): PartRelic[] {
  if (!Array.isArray(value)) return [];
  const relics: PartRelic[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as { name?: unknown; rarity?: unknown; vaulted?: unknown };
    if (typeof row.name !== "string") continue;
    const rarity = row.rarity === "rare" || row.rarity === "uncommon" || row.rarity === "common" ? row.rarity : "common";
    relics.push({ name: row.name, rarity: rarity as RelicRarity, vaulted: row.vaulted === true });
  }
  return relics;
}

async function rowsFor(ids: string[]) {
  if (!supabase || ids.length === 0) return { parts: [] as PartRecord[], items: [] as ItemRecord[] };
  const parts: PartRecord[] = [];
  const items: ItemRecord[] = [];
  for (let index = 0; index < ids.length; index += 80) {
    const chunk = ids.slice(index, index + 80);
    const [partResult, itemResult] = await Promise.all([
      supabase.from("catalog_parts").select("id, item_id, title, slug, tradable, relics").in("item_id", chunk),
      supabase.from("catalog_items").select("id, name, kind, image, set_slug").in("id", chunk),
    ]);
    if (partResult.error) throw partResult.error;
    if (itemResult.error) throw itemResult.error;
    parts.push(...((partResult.data ?? []) as PartRecord[]));
    items.push(...((itemResult.data ?? []) as ItemRecord[]));
  }
  return { parts, items };
}

export async function buildSellBoard(mastered: string[], qty: Record<string, number>): Promise<SellRow[]> {
  const { parts, items } = await rowsFor(mastered);
  const byItem = new Map<string, PartRecord[]>();
  for (const part of parts) {
    const list = byItem.get(part.item_id) ?? [];
    list.push(part);
    byItem.set(part.item_id, list);
  }
  const rows: SellRow[] = [];
  for (const item of items) {
    if (!isItemKind(item.kind)) continue;
    const pieces = byItem.get(item.id) ?? [];
    if (pieces.length === 0) continue;
    const owned = pieces.filter((part) => (qty[part.id] ?? 0) > 0);
    const missing = pieces.filter((part) => (qty[part.id] ?? 0) === 0);
    if (owned.length === 0) continue;
    const gaps: SellGap[] = owned.length > 0 && missing.length > 0 && missing.length <= 2
      ? missing.map((part) => ({
          id: part.id,
          title: part.title,
          slug: part.slug,
          relics: relicsOf(part.relics),
        }))
      : [];
    rows.push({
      id: item.id,
      name: item.name,
      kind: item.kind as ItemKind,
      image: item.image,
      setSlug: item.set_slug,
      parts: owned.map((part) => ({
        id: part.id,
        title: part.title,
        slug: part.tradable || part.slug ? part.slug : null,
        qty: qty[part.id] ?? 0,
      })),
      gaps,
    });
  }
  return rows.sort((left, right) => left.name.localeCompare(right.name, "es"));
}
