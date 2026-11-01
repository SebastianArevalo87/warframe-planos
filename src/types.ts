export type ItemKind = "warframe" | "primary" | "secondary" | "melee";

export type CraftMaterial = {
  id: string;
  name: string;
  count: number;
  image: string | null;
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
