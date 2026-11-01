import type { Catalog, CatalogItem, CatalogPart, ItemKind, PartRelic } from "../types.ts";
import { indexRecipes, materialsForPart, type RawRecipe, type RecipeBook } from "./materials.ts";
import { indexRelicDrops, relicKey, type RawRelic } from "./relics.ts";

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
  type?: string;
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

const DATA_FILES: Array<{ file: string; kind: ItemKind }> = [
  { file: "Warframes", kind: "warframe" },
  { file: "Primary", kind: "primary" },
  { file: "Secondary", kind: "secondary" },
  { file: "Melee", kind: "melee" },
  { file: "Archwing", kind: "archwing" },
  { file: "Arch-Gun", kind: "archgun" },
  { file: "Arch-Melee", kind: "archmelee" },
  { file: "Sentinels", kind: "companion" },
  { file: "Pets", kind: "companion" },
  { file: "SentinelWeapons", kind: "companion" },
];

export type SourceGroup = { kind: ItemKind; items: RawItem[] };
const DATA_BASE = "https://raw.githubusercontent.com/WFCD/warframe-items/master/data/json";
const RECIPES_URL = "https://raw.githubusercontent.com/calamity-inc/warframe-public-export-plus/senpai/ExportRecipes.json";
const RELICS_URL = "https://raw.githubusercontent.com/calamity-inc/warframe-public-export-plus/senpai/ExportRelics.json";
const REWARDS_URL = "https://raw.githubusercontent.com/calamity-inc/warframe-public-export-plus/senpai/ExportRewards.json";

const IMAGE_FILES = ["Misc", "Resources", "Fish", "Gear"];

