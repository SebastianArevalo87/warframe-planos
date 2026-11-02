import type { Collection, ProfileDossier, ProfileIntrinsic, ProfileSyndicate } from "../types.ts";

export const MAX_QTY = 99;

export function emptyCollection(): Collection {
  return { parts: [], built: [], items: [], qty: {}, crafted: [], mastered: [], leveled: [] };
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
  const mastered = strings(raw.mastered);
  const done = new Set(mastered);
  const collection: Collection = {
    parts,
    built: strings(raw.built),
    items,
    qty: kept,
    crafted: craftedKeys(raw.crafted),
    mastered,
    leveled: strings(raw.leveled).filter((id) => !done.has(id)),
  };
  const saved = readDossier(raw.dossier);
  if (saved) collection.dossier = saved;
  return collection;
}

function whole(value: unknown, max = 1_000_000_000) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(max, Math.trunc(number)));
}

function readIntrinsics(value: unknown): ProfileIntrinsic {
  const raw = value && typeof value === "object" ? (value as Partial<ProfileIntrinsic>) : {};
  return {
    piloting: whole(raw.piloting, 20),
    gunnery: whole(raw.gunnery, 20),
    engineering: whole(raw.engineering, 20),
    tactical: whole(raw.tactical, 20),
    command: whole(raw.command, 20),
    riding: whole(raw.riding, 20),
    combat: whole(raw.combat, 20),
    opportunity: whole(raw.opportunity, 20),
    endurance: whole(raw.endurance, 20),
  };
}

function readSyndicates(value: unknown): ProfileSyndicate[] {
  if (!Array.isArray(value)) return [];
  const rows: ProfileSyndicate[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Partial<ProfileSyndicate>;
    if (typeof row.tag !== "string" || row.tag.length === 0 || row.tag.length > 80) continue;
    rows.push({
      tag: row.tag,
      standing: Math.max(-1_000_000_000, Math.min(1_000_000_000, Math.trunc(Number(row.standing) || 0))),
      title: Math.max(-10, Math.min(10, Math.trunc(Number(row.title) || 0))),
    });
    if (rows.length >= 24) break;
  }
  return rows;
}

function readDossier(value: unknown): ProfileDossier | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Partial<ProfileDossier>;
  if (typeof raw.accountId !== "string" || !/^[a-f0-9]{24}$/.test(raw.accountId)) return undefined;
  if (typeof raw.displayName !== "string" || !Number.isFinite(Number(raw.rank))) return undefined;
  const alignment = raw.alignment && typeof raw.alignment === "object" ? raw.alignment : { value: 0, wisdom: 0 };
  return {
    accountId: raw.accountId,
    displayName: raw.displayName.replace(/[\uE000-\uF8FF]/g, "").trim().slice(0, 40),
    rank: whole(raw.rank, 40),
    clan: typeof raw.clan === "string" ? raw.clan.slice(0, 40) : "",
    clanTier: raw.clanTier == null || !Number.isFinite(Number(raw.clanTier)) ? null : whole(raw.clanTier, 20),
    created: typeof raw.created === "string" ? raw.created.slice(0, 40) : "",
    nodes: whole(raw.nodes, 10000),
    steel: whole(raw.steel, 10000),
    intrinsics: readIntrinsics(raw.intrinsics),
    syndicates: readSyndicates(raw.syndicates),
    alignment: {
      value: Math.max(-1, Math.min(1, Number(alignment.value) || 0)),
      wisdom: whole(alignment.wisdom, 40),
    },
    marks: strings(raw.marks).slice(0, 8),
    founder: raw.founder === true,
    timePlayedSec: whole(raw.timePlayedSec),
    missionsCompleted: whole(raw.missionsCompleted),
    missionsFailed: whole(raw.missionsFailed),
    loadedAt: typeof raw.loadedAt === "string" ? raw.loadedAt.slice(0, 40) : "",
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
