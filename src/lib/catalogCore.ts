import type { Catalog, CatalogItem, CatalogPart, ItemKind } from "../types.ts";
import { indexRecipes, materialsForPart, type RawRecipe, type RecipeBook } from "./materials.ts";

export type RawComponent = {
  name?: string;
  uniqueName?: string;
  tradable?: boolean;
  imageName?: string;
};

export type RawItem = {
  name?: string;
  uniqueName?: string;
  category?: string;
  masterable?: boolean;
  vaulted?: boolean;
  imageName?: string;
  components?: RawComponent[];
};

const IMAGE_BASE = "https://cdn.warframestat.us/img/";

export function itemImage(imageName?: string): string | null {
  const name = imageName?.trim();
  if (!name) return null;
  return `${IMAGE_BASE}${encodeURIComponent(name)}`;
}

export type MarketEntry = {
  slug: string;
  gameRef: string;
  name: string;
};

const DATA_FILES = ["Warframes", "Primary", "Secondary", "Melee"];
const DATA_BASE = "https://raw.githubusercontent.com/WFCD/warframe-items/master/data/json";
const RECIPES_URL = "https://raw.githubusercontent.com/calamity-inc/warframe-public-export-plus/senpai/ExportRecipes.json";

export async function fetchSource(): Promise<{
  version: string;
  groups: RawItem[][];
  components: RawComponent[];
  recipes: RecipeBook;
}> {
  const commitResponse = await fetch("https://api.github.com/repos/WFCD/warframe-items/commits/master", {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "warframe-planos",
    },
  });
  if (!commitResponse.ok) throw new Error("catalog");
  const commit = (await commitResponse.json()) as { sha?: string };
  const version = commit.sha?.slice(0, 7) ?? "github";

  const [groups, components, recipes] = await Promise.all([
    Promise.all(
      DATA_FILES.map(async (file) => {
        const response = await fetch(`${DATA_BASE}/${file}.json`);
        if (!response.ok) throw new Error("catalog");
        return (await response.json()) as RawItem[];
      }),
    ),
    fetch(`${DATA_BASE}/Components.json`).then(async (response) => {
      if (!response.ok) throw new Error("catalog");
      return (await response.json()) as RawComponent[];
    }),
    fetch(RECIPES_URL)
      .then(async (response) => {
        if (!response.ok) return indexRecipes({});
        const raw = (await response.json()) as Record<string, RawRecipe>;
        return indexRecipes(raw && typeof raw === "object" ? raw : {});
      })
      .catch(() => indexRecipes({})),
  ]);

  return { version, groups, components, recipes };
}

const KIND_BY_CATEGORY: Record<string, ItemKind> = {
  Warframes: "warframe",
  Primary: "primary",
  Secondary: "secondary",
  Melee: "melee",
};

const PART_LABELS: Record<string, string> = {
  Blueprint: "Plano",
  Chassis: "Chasis",
  Neuroptics: "Neurópticas",
  Systems: "Sistemas",
  Barrel: "Cañón",
  Receiver: "Receptor",
  Stock: "Culata",
  Blade: "Hoja",
  Handle: "Empuñadura",
  Link: "Enlace",
  String: "Cuerda",
  Hilt: "Empuñadura",
  Holster: "Funda",
  Grip: "Cacha",
  Gauntlet: "Guantelete",
  "Lower Limb": "Rama inferior",
  "Upper Limb": "Rama superior",
  Guard: "Guarda",
  Head: "Cabeza",
  Pouch: "Bolsa",
  Ornament: "Adorno",
  Disc: "Disco",
  Blades: "Hojas",
  Stars: "Estrellas",
  Barrels: "Cañones",
  Receivers: "Receptores",
  Rivet: "Remache",
  "War Blade": "Hoja de guerra",
  "War Hilt": "Empuñadura de guerra",
  Hook: "Gancho",
  "Left Gauntlet": "Guantelete izquierdo",
  "Right Gauntlet": "Guantelete derecho",
  Engine: "Motor",
  Boot: "Bota",
  Chain: "Cadena",
  Subcortex: "Subcórtex",
  Glove: "Guante",
  Heatsink: "Disipador",
  Motor: "Motor",
  Core: "Núcleo",
  "Day Aspect": "Aspecto diurno",
  "Night Aspect": "Aspecto nocturno",
};

