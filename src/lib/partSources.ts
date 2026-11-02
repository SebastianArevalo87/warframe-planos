export type SourcedPart = {
  lines: string[];
  market: string | null;
};

export type ItemSources = {
  byId: Record<string, SourcedPart>;
  byName: Record<string, SourcedPart>;
  wiki: string | null;
};

const PLANET: Record<string, string> = {
  Earth: "Tierra",
  Mars: "Marte",
  Jupiter: "Júpiter",
  Saturn: "Saturno",
  Uranus: "Urano",
  Neptune: "Neptuno",
  Pluto: "Plutón",
  Phobos: "Fobos",
  "Kuva Fortress": "Fortaleza Kuva",
  Void: "Vacío",
};

const MODE: Record<string, string> = {
  Assassination: "Asesinato",
  Survival: "Supervivencia",
  Spy: "Espionaje",
  Defense: "Defensa",
  Disruption: "Disrupción",
  Skirmish: "Escaramuza",
  Defection: "Defección",
  "Infested Salvage": "Rescate infestado",
  Caches: "Cofres",
  "Shrine Defense": "Defensa del santuario",
  Excavation: "Excavación",
  Interception: "Interceptación",
  Capture: "Captura",
  "Mobile Defense": "Defensa móvil",
  Sabotage: "Sabotaje",
  Rescue: "Rescate",
  Exterminate: "Exterminio",
  Hive: "Colmena",
  Alchemy: "Alquimia",
};

const cache = new Map<string, Promise<ItemSources | null>>();

export function fetchItemSources(name: string): Promise<ItemSources | null> {
  const key = name.trim().toLowerCase();
  const saved = cache.get(key);
  if (saved) return saved;
  const pending = loadItemSources(name).catch(() => null);
  cache.set(key, pending);
  return pending;
}

async function loadItemSources(name: string): Promise<ItemSources | null> {
  const response = await fetch(`https://api.warframestat.us/items/${encodeURIComponent(name)}`);
  if (!response.ok) return null;
  const payload = (await response.json()) as unknown;
  const item = Array.isArray(payload) ? payload[0] : payload;
  if (!item || typeof item !== "object") return null;
  return readSources(item as RawItem);
}

type RawDrop = { location?: unknown; chance?: unknown };
type RawComponent = { uniqueName?: unknown; name?: unknown; type?: unknown; drops?: unknown };
type RawItem = { components?: unknown; bpCost?: unknown; wikiaUrl?: unknown; wikiAvailable?: unknown };

function readSources(item: RawItem): ItemSources {
  const components = componentsOf(item);
  const byId: Record<string, SourcedPart> = {};
  const byName: Record<string, SourcedPart> = {};
  const siblingsHaveDrops = components.some((part) => part.name !== "Blueprint" && bestDrops(part.drops).length > 0);
  for (const part of components) {
    const lines = bestDrops(part.drops).map((drop) => speak(drop.location, drop.chance));
    const market =
      part.name === "Blueprint" && lines.length === 0 && siblingsHaveDrops && typeof item.bpCost === "number"
        ? `Cómpralo en el mercado del orbitador por ${item.bpCost.toLocaleString("es")} créditos.`
        : null;
    const sourced = { lines, market };
    if (part.id) byId[part.id] = sourced;
    if (part.name) byName[part.name] = sourced;
  }
  const wiki = typeof item.wikiaUrl === "string" && item.wikiAvailable !== false ? item.wikiaUrl : null;
  return { byId, byName, wiki };
}

function componentsOf(item: RawItem): Array<{ id: string; name: string; drops: RawDrop[] }> {
  if (!Array.isArray(item.components)) return [];
  const parts: Array<{ id: string; name: string; drops: RawDrop[] }> = [];
  for (const entry of item.components) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as RawComponent;
    const id = typeof row.uniqueName === "string" ? row.uniqueName : "";
    const name = typeof row.name === "string" ? row.name : "";
    if (!isBlueprintPart(id, name, row.type)) continue;
    parts.push({ id, name, drops: Array.isArray(row.drops) ? (row.drops as RawDrop[]) : [] });
  }
  return parts;
}

function isBlueprintPart(id: string, name: string, type: unknown) {
  if (type === "Resource") return false;
  if (id.includes("/Items/MiscItems/") || id.includes("/Research/")) return false;
  if (name === "Blueprint" || name === "Chassis" || name === "Neuroptics" || name === "Systems") return true;
  return /Blueprint|Component/.test(id);
}

function bestDrops(drops: RawDrop[]) {
  const ranked = drops
    .flatMap((drop) => {
      if (typeof drop.location !== "string" || /conclave/i.test(drop.location)) return [];
      const chance = typeof drop.chance === "number" ? drop.chance : 0;
      if (chance <= 0) return [];
      return [{ location: drop.location, chance }];
    })
    .sort((a, b) => b.chance - a.chance);
  const picked: Array<{ location: string; chance: number }> = [];
  for (const drop of ranked) {
    const key = drop.location.replace(/,?\s*Rotation [ABC]/i, "").trim();
    if (picked.some((item) => item.location.replace(/,?\s*Rotation [ABC]/i, "").trim() === key)) continue;
    picked.push(drop);
    if (picked.length === 2) break;
  }
  return picked;
}

function planetName(name: string) {
  return PLANET[name.trim()] ?? name.trim();
}

function speak(location: string, chance: number) {
  const rotation = location.match(/Rotation ([ABC])/i);
  const turn = rotation ? `, rotación ${rotation[1]}` : "";
  const body = location.replace(/,?\s*Rotation [ABC]/i, "").trim();
  const percent = `${Math.round(chance)}%`;
  const bounty = body.match(/^(?:([^/]+)\/)?(.+?) \(Level\s+(\d+)\s*-\s*(\d+)\s+.+\)$/i);
  if (bounty) {
    const planet = bounty[1]?.trim();
    const where = bounty[2].trim();
    const place = planet ? `${where}, ${planetName(planet)}` : where;
    return `Contrato en ${place}, nivel ${bounty[3]}-${bounty[4]}${turn} · ${percent}`;
  }
  const node = body.match(/^([^/]+)\/([^()]+?) \((.+)\)$/);
  if (node) {
    const mode = MODE[node[3].trim()] ?? node[3].trim();
    return `${mode} en ${node[2].trim()}, ${planetName(node[1])}${turn} · ${percent}`;
  }
  return `${body}${turn} · ${percent}`;
}
