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
  DamagedMechPartChassisItem: "Carcasa de Necramech dañada",
  DamagedMechPartEngineItem: "Motor de Necramech dañado",
  DamagedMechPartSystemsItem: "Cápsula de Necramech dañada",
  DamagedMechPartWeaponPodItem: "Compartimento de armas de Necramech dañado",
  TitaniumRailjackItem: "Titanio",
  GenericFishScrapItem: "Chatarra",
  DeimosCommonOreAAlloyItem: "Aleación adramal",
  DeimosCommonOreBAlloyItem: "Bafolita templada",
  DeimosUncommonOreAAlloyItem: "Namalon devolucionado",
  DeimosRareOreAAlloyItem: "Destilado táumico",
  DeimosCommonGemACutItem: "Tiametrita facetada",
  DeimosCommonGemBCutItem: "Dagónico purgado",
  DeimosUncommonGemACutItem: "Hecifrón purificado",
  RareGemACutAItem: "Crimzian estelar",
  SolarisUncommonGemACutItem: "Lágrimas de goblita",
  OrbStoneItem: "Teroglobo luciente",
  DeimosOrokinFishAPartItem: "Filtro biótico",
  DeimosOrokinFishBPartItem: "Sección de núcleo espinal",
  DeimosOrokinFishCPartItem: "Proa craneal",
  DeimosInfestedFishGPartItem: "Fauces parásitas",
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

const IMAGE_BASE = "https://cdn.warframestat.us/img/";
const CREDITS_IMAGE = `${IMAGE_BASE}CollectCredits.png`;

export function materialsForPart(
  partId: string,
  book: RecipeBook,
  images: ReadonlyMap<string, string> = new Map(),
  names: ReadonlyMap<string, string> = new Map(),
): CraftMaterial[] {
  const fromComponent = bestRecipe(book.byResult.get(partId) ?? [], images, names);
  if (fromComponent.length > 0) return fromComponent;
  const keyed = book.byKey.get(partId);
  return keyed ? materialEntries(keyed, images, names) : [];
}

export function sumMaterials(groups: CraftMaterial[][]): CraftMaterial[] {
  const totals = new Map<string, CraftMaterial>();
  for (const group of groups) {
    for (const material of group) {
      const current = totals.get(material.id);
      if (current) {
        current.count += material.count;
        if (!current.image && material.image) current.image = material.image;
      } else totals.set(material.id, { ...material });
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

function bestRecipe(
  recipes: RawRecipe[],
  images: ReadonlyMap<string, string>,
  names: ReadonlyMap<string, string>,
): CraftMaterial[] {
  let best: CraftMaterial[] = [];
  for (const recipe of recipes) {
    const materials = materialEntries(recipe, images, names);
    if (materials.length > best.length) best = materials;
  }
  return best;
}

function materialEntries(
  recipe: RawRecipe,
  images: ReadonlyMap<string, string>,
  names: ReadonlyMap<string, string>,
): CraftMaterial[] {
  const counts = new Map<string, number>();
  for (const ingredient of recipe.ingredients ?? []) {
    const id = ingredient.ItemType?.trim() ?? "";
    const count = Number(ingredient.ItemCount);
    if (!id || !isMaterial(id) || !Number.isFinite(count) || count <= 0) continue;
    counts.set(id, (counts.get(id) ?? 0) + count);
  }
  const materials = [...counts.entries()].map(([id, count]) => ({
    id,
    name: resourceName(id, names),
    count,
    image: imageFor(id, images),
  }));
  const credits = Number(recipe.buildPrice);
  if (Number.isFinite(credits) && credits > 0) {
    materials.push({ id: "credits", name: "Créditos", count: credits, image: CREDITS_IMAGE });
  }
  return materials;
}

function imageFor(id: string, images: ReadonlyMap<string, string>): string | null {
  const name = images.get(id)?.trim();
  if (!name) return null;
  return `${IMAGE_BASE}${encodeURIComponent(name)}`;
}

export function isBuiltItem(id: string) {
  return id.startsWith("/Lotus/Weapons/") || id.startsWith("/Lotus/Powersuits/");
}

function isMaterial(path: string) {
  if (path.includes("/Recipes/") || path.includes("/WeaponParts/")) return false;
  return true;
}

function resourceName(path: string, names: ReadonlyMap<string, string>) {
  const leaf = path.split("/").pop() ?? path;
  return NAMES[leaf] ?? NAMES[path] ?? names.get(path) ?? readableName(leaf);
}

function readableName(leaf: string) {
  const cleaned = leaf
    .replace(/Item$|Resource$/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .trim();
  return cleaned || leaf;
}
