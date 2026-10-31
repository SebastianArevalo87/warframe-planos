export type ItemKind = "warframe" | "primary" | "secondary" | "melee";

export type CatalogPart = {
  id: string;
  short: string;
  title: string;
  english: string;
  tradable: boolean;
  slug: string | null;
};

export type CatalogItem = {
  id: string;
  name: string;
  kind: ItemKind;
  vaulted: boolean;
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
};

export type Draft = {
  parts: string[];
  history: string[];
};

export type StatusFilter = "missing" | "ready" | "all";
export type KindFilter = "all" | ItemKind;
