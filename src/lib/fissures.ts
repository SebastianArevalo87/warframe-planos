import { formatTimeLeft } from "./worldstate.ts";

export type FarmFissure = {
  id: string;
  node: string;
  tier: string;
  mission: string;
  hard: boolean;
  timeLeft: string;
  ends: number;
};

const MISSION: Record<string, string> = {
  Extermination: "Exterminio",
  Survival: "Supervivencia",
  Defense: "Defensa",
  "Mobile Defense": "Defensa móvil",
  Sabotage: "Sabotaje",
  Capture: "Captura",
  Rescue: "Rescate",
  Spy: "Espionaje",
  Hive: "Colmena",
  Interception: "Interceptación",
  Excavation: "Excavación",
  Disruption: "Disrupción",
  Assassination: "Asesinato",
  Skirmish: "Escaramuza",
  Alchemy: "Alquimia",
  "Void Flood": "Diluvio del Vacío",
  "Void Cascade": "Cascada del Vacío",
  "Void Armageddon": "Armagedón del Vacío",
};

const ERAS = new Set(["Lith", "Meso", "Neo", "Axi", "Requiem"]);

export function relicEra(name: string) {
  const era = name.trim().split(/\s+/)[0] ?? "";
  return ERAS.has(era) ? era : null;
}

export function fissureMatches(tier: string, era: string) {
  if (tier === era) return true;
  return tier === "Omnia" && era !== "Requiem";
}

export async function fetchFissures(now = Date.now()): Promise<FarmFissure[]> {
  const response = await fetch("https://api.warframestat.us/pc/fissures");
  if (!response.ok) throw new Error("fissures");
  const payload = (await response.json()) as unknown;
  if (!Array.isArray(payload)) return [];
  return payload
    .flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const row = entry as Record<string, unknown>;
      if (typeof row.expiry !== "string" || typeof row.id !== "string") return [];
      const ends = new Date(row.expiry).getTime();
      if (!Number.isFinite(ends) || ends <= now) return [];
      const tier = typeof row.tier === "string" ? row.tier : "";
      const node = typeof row.node === "string" ? row.node : "";
      const missionKey = typeof row.missionType === "string" ? row.missionType : "";
      if (!tier || !node) return [];
      return [
        {
          id: row.id,
          node,
          tier,
          mission: MISSION[missionKey] ?? (missionKey || "Misión"),
          hard: row.isHard === true,
          timeLeft: formatTimeLeft(row.expiry, now),
          ends,
        },
      ];
    })
    .sort((left, right) => left.ends - right.ends);
}
