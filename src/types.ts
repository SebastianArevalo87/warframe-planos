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
  | "amp";

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

export type Collection = {
  parts: string[];
  built: string[];
  items: string[];
  qty: Record<string, number>;
  crafted: string[];
};

export type Draft = {
  parts: string[];
  history: string[];
};

export type StatusFilter = "missing" | "ready" | "built" | "almost" | "owned" | "all";
export type KindFilter = "all" | "weapon" | ItemKind;
