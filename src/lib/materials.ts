import type { CraftMaterial } from "../types.ts";

export type RawRecipe = {
  resultType?: string;
  buildPrice?: number;
  ingredients?: Array<{ ItemType?: string; ItemCount?: number }>;
};

export type RecipeBook = {
  byResult: Map<string, RawRecipe[]>;
  byKey: Map<string, RawRecipe>;
};

const NAMES: Record<string, string> = {
  OrokinCell: "Célula orokin",
  Salvage: "Chatarra",
  AlloyPlate: "Placa de aleación",
  Ferrite: "Ferrita",
  Rubedo: "Rubedo",
  PolymerBundle: "Paquete de polímero",
  Morphic: "Mórficos",
  Plastids: "Plástidos",
  Circuits: "Circuitos",
  ArgonCrystal: "Cristal de argón",
  Nanospores: "Nanoesporas",
  NeuralSensor: "Sensores neuronales",
  Neurode: "Neurodos",
  OxiumAlloy: "Oxium",
  ControlModule: "Módulo de control",
  Alertium: "Extracto de nitain",
  Forma: "Forma",
  Cryotic: "Cryótica",
  Gallium: "Galio",
  Tellurium: "Telurio",
  EnergyComponent: "Fieldrón",
  BioComponent: "Muestra de mutágeno",
  ChemComponent: "Ampolla de detonita",
  BioFragment: "Masa mutagénica",
  Kuva: "Kuva",
  ConcentratedGas: "Hexenón",
  ShrineFragment: "Fragmento de santuario",
  PrimeBucks: "Ducados",
  Eidolonium: "Eidolon",
  SeriglassShard: "Fragmento de seriglass",
  GrokdrulItem: "Grokdrul",
  IraditeItem: "Iradita",
  MapricoFruitItem: "Maprico",
  NistlebrushItem: "Cardo",
  CetusWispItem: "Destello de Cetus",
  EntratiWispItem: "Destello de Entrati",
  FungusHeartItem: "Corazón de hongo",
  CoolantItem: "Refrigerante",
  Hexenon: "Hexenón",
  credits: "Créditos",
};

export function indexRecipes(raw: Record<string, RawRecipe>): RecipeBook {
  const byResult = new Map<string, RawRecipe[]>();
  const byKey = new Map<string, RawRecipe>();
  for (const [key, recipe] of Object.entries(raw)) {
    if (!recipe || typeof recipe !== "object") continue;
    byKey.set(key, recipe);
    const result = recipe.resultType?.trim();
    if (!result) continue;
    const list = byResult.get(result) ?? [];
    list.push(recipe);
    byResult.set(result, list);
  }
  return { byResult, byKey };
}

export function materialsForPart(partId: string, book: RecipeBook): CraftMaterial[] {
  const crafted = book.byResult.get(partId) ?? [];
  const fromComponent = bestRecipe(crafted);
  if (fromComponent) return fromComponent;
  const keyed = book.byKey.get(partId);
  return keyed ? materialEntries(keyed) : [];
}

export function sumMaterials(groups: CraftMaterial[][]): CraftMaterial[] {
  const totals = new Map<string, CraftMaterial>();
  for (const group of groups) {
    for (const material of group) {
      const current = totals.get(material.id);
      if (current) current.count += material.count;
      else totals.set(material.id, { ...material });
    }
  }
  return [...totals.values()].sort((left, right) => {
    if (left.id === "credits") return 1;
    if (right.id === "credits") return -1;
    return right.count - left.count || left.name.localeCompare(right.name, "es");
  });
}

export function formatAmount(count: number) {
  return new Intl.NumberFormat("es-AR").format(count);
}

function bestRecipe(recipes: RawRecipe[]): CraftMaterial[] {
  let best: CraftMaterial[] = [];
  for (const recipe of recipes) {
    const materials = materialEntries(recipe);
    if (materials.length > best.length) best = materials;
  }
  return best;
}

function materialEntries(recipe: RawRecipe): CraftMaterial[] {
  const counts = new Map<string, number>();
  for (const ingredient of recipe.ingredients ?? []) {
    const id = ingredient.ItemType?.trim() ?? "";
    const count = Number(ingredient.ItemCount);
    if (!id || !isMaterial(id) || !Number.isFinite(count) || count <= 0) continue;
    counts.set(id, (counts.get(id) ?? 0) + count);
  }
  const materials = [...counts.entries()].map(([id, count]) => ({
    id,
    name: resourceName(id),
    count,
  }));
  const credits = Number(recipe.buildPrice);
  if (Number.isFinite(credits) && credits > 0) {
    materials.push({ id: "credits", name: "Créditos", count: credits });
  }
  return materials;
}

function isMaterial(path: string) {
  if (path.includes("/Recipes/") || path.includes("/WeaponParts/")) return false;
  if (path.startsWith("/Lotus/Weapons/")) return false;
  return true;
}

function resourceName(path: string) {
  const leaf = path.split("/").pop() ?? path;
  return NAMES[leaf] ?? NAMES[path] ?? readableName(leaf);
}

function readableName(leaf: string) {
  const cleaned = leaf
    .replace(/Item$|Resource$/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .trim();
  return cleaned || leaf;
}