export async function fetchSource(): Promise<{
  version: string;
  groups: SourceGroup[];
  components: RawComponent[];
  recipes: RecipeBook;
  images: Map<string, string>;
  names: Map<string, string>;
  relics: Map<string, PartRelic[]>;
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

  const [groups, components, recipes, materialIndex, relics] = await Promise.all([
    Promise.all(
      DATA_FILES.map(async (source) => {
        const response = await fetch(`${DATA_BASE}/${source.file}.json`);
        if (!response.ok) throw new Error("catalog");
        return { kind: source.kind, items: (await response.json()) as RawItem[] };
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
    fetchMaterialImages(),
    fetchRelicDrops(),
  ]);

  return { version, groups, components, recipes, images: materialIndex.images, names: materialIndex.names, relics };
}

async function fetchRelicDrops(): Promise<Map<string, PartRelic[]>> {
  try {
    const [relicsResponse, rewardsResponse] = await Promise.all([fetch(RELICS_URL), fetch(REWARDS_URL)]);
    if (!relicsResponse.ok || !rewardsResponse.ok) return new Map();
    const relics = (await relicsResponse.json()) as Record<string, RawRelic>;
    const rewards = (await rewardsResponse.json()) as Record<string, unknown>;
    return indexRelicDrops(relics, rewards);
  } catch {
    return new Map();
  }
}

async function fetchMaterialImages(): Promise<{ images: Map<string, string>; names: Map<string, string> }> {
  const images = new Map<string, string>();
  const names = new Map<string, string>();
  await Promise.all(
    IMAGE_FILES.map(async (file) => {
      try {
        const response = await fetch(`${DATA_BASE}/${file}.json`);
        if (!response.ok) return;
        const data = (await response.json()) as Array<{ uniqueName?: string; imageName?: string; name?: string }>;
        if (!Array.isArray(data)) return;
        for (const item of data) {
          const id = item.uniqueName?.trim();
          const image = item.imageName?.trim();
          const name = item.name?.trim();
          if (!id) continue;
          if (image) images.set(id, image);
          if (name) names.set(id, name);
        }
      } catch {
        return;
      }
    }),
  );
  return { images, names };
}

const PART_LABELS: Record<string, string> = {
  Blueprint: "Plano",
  Chassis: "Chasis",
  Neuroptics: "Neurópticas",
  Systems: "Sistemas",
  Wings: "Alas",
  Harness: "Arnés",
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
  Capsule: "Cápsula",
  Casing: "Carcasa",
  "Weapon Pod": "Compartimento de armas",
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
  ["WeaponPod", "Weapon Pod"],
  ["Capsule", "Capsule"],
  ["Casing", "Casing"],
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

function partNameOf(component: RawComponent, names: ReadonlyMap<string, string>): string | null {
  const given = component.name?.trim();
  if (given) return given;
  const id = component.uniqueName?.trim() ?? "";
  const known = names.get(id);
  if (known) return known;
  const segment = id.split("/").pop()?.replace(/Item$/, "") ?? "";
  const match = PART_SUFFIXES.find(([suffix]) => segment.endsWith(suffix));
  return match ? match[1] : null;
}

function roleOf(parent: string, partName: string) {
  const prefix = `${parent} `;
  if (partName.toLowerCase().startsWith(prefix.toLowerCase())) {
    const rest = partName.slice(prefix.length).trim();
    if (rest) return rest;
  }
  return partName;
}

function isRecipe(component: RawComponent): boolean {
  const uniqueName = component.uniqueName ?? "";
  if (!uniqueName) return false;
  if (uniqueName.includes("/Items/MiscItems/") || uniqueName.includes("/Items/Research/")) return false;
  if (uniqueName.includes("/Recipes/") || uniqueName.includes("/WeaponParts/")) return true;
  return uniqueName.split("/").pop()?.endsWith("Blueprint") === true;
}

function isListedPart(component: RawComponent, recipes: RecipeBook): boolean {
  if (isRecipe(component)) return true;
  const id = component.uniqueName?.trim() ?? "";
  if (!id || id.includes("/Items/") || id.includes("/Research/")) return false;
  if (id.startsWith("/Lotus/Weapons/") || id.startsWith("/Lotus/Powersuits/")) return false;
  return (recipes.byResult.get(id)?.length ?? 0) > 0;
}

const PART_NAME_ES: Record<string, string> = {
  Mandachord: "Mandacordio",
  "Exceptional Sentient Core": "Núcleo sintiente excepcional",
};

function spanishPart(partName: string): string {
  const named = PART_NAME_ES[partName];
  if (named) return named;
  const exact = PART_LABELS[partName];
  if (exact) return exact;
  for (const key of LABEL_KEYS) {
    if (partName === key || !partName.endsWith(key)) continue;
    const prefix = partName.slice(0, -key.length).trimEnd();
    if (!prefix || /^(Left|Right|Upper|Lower|War|Day|Night)$/i.test(prefix)) {
      return `${prefix} ${PART_LABELS[key]}`.trim();
    }
  }
  return partName;
}

function partTitle(parent: string, partName: string): string {
  const label = spanishPart(partName);
  if (label.toLowerCase().includes(parent.toLowerCase())) return label;
  return `${label} de ${parent}`;
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
  groups: SourceGroup[],
  entries: MarketEntry[],
  sourceVersion: string,
  generatedAt: string,
  components: RawComponent[] = [],
  recipes: RecipeBook = indexRecipes({}),
  images: ReadonlyMap<string, string> = new Map(),
  names: ReadonlyMap<string, string> = new Map(),
  relics: ReadonlyMap<string, PartRelic[]> = new Map(),
): Catalog {
  const market = indexMarket(entries);
  const knownNames = new Map(names);
  const knownImages = new Map(images);
  for (const group of groups) {
    for (const raw of group.items) {
      const id = raw.uniqueName?.trim();
      const name = raw.name?.trim();
      const image = raw.imageName?.trim();
      if (!id) continue;
      if (name) knownNames.set(id, name);
      if (image) knownImages.set(id, image);
    }
  }
  const componentById = new Map<string, RawComponent>();
  for (const component of components) {
    const id = component.uniqueName?.trim();
    if (id) componentById.set(id, component);
  }
  const seen = new Set<string>();
  const items: CatalogItem[] = [];

  for (const group of groups) {
    for (const raw of group.items) {
      const name = raw.name?.trim();
      const id = raw.uniqueName?.trim();
      const kind = raw.type === "Necramech" ? "necramech" : group.kind;
      if (!name || !id || !kind || seen.has(id) || raw.masterable === false) continue;
      if (/\bexalted\b/i.test(name)) continue;
      seen.add(id);

      const parts: CatalogPart[] = [];
      const seenParts = new Set<string>();
      for (const component of raw.components ?? []) {
        const partId = component.uniqueName?.trim();
        if (!partId || seenParts.has(partId) || !isListedPart(component, recipes)) continue;
        const resolved = componentById.get(partId) ?? component;
        const partName = partNameOf(resolved, knownNames);
        if (!partName) continue;
        const role = roleOf(name, partName);
        seenParts.add(partId);
        const slug = matchSlug(name, role, partId, market);
        parts.push({
          id: partId,
          short: spanishPart(role),
          title: partTitle(name, role),
          english: englishName(name, role),
          tradable: resolved.tradable === true || component.tradable === true || slug !== null,
          slug,
          image: itemImage(resolved.imageName) ?? itemImage(knownImages.get(partId)),
          materials: materialsForPart(partId, recipes, knownImages, knownNames),
          relics: relics.get(relicKey(partId)) ?? [],
        });
      }

      const partIds = new Set(parts.map((part) => part.id));
      for (const part of parts) {
        part.materials = part.materials.filter((material) => material.id === "credits" || !partIds.has(material.id));
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
