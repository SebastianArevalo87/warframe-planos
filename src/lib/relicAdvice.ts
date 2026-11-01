import type { Collection, ItemKind, PartRelic, RelicRarity } from "../types.ts";
import type { MasteryRow } from "./catalogRemote.ts";
import { itemMastery } from "./mastery.ts";

export type AdvicePart = {
  id: string;
  short: string;
  itemId: string;
  itemName: string;
  image: string | null;
  kind: ItemKind;
  relics: PartRelic[];
};

export type RelicChip = {
  name: string;
  label: string;
  vaulted: boolean;
  rare: boolean;
};

export type RelicTarget = {
  itemId: string;
  name: string;
  image: string | null;
  kind: ItemKind;
  xp: number;
  missingCount: number;
  missing: Array<{ part: string; relics: RelicChip[] }>;
};

const RARITY_LABEL: Record<RelicRarity, string> = {
  common: "común",
  uncommon: "poco común",
  rare: "raro",
};

const RARITY_ORDER: Record<RelicRarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
};

export function relicTargets(parts: AdvicePart[], collection: Collection): RelicTarget[] {
  const owned = new Set(collection.parts);
  const built = new Set(collection.built);
  const mastered = new Set(collection.mastered);
  const byItem = new Map<string, AdvicePart[]>();
  for (const part of parts) {
    const list = byItem.get(part.itemId) ?? [];
    list.push(part);
    byItem.set(part.itemId, list);
  }

  const targets: RelicTarget[] = [];
  for (const [itemId, itemParts] of byItem) {
    if (built.has(itemId) || mastered.has(itemId) || itemParts.length === 0) continue;
    const missing = itemParts.filter((part) => !owned.has(part.id));
    const have = itemParts.length - missing.length;
    if (have < 1 || missing.length < 1 || missing.length > 2) continue;
    const first = itemParts[0];
    targets.push({
      itemId,
      name: first.itemName,
      image: first.image,
      kind: first.kind,
      xp: itemMastery(first.kind, itemId),
      missingCount: missing.length,
      missing: missing.map((part) => ({ part: part.short, relics: pickRelics(part.relics) })),
    });
  }

  return targets
    .sort((left, right) => farmable(left) - farmable(right) || left.missingCount - right.missingCount || left.name.localeCompare(right.name, "es"))
    .slice(0, 8);
}

export function sharedRelics(targets: RelicTarget[]) {
  const counts = new Map<string, number>();
  for (const target of targets) {
    for (const part of target.missing) {
      const names = new Set(part.relics.filter((relic) => !relic.vaulted).map((relic) => relic.name));
      for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter((entry) => entry[1] > 1)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "es"))
    .slice(0, 3)
    .map(([name, count]) => ({ name, count }));
}

export function readyToMaster(items: MasteryRow[], collection: Collection) {
  const mastered = new Set(collection.mastered);
  const built = new Set(collection.built);
  return items
    .filter((item) => built.has(item.id) && !mastered.has(item.id))
    .map((item) => ({ ...item, xp: itemMastery(item.kind, item.id) }))
    .sort((left, right) => right.xp - left.xp || left.name.localeCompare(right.name, "es"));
}

function farmable(target: RelicTarget) {
  return target.missing.some((part) => part.relics.some((relic) => !relic.vaulted)) ? 0 : 1;
}

function pickRelics(relics: PartRelic[]): RelicChip[] {
  const sorted = [...relics].sort(
    (left, right) => Number(left.vaulted) - Number(right.vaulted) || RARITY_ORDER[left.rarity] - RARITY_ORDER[right.rarity] || left.name.localeCompare(right.name, "es"),
  );
  const open = sorted.filter((relic) => !relic.vaulted).slice(0, 3);
  const picked = open.length > 0 ? open : sorted.slice(0, 2);
  return picked.map((relic) => ({
    name: relic.name,
    label: RARITY_LABEL[relic.rarity],
    vaulted: relic.vaulted,
    rare: relic.rarity === "rare",
  }));
}
