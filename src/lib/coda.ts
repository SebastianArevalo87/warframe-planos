const EPOCH = Date.parse("2025-03-18T00:00:00Z");
const SLOT = 4 * 24 * 60 * 60 * 1000;
const CYCLE = 8 * 24 * 60 * 60 * 1000;
const WIKI = "https://wiki.warframe.com/w/Coda_Weapons?action=raw";

export type CodaKind = "primary" | "secondary" | "melee";

export type CodaWeapon = {
  name: string;
  kind: CodaKind;
  element: string | null;
  percent: number | null;
};

export type CodaShop = {
  batch: "A" | "B";
  until: number;
  weapons: CodaWeapon[];
  reported: boolean;
};

const STOCK: Record<"A" | "B", Array<{ name: string; kind: CodaKind }>> = {
  A: [
    { name: "Coda Hema", kind: "primary" },
    { name: "Coda Sporothrix", kind: "primary" },
    { name: "Coda Catabolyst", kind: "secondary" },
    { name: "Coda Pox", kind: "secondary" },
    { name: "Dual Coda Torxica", kind: "secondary" },
    { name: "Coda Mire", kind: "melee" },
    { name: "Coda Motovore", kind: "melee" },
  ],
  B: [
    { name: "Coda Bassocyst", kind: "primary" },
    { name: "Coda Bubonico", kind: "primary" },
    { name: "Coda Synapse", kind: "primary" },
    { name: "Coda Tysis", kind: "secondary" },
    { name: "Coda Caustacyst", kind: "melee" },
    { name: "Coda Hirudo", kind: "melee" },
    { name: "Coda Pathocyst", kind: "melee" },
  ],
};

const ELEMENT: Record<string, string> = {
  Impact: "Impacto",
  Puncture: "Perforación",
  Slash: "Cortante",
  Heat: "Calor",
  Cold: "Frío",
  Electricity: "Eléctrico",
  Toxin: "Toxina",
  Magnetic: "Magnético",
  Radiation: "Radiación",
};

const ROW = /<tr><td>([^<]+)<\/td><td>\{\{D\|([^}|]+)\}\}<\/td><td>\{\{ValenceBonusPercentageColor\|([0-9.]+)\}\}<\/td><\/tr>/g;

export function codaElement(element: string) {
  return ELEMENT[element] ?? element;
}

export function codaRotation(now = Date.now()) {
  const elapsed = now - EPOCH;
  const mod = ((elapsed % CYCLE) + CYCLE) % CYCLE;
  const batch: "A" | "B" = Math.floor(mod / SLOT) === 0 ? "A" : "B";
  const until = EPOCH + Math.floor(elapsed / SLOT) * SLOT + SLOT;
  return { batch, until, weapons: STOCK[batch] };
}

export function parseCodaBonuses(source: string, batch: "A" | "B") {
  const split = source.split("Weapon (Batch B)");
  const chunk = batch === "A" ? split[0] : (split[1] ?? "");
  const bonuses = new Map<string, { element: string; percent: number }>();
  for (const match of chunk.matchAll(ROW)) {
    const percent = Number(match[3]);
    if (!Number.isFinite(percent)) continue;
    bonuses.set(match[1].trim().toLowerCase(), { element: match[2].trim(), percent });
  }
  return bonuses;
}

export async function fetchCodaShop(now = Date.now()): Promise<CodaShop> {
  const rotation = codaRotation(now);
  const empty = rotation.weapons.map((weapon) => ({ ...weapon, element: null, percent: null }));
  try {
    const response = await fetch(WIKI, { cache: "no-store" });
    if (!response.ok) return { batch: rotation.batch, until: rotation.until, weapons: empty, reported: false };
    const bonuses = parseCodaBonuses(await response.text(), rotation.batch);
    return {
      batch: rotation.batch,
      until: rotation.until,
      reported: bonuses.size > 0,
      weapons: rotation.weapons.map((weapon) => {
        const bonus = bonuses.get(weapon.name.toLowerCase());
        return bonus ? { ...weapon, element: bonus.element, percent: bonus.percent } : { ...weapon, element: null, percent: null };
      }),
    };
  } catch {
    return { batch: rotation.batch, until: rotation.until, weapons: empty, reported: false };
  }
}
