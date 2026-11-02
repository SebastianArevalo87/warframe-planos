export type ItemKind =
  | "warframe"
  | "primary"
  | "secondary"
  | "melee"
  | "archwing"
  | "archgun"
  | "archmelee"
  | "necramech"
  | "companion"
  | "robotic"
  | "amp"
  | "vehicle";

export const KIND_LABEL: Record<ItemKind, string> = {
  warframe: "Warframe",
  primary: "Primaria",
  secondary: "Secundaria",
  melee: "Cuerpo a cuerpo",
  archwing: "Archwing",
  archgun: "Arch-gun",
  archmelee: "Arch-melee",
  necramech: "Necramech",
  companion: "Compañero",
  robotic: "Robótico",
  amp: "Amp",
  vehicle: "Vehículo",
};

export function isItemKind(value: unknown): value is ItemKind {
  return typeof value === "string" && Object.hasOwn(KIND_LABEL, value);
}

export function matchesKind(kind: ItemKind, filter: KindFilter): boolean {
  if (filter === "all") return true;
  if (filter === "weapon") return kind === "primary" || kind === "secondary" || kind === "melee";
  if (filter === "archwing") return kind === "archwing" || kind === "necramech";
  return kind === filter;
}

export type CraftMaterial = {
  id: string;
  name: string;
  count: number;
  image: string | null;
};

export type RelicRarity = "common" | "uncommon" | "rare";

export type PartRelic = {
  name: string;
  rarity: RelicRarity;
  vaulted: boolean;
};

export type CatalogPart = {
  id: string;
  short: string;
  title: string;
  english: string;
  tradable: boolean;
  slug: string | null;
  image: string | null;
  materials: CraftMaterial[];
  relics: PartRelic[];
};

export type CatalogItem = {
  id: string;
  name: string;
  kind: ItemKind;
  vaulted: boolean;
  image: string | null;
  tradable: boolean;
  slug: string | null;
  setSlug: string | null;
  parts: CatalogPart[];
};

export type Catalog = {
  sourceVersion: string;
  generatedAt: string;
  items: CatalogItem[];
};

export type ProfileIntrinsic = {
  piloting: number;
  gunnery: number;
  engineering: number;
  tactical: number;
  command: number;
  riding: number;
  combat: number;
  opportunity: number;
  endurance: number;
};

export type ProfileSyndicate = {
  tag: string;
  standing: number;
  title: number;
};

export type ProfileDossier = {
  accountId: string;
  displayName: string;
  rank: number;
  clan: string;
  clanTier: number | null;
  created: string;
  nodes: number;
  steel: number;
  intrinsics: ProfileIntrinsic;
  syndicates: ProfileSyndicate[];
  alignment: { value: number; wisdom: number };
  marks: string[];
  founder: boolean;
  timePlayedSec: number;
  missionsCompleted: number;
  missionsFailed: number;
  loadedAt: string;
};

export type Collection = {
  parts: string[];
  built: string[];
  items: string[];
  qty: Record<string, number>;
  crafted: string[];
  mastered: string[];
  leveled: string[];
  dossier?: ProfileDossier;
};

export type Draft = {
  parts: string[];
  history: string[];
};

export type StatusFilter = "missing" | "ready" | "built" | "almost" | "owned" | "all";
export type KindFilter = "all" | "weapon" | ItemKind;
