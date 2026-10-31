import type { Catalog, CatalogItem, CatalogPart, ItemKind } from "../types.ts";

export type RawComponent = {
  name?: string;
  uniqueName?: string;
  tradable?: boolean;
};

export type RawItem = {
  name?: string;
  uniqueName?: string;
  category?: string;
  masterable?: boolean;
  vaulted?: boolean;
  components?: RawComponent[];
};

export type MarketEntry = {
  slug: string;
  gameRef: string;
  name: string;
};

const DATA_FILES = ["Warframes", "Primary", "Secondary", "Melee"];
const DATA_BASE = "https://raw.githubusercontent.com/WFCD/warframe-items/master/data/json";

export async function fetchSource(): Promise<{ version: string; groups: RawItem[][] }> {
  const commitResponse = await fetch("https://api.github.com/repos/WFCD/warframe-items/commits/master", {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "warframe-planos",
    },
  });
  if (!commitResponse.ok) throw new Error("catalog");
  const commit = (await commitResponse.json()) as { sha?: string };
  const version = commit.sha?.slice(0, 7) ?? "github";

  const groups = await Promise.all(
    DATA_FILES.map(async (file) => {
      const response = await fetch(`${DATA_BASE}/${file}.json`);
      if (!response.ok) throw new Error("catalog");
      return (await response.json()) as RawItem[];
    }),
  );

  return { version, groups };
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
): Catalog {
  const market = indexMarket(entries);
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
        const partName = partNameOf(component);
        if (!partId || !partName || seenParts.has(partId) || !isRecipe(component)) continue;
        seenParts.add(partId);
        const slug = matchSlug(name, partName, partId, market);
        parts.push({
          id: partId,
          short: spanishPart(partName),
          title: partTitle(name, partName),
          english: englishName(name, partName),
          tradable: component.tradable === true || slug !== null,
          slug,
        });
      }

      parts.sort((a, b) => {
        const aPlan = a.english.endsWith(" Blueprint") ? 0 : 1;
        const bPlan = b.english.endsWith(" Blueprint") ? 0 : 1;
        if (aPlan !== bPlan) return aPlan - bPlan;
        return a.short.localeCompare(b.short, "es");
      });

      items.push({
        id,
        name,
        kind,
        vaulted: raw.vaulted === true,
        parts,
      });
    }
  }

  items.sort((a, b) => a.name.localeCompare(b.name, "es"));
  return { sourceVersion, generatedAt, items };
}