const LABEL_KEYS = Object.keys(PART_LABELS).sort((a, b) => b.length - a.length);

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const PART_SUFFIXES: Array<[string, string]> = [
  ["HelmetBlueprint", "Neuroptics"],
  ["HelmetComponent", "Neuroptics"],
  ["ChassisBlueprint", "Chassis"],
  ["ChassisComponent", "Chassis"],
  ["SystemsBlueprint", "Systems"],
  ["SystemsComponent", "Systems"],
  ["NeuropticsBlueprint", "Neuroptics"],
  ["NeuropticsComponent", "Neuroptics"],
  ["LowerLimb", "Lower Limb"],
  ["UpperLimb", "Upper Limb"],
  ["LeftGauntlet", "Left Gauntlet"],
  ["RightGauntlet", "Right Gauntlet"],
  ["WarBlade", "War Blade"],
  ["WarHilt", "War Hilt"],
  ["DayAspect", "Day Aspect"],
  ["NightAspect", "Night Aspect"],
  ["Blueprint", "Blueprint"],
  ["Barrels", "Barrels"],
  ["Receivers", "Receivers"],
  ["Barrel", "Barrel"],
  ["Receiver", "Receiver"],
  ["Stock", "Stock"],
  ["Blades", "Blades"],
  ["Blade", "Blade"],
  ["Handle", "Handle"],
  ["String", "String"],
  ["Hilt", "Hilt"],
  ["Grip", "Grip"],
  ["Gauntlet", "Gauntlet"],
  ["Guard", "Guard"],
  ["Pouch", "Pouch"],
  ["Ornament", "Ornament"],
  ["Stars", "Stars"],
  ["Rivet", "Rivet"],
  ["Hook", "Hook"],
  ["Engine", "Engine"],
  ["Boot", "Boot"],
  ["Chain", "Chain"],
  ["Subcortex", "Subcortex"],
  ["Glove", "Glove"],
  ["Heatsink", "Heatsink"],
  ["Motor", "Motor"],
  ["Core", "Core"],
  ["Head", "Head"],
  ["Link", "Link"],
  ["Disc", "Disc"],
  ["Holster", "Holster"],
  ["Chassis", "Chassis"],
];

function partNameOf(component: RawComponent): string | null {
  const given = component.name?.trim();
  if (given) return given;
  const segment = component.uniqueName?.split("/").pop() ?? "";
  const match = PART_SUFFIXES.find(([suffix]) => segment.endsWith(suffix));
  return match ? match[1] : null;
}

function isRecipe(component: RawComponent): boolean {
  const uniqueName = component.uniqueName ?? "";
  if (!uniqueName) return false;
  if (uniqueName.includes("/Items/MiscItems/") || uniqueName.includes("/Items/Research/")) return false;
  if (uniqueName.includes("/Recipes/") || uniqueName.includes("/WeaponParts/")) return true;
  return uniqueName.split("/").pop()?.endsWith("Blueprint") === true;
}

function spanishPart(partName: string): string {
  const exact = PART_LABELS[partName];
  if (exact) return exact;
  for (const key of LABEL_KEYS) {
    if (partName.endsWith(key)) {
      return `${partName.slice(0, -key.length).trimEnd()} ${PART_LABELS[key]}`.trim();
    }
  }
  return partName;
}

function partTitle(parent: string, partName: string): string {
  const exact = PART_LABELS[partName];
  if (exact) return `${exact} de ${parent}`;
  return spanishPart(partName);
}

function englishName(parent: string, partName: string): string {
  if (PART_LABELS[partName]) return `${parent} ${partName}`;
  return partName;
}

export function marketEntries(
  raw: Array<{
    slug?: string;
    gameRef?: string;
    i18n?: { en?: { name?: string } };
  }>,
): MarketEntry[] {
  const entries: MarketEntry[] = [];
  for (const item of raw) {
    if (!item.slug) continue;
    entries.push({
      slug: item.slug,
      gameRef: item.gameRef ?? "",
      name: item.i18n?.en?.name ?? "",
    });
  }
  return entries;
}

function matchSetSlug(name: string, uniqueName: string, market: MarketIndex): string | null {
  const guess = `${slugify(name)}_set`;
  const found = [
    market.byRef.get(uniqueName),
    market.byName.get(name.toLowerCase()),
    market.byName.get(`${name.toLowerCase()} set`),
    market.slugs.has(guess) ? guess : null,
  ];
  return found.find((slug) => slug?.endsWith("_set")) ?? null;
}

