import type { CraftMaterial, PartRelic } from "../types.ts";

type Gap = {
  relics: PartRelic[];
  materials?: CraftMaterial[];
};

const open = (name: string, rarity: PartRelic["rarity"]): PartRelic => ({ name, rarity, vaulted: false });

const IMG = "https://cdn.warframestat.us/img/";

function material(id: string, name: string, count: number, image: string): CraftMaterial {
  return { id, name, count, image: `${IMG}${image}` };
}

const credits = (count: number) => material("credits", "Créditos", count, "CollectCredits.png");
const cell = (count: number) => material("/Lotus/Types/Items/MiscItems/OrokinCell", "Célula orokin", count, "ComponentCell.png");

const GAPS: Record<string, Gap> = {
  "/Lotus/Types/Recipes/WarframeRecipes/CitrinePrimeBlueprint": {
    relics: [open("Meso C11", "rare")],
    materials: [cell(5), credits(25000)],
  },
  "/Lotus/Types/Recipes/WarframeRecipes/CitrinePrimeChassisComponent": {
    relics: [open("Neo C11", "common")],
    materials: [
      material("/Lotus/Types/Items/MiscItems/Alertium", "Extracto de nitain", 2, "Alertium.png"),
      material("/Lotus/Types/Items/MiscItems/ControlModule", "Módulo de control", 10, "ControlModule.png"),
      material("/Lotus/Types/Items/MiscItems/Rubedo", "Rubedo", 1600, "ComponentRubedo.png"),
      material("/Lotus/Types/Items/MiscItems/Salvage", "Chatarra", 7800, "ComponentSalvage.png"),
      credits(15000),
    ],
  },
  "/Lotus/Types/Recipes/WarframeRecipes/CitrinePrimeHelmetComponent": {
    relics: [open("Axi C12", "rare")],
    materials: [
      material("/Lotus/Types/Items/MiscItems/Neurode", "Neurodos", 4, "ComponentNeurode.png"),
      material("/Lotus/Types/Items/MiscItems/Circuits", "Circuitos", 1750, "ComponentCircuits.png"),
      material("/Lotus/Types/Items/MiscItems/Plastids", "Plástidos", 450, "ComponentPlastids.png"),
      material("/Lotus/Types/Items/MiscItems/Nanospores", "Nanoesporas", 4750, "ComponentNanospores.png"),
      credits(15000),
    ],
  },
  "/Lotus/Types/Recipes/WarframeRecipes/CitrinePrimeSystemsComponent": {
    relics: [open("Lith S19", "uncommon")],
    materials: [
      material("/Lotus/Types/Items/MiscItems/ArgonCrystal", "Cristal de argón", 2, "ArgonCrystal.png"),
      material("/Lotus/Types/Items/MiscItems/NeuralSensor", "Sensores neuronales", 5, "NeuralSensor.png"),
      material("/Lotus/Types/Items/MiscItems/PolymerBundle", "Paquete de polímero", 1775, "PolymerBundle.png"),
      material("/Lotus/Types/Items/MiscItems/Ferrite", "Ferrita", 4000, "ComponentFerrite.png"),
      credits(15000),
    ],
  },
  "/Lotus/Types/Recipes/Weapons/CorufellPrimeBlueprint": {
    relics: [open("Meso V17", "common")],
    materials: [cell(15), credits(15000)],
  },
  "/Lotus/Types/Recipes/Weapons/WeaponParts/CorufellPrimeHandle": {
    relics: [open("Axi C12", "uncommon")],
  },
  "/Lotus/Types/Recipes/Weapons/WeaponParts/CorufellPrimeReceiver": {
    relics: [open("Neo C10", "rare")],
  },
  "/Lotus/Types/Recipes/Weapons/WeaponParts/CorufellPrimeBarrel": {
    relics: [open("Lith C15", "common")],
  },
  "/Lotus/Types/Recipes/Weapons/SteflosPrimeBlueprint": {
    relics: [open("Neo Y2", "uncommon")],
    materials: [cell(10), credits(15000)],
  },
  "/Lotus/Types/Recipes/Weapons/WeaponParts/SteflosPrimeBarrel": {
    relics: [open("Axi S21", "rare")],
  },
  "/Lotus/Types/Recipes/Weapons/WeaponParts/SteflosPrimeReceiver": {
    relics: [open("Lith A13", "common")],
  },
  "/Lotus/Types/Recipes/Weapons/WeaponParts/SteflosPrimeStock": {
    relics: [open("Meso D9", "uncommon")],
  },
};

export function fillPublishedGaps<T extends { id: string; relics: PartRelic[]; materials: CraftMaterial[] }>(part: T) {
  const gap = GAPS[part.id];
  if (!gap) return;
  if (part.relics.length === 0) part.relics = gap.relics;
  if (part.materials.length === 0 && gap.materials) part.materials = gap.materials;
}
