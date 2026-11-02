const files = ["Warframes", "Primary", "Secondary", "Melee", "Archwing", "Arch-Gun", "Arch-Melee", "Sentinels", "Pets", "SentinelWeapons"];
const langs = ["de", "es", "fr", "it", "ja", "ko", "pl", "pt", "ru", "tc", "th", "tr", "uk", "zh"];
const base = "https://raw.githubusercontent.com/WFCD/warframe-items/master/data/json";

const extraIds = [
  "/Lotus/Types/Vehicles/Hoverboard/HoverboardParts/PartComponents/HoverboardSolarisA/HoverboardSolarisADeck",
  "/Lotus/Types/Vehicles/Hoverboard/HoverboardParts/PartComponents/HoverboardInfestedB/HoverboardInfestedBDeck",
  "/Lotus/Types/Vehicles/Hoverboard/HoverboardParts/PartComponents/HoverboardCorpusA/HoverboardCorpusADeck",
  "/Lotus/Types/Vehicles/Hoverboard/HoverboardParts/PartComponents/HoverboardCorpusB/HoverboardCorpusBDeck",
  "/Lotus/Types/Vehicles/Hoverboard/HoverboardParts/PartComponents/HoverboardCorpusC/HoverboardCorpusCDeck",
  "/Lotus/Types/Game/CrewShip/Plexus/Plexus",
];
const ids = new Set(extraIds);
const misc = await fetch(`${base}/Misc.json`).then((response) => response.json());
for (const item of misc) {
  if (item.type !== "Amp" || /^Mote\b/i.test(item.name ?? "") || !item.uniqueName) continue;
  ids.add(item.uniqueName);
  for (const component of item.components ?? []) {
    if (component.uniqueName) ids.add(component.uniqueName);
  }
}
for (const file of files) {
  const items = await fetch(`${base}/${file}.json`).then((response) => response.json());
  for (const item of items) {
    if (item.uniqueName) ids.add(item.uniqueName);
    for (const component of item.components ?? []) {
      if (component.uniqueName) ids.add(component.uniqueName);
    }
  }
  console.log(file, items.length);
}

const { mkdir, writeFile } = await import("node:fs/promises");
await mkdir("public/i18n", { recursive: true });

for (const lang of langs) {
  const dict = await fetch(`${base}/i18n/${lang}.json`).then((response) => response.json());
  const names = {};
  for (const id of ids) {
    const name = dict[id]?.name;
    if (typeof name === "string" && name && !name.startsWith("/Lotus/")) names[id] = name;
  }
  names["/Lotus/Types/Game/CrewShip/Plexus/Plexus"] = "Plexus";
  await writeFile(`public/i18n/${lang}.json`, JSON.stringify(names));
  const sample = Object.entries(names).filter(([, name]) => /nukor|plasmor/i.test(name)).map(([, name]) => name);
  console.log(lang, Object.keys(names).length, sample.slice(0, 8).join(" | "));
}
