import type { Collection } from "../types.ts";

export const MAX_QTY = 99;

export function emptyCollection(): Collection {
  return { parts: [], built: [], items: [], qty: {}, crafted: [], mastered: [] };
}

export function craftKey(itemId: string, partId: string) {
  return `${itemId}::${partId}`;
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === "string" && item.length > 0);
}

function amounts(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const qty: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value)) {
    const number = typeof raw === "number" ? raw : Number(raw);
    if (!key || !Number.isInteger(number) || number <= 0) continue;
    qty[key] = Math.min(number, MAX_QTY);
  }
  return qty;
}

export function normalizeCollection(value: unknown): Collection {
  if (!value || typeof value !== "object") return emptyCollection();
  const raw = value as Partial<Collection>;
  const qty = amounts(raw.qty);
  for (const id of strings(raw.parts)) if (!qty[id]) qty[id] = 1;
  for (const id of strings(raw.items)) if (!qty[id]) qty[id] = 1;
  const parts = strings(raw.parts).filter((id) => qty[id] > 0);
  const items = strings(raw.items).filter((id) => qty[id] > 0);
  const kept: Record<string, number> = {};
  for (const id of parts) kept[id] = qty[id];
  for (const id of items) kept[id] = qty[id];
  return {
    parts,
    built: strings(raw.built),
    items,
    qty: kept,
    crafted: craftedKeys(raw.crafted),
    mastered: strings(raw.mastered),
  };
}

function craftedKeys(value: unknown): string[] {
  return strings(value).filter((key) => {
    const split = key.split("::");
    return split.length === 2 && split[0].length > 0 && split[1].length > 0 && split[0].length <= 400 && split[1].length <= 400;
  });
}

export function withAmount(collection: Collection, id: string, bucket: "parts" | "items", next: number): Collection {
  const amount = Math.max(0, Math.min(MAX_QTY, Math.trunc(next)));
  const qty = { ...collection.qty };
  const ids = collection[bucket].filter((entry) => entry !== id);
  if (amount > 0) {
    qty[id] = amount;
    ids.push(id);
  } else {
    delete qty[id];
  }
  return { ...collection, [bucket]: ids, qty, crafted: collection.crafted };
}
