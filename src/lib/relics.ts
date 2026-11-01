import type { PartRelic, RelicRarity } from "../types.ts";

export type RawRelic = {
  era?: string;
  category?: string;
  quality?: string;
  rewardManifest?: string;
  vaultedAt?: number;
};

type RewardRow = {
  type?: string;
  rarity?: string;
};

const ERA_ORDER = ["Lith", "Meso", "Neo", "Axi", "Vanguard", "Requiem"];
const RARITY: Record<string, RelicRarity> = {
  COMMON: "common",
  UNCOMMON: "uncommon",
  RARE: "rare",
};

export function indexRelicDrops(
  relics: Record<string, RawRelic>,
  rewards: Record<string, unknown>,
): Map<string, PartRelic[]> {
  const byKey = new Map<string, PartRelic[]>();
  for (const relic of Object.values(relics)) {
    if (!relic || relic.quality !== "VPQ_BRONZE") continue;
    const era = relic.era?.trim() ?? "";
    const category = relic.category?.trim() ?? "";
    const manifest = relic.rewardManifest?.trim() ?? "";
    if (!era || !category || !manifest) continue;
    const name = `${era} ${category}`;
    const vaulted = typeof relic.vaultedAt === "number";
    for (const reward of rewardRows(rewards[manifest])) {
      const rarity = RARITY[reward.rarity?.trim().toUpperCase() ?? ""];
      const key = relicKey(reward.type ?? "");
      if (!rarity || !key) continue;
      const list = byKey.get(key) ?? [];
      if (!list.some((entry) => entry.name === name)) list.push({ name, rarity, vaulted });
      byKey.set(key, list);
    }
  }
  for (const list of byKey.values()) list.sort(compareRelics);
  return byKey;
}

export function relicKey(path: string) {
  const leaf = path.split("/").pop()?.trim() ?? "";
  return leaf.replace(/(Blueprint|Component)$/, "") || leaf;
}

function rewardRows(table: unknown): RewardRow[] {
  if (!Array.isArray(table)) return [];
  if (table.every((row) => Array.isArray(row))) return table.flat() as RewardRow[];
  return table as RewardRow[];
}

function compareRelics(left: PartRelic, right: PartRelic) {
  if (left.vaulted !== right.vaulted) return left.vaulted ? 1 : -1;
  const era = eraRank(left.name) - eraRank(right.name);
  if (era !== 0) return era;
  return left.name.localeCompare(right.name, "en");
}

function eraRank(name: string) {
  const era = name.split(" ")[0] ?? "";
  const index = ERA_ORDER.indexOf(era);
  return index === -1 ? ERA_ORDER.length : index;
}