function matchItemSlug(name: string, uniqueName: string, market: MarketIndex): string | null {
  const slug = market.byRef.get(uniqueName) ?? market.byName.get(name.toLowerCase()) ?? null;
  if (!slug || slug.endsWith("_set")) return null;
  return slug;
}

function matchSlug(parent: string, partName: string, uniqueName: string, market: MarketIndex): string | null {
  const refs = [uniqueName];
  if (uniqueName.endsWith("Component")) refs.push(uniqueName.replace(/Component$/, "Blueprint"));
  if (uniqueName.endsWith("Blueprint")) refs.push(uniqueName.replace(/Blueprint$/, "Component"));
  for (const ref of refs) {
    const slug = market.byRef.get(ref);
    if (slug) return slug;
  }

  const base = englishName(parent, partName);
  const names = [base, `${base} Blueprint`, partName, `${partName} Blueprint`];
  for (const name of names) {
    const slug = market.byName.get(name.toLowerCase());
    if (slug) return slug;
  }
  for (const name of names) {
    const slug = slugify(name);
    if (market.slugs.has(slug)) return slug;
  }
  return null;
}

type MarketIndex = {
  byRef: Map<string, string>;
  byName: Map<string, string>;
  slugs: Set<string>;
};

function indexMarket(entries: MarketEntry[]): MarketIndex {
  const byRef = new Map<string, string>();
  const byName = new Map<string, string>();
  const slugs = new Set<string>();
  for (const entry of entries) {
    slugs.add(entry.slug);
    if (entry.gameRef) byRef.set(entry.gameRef, entry.slug);
    if (entry.name) byName.set(entry.name.toLowerCase(), entry.slug);
  }
  return { byRef, byName, slugs };
}

export function buildCatalog(
  groups: RawItem[][],
  entries: MarketEntry[],
  sourceVersion: string,
  generatedAt: string,
  components: RawComponent[] = [],
  recipes: RecipeBook = indexRecipes({}),
): Catalog {
  const market = indexMarket(entries);
  const componentById = new Map<string, RawComponent>();
  for (const component of components) {
    const id = component.uniqueName?.trim();
    if (id) componentById.set(id, component);
  }
  const seen = new Set<string>();
  const items: CatalogItem[] = [];

  for (const group of groups) {
    for (const raw of group) {
      const name = raw.name?.trim();
      const id = raw.uniqueName?.trim();
      const kind = raw.category ? KIND_BY_CATEGORY[raw.category] : undefined;
      if (!name || !id || !kind || seen.has(id) || raw.masterable === false) continue;
      if (/\bexalted\b/i.test(name)) continue;
      seen.add(id);

      const parts: CatalogPart[] = [];
      const seenParts = new Set<string>();
      for (const component of raw.components ?? []) {
        const partId = component.uniqueName?.trim();
        if (!partId || seenParts.has(partId) || !isRecipe(component)) continue;
        const resolved = componentById.get(partId) ?? component;
        const partName = partNameOf(resolved);
        if (!partName) continue;
        seenParts.add(partId);
        const slug = matchSlug(name, partName, partId, market);
        parts.push({
          id: partId,
          short: spanishPart(partName),
          title: partTitle(name, partName),
          english: englishName(name, partName),
          tradable: resolved.tradable === true || component.tradable === true || slug !== null,
          slug,
          image: itemImage(resolved.imageName),
          materials: materialsForPart(partId, recipes),
        });
      }

      parts.sort((a, b) => {
        const aPlan = a.english.endsWith(" Blueprint") ? 0 : 1;
        const bPlan = b.english.endsWith(" Blueprint") ? 0 : 1;
        if (aPlan !== bPlan) return aPlan - bPlan;
        return a.short.localeCompare(b.short, "es");
      });

      const itemSlug = parts.length === 0 ? matchItemSlug(name, id, market) : null;
      items.push({
        id,
        name,
        kind,
        vaulted: raw.vaulted === true,
        image: itemImage(raw.imageName),
        tradable: itemSlug !== null,
        slug: itemSlug,
        setSlug: parts.length > 0 ? matchSetSlug(name, id, market) : null,
        parts,
      });
    }
  }

  items.sort((a, b) => a.name.localeCompare(b.name, "es"));
  return { sourceVersion, generatedAt, items };
}
