export type PlaceReward = {
  english: string;
  chance: number;
};

export type CatalogDrop = {
  partId: string;
  itemId: string;
  itemName: string;
  partTitle: string;
  english: string;
  image: string | null;
};

const cache = new Map<string, Promise<PlaceReward[]>>();

export function placeKey(location: string) {
  return location.replace(/,?\s*Rotation [ABC]/i, "").trim();
}

export function parsePlace(location: string) {
  const body = placeKey(location);
  const match = body.match(/^([^/]+)\/([^()]+?) \((.+)\)$/);
  if (!match) return null;
  return { planet: match[1].trim(), node: match[2].trim(), place: body };
}

export function rewardKey(name: string) {
  return name
    .toLowerCase()
    .replace(/\s+blueprint$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function fetchPlaceRewards(location: string): Promise<PlaceReward[]> {
  const parsed = parsePlace(location);
  if (!parsed) return Promise.resolve([]);
  const key = `${parsed.planet}/${parsed.node}`;
  const saved = cache.get(key);
  if (saved) return saved;
  const pending = loadPlaceRewards(parsed.planet, parsed.node).catch(() => []);
  cache.set(key, pending);
  return pending;
}

async function loadPlaceRewards(planet: string, node: string): Promise<PlaceReward[]> {
  const response = await fetch(
    `https://drops.warframestat.us/data/missionRewards/${encodeURIComponent(planet)}/${encodeURIComponent(node)}.json`,
  );
  if (!response.ok) return [];
  const payload = (await response.json()) as unknown;
  if (!payload || typeof payload !== "object") return [];
  const rewards = (payload as { rewards?: unknown }).rewards;
  if (!Array.isArray(rewards)) return [];
  const rows: PlaceReward[] = [];
  for (const entry of rewards) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as { itemName?: unknown; chance?: unknown };
    if (typeof row.itemName !== "string" || !/blueprint$/i.test(row.itemName)) continue;
    const chance = typeof row.chance === "number" ? row.chance : 0;
    if (chance <= 0) continue;
    rows.push({ english: row.itemName, chance });
  }
  return rows;
}

export function matchReward(reward: string, parts: CatalogDrop[]) {
  const key = rewardKey(reward);
  if (!key) return [];
  const weapon = key.split(" ")[0] ?? "";
  const matched = parts.filter((part) => rewardKey(part.english) === key);
  if (matched.length <= 1) return matched;
  const named = matched.filter((part) => part.itemName.toLowerCase().startsWith(weapon));
  return named.length > 0 ? named : matched;
}
