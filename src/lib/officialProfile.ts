import type { Collection, ProfileDossier, ProfileIntrinsic, ProfileSyndicate } from "../types.ts";
import { supabase } from "./supabase.ts";

const PLEXUS_FROM = "/Lotus/Types/Game/CrewShip/RailJack/DefaultHarness";
const PLEXUS_TO = "/Lotus/Types/Game/CrewShip/Plexus/Plexus";

const SYNDICATES: Record<string, string> = {
  ArbitersSyndicate: "Árbitros de Hexis",
  CephalonSudaSyndicate: "Céfalon Suda",
  PerrinSyndicate: "La Secuencia Perrin",
  RedVeilSyndicate: "Velo Rojo",
  NewLokaSyndicate: "Nueva Loka",
  SteelMeridianSyndicate: "Meridiano de Acero",
  ConclaveSyndicate: "Cónclave",
  LibrarySyndicate: "Céfalon Simaris",
  CetusSyndicate: "Ostron",
  QuillsSyndicate: "Los Quills",
  VentKidsSyndicate: "Ventkids",
  SolarisSyndicate: "Solaris Unida",
  VoxSyndicate: "Vox Solaris",
  EntratiSyndicate: "Entrati",
  NecraloidSyndicate: "Necraloide",
  ZarimanSyndicate: "Los Inquebrantables",
  KahlSyndicate: "Kahl",
  EntratiLabSyndicate: "Cavia",
  HexSyndicate: "El Hex",
};

const MARKS: [RegExp, string][] = [
  [/stalker/i, "Acechador"],
  [/zanuka/i, "Cazador Zanuka"],
  [/grustrag|grineerdeathsquad/i, "Tres de Grustrag"],
  [/wolf/i, "El Lobo"],
  [/acolyte/i, "Acólito"],
];

export type OfficialProfile = {
  accountId: string;
  displayName: string;
  rank: number;
  clan: string;
  clanTier: number | null;
  created: string;
  nodes: number;
  steel: number;
  intrinsics: ProfileIntrinsic;
  syndicates: ProfileSyndicate[];
  alignment: { value: number; wisdom: number };
  marks: string[];
  founder: boolean;
  timePlayedSec: number;
  missionsCompleted: number;
  missionsFailed: number;
  gear: { id: string; xp: number }[];
};

export function itemRank(xp: number) {
  if (!Number.isFinite(xp) || xp <= 0) return 0;
  const rank = Math.floor((-1 + Math.sqrt(1 + (8 * xp) / 1000)) / 2);
  return Math.max(0, Math.min(40, rank));
}

export function syndicateName(tag: string) {
  return SYNDICATES[tag] ?? "";
}

export function markLabel(value: string) {
  for (const [pattern, label] of MARKS) if (pattern.test(value)) return label;
  const tail = value.split("/").pop() ?? value;
  return tail.replace(/([a-z])([A-Z])/g, "$1 $2");
}

export function alignmentLabel(value: number) {
  if (value >= 0.2) return "Sol";
  if (value <= -0.2) return "Luna";
  return "En el medio";
}

export async function fetchOfficialProfile(accountId: string): Promise<OfficialProfile> {
  if (!supabase) throw new Error("La lista no está conectada.");
  const { data, error } = await supabase.functions.invoke("warframe-profile", {
    body: { playerId: accountId },
  });
  const payload = data as (OfficialProfile & { error?: string }) | null;
  if (payload?.error === "slow") throw new Error("El perfil oficial pidió una pausa. Espera unos minutos y vuelve a cargarlo.");
  if (payload?.error === "missing") throw new Error("No encontré un perfil público con ese id.");
  if (error || !payload?.displayName || !Array.isArray(payload.gear)) {
    throw new Error("No pude consultar el perfil oficial.");
  }
  return payload;
}

export function applyOfficialProfile(collection: Collection, known: Set<string>, profile: OfficialProfile) {
  const mastered = new Set(collection.mastered);
  const leveled = new Set(collection.leveled);
  const built = new Set(collection.built);
  let addedMastered = 0;
  let addedLeveled = 0;
  for (const row of profile.gear) {
    const id = row.id === PLEXUS_FROM && known.has(PLEXUS_TO) ? PLEXUS_TO : row.id;
    if (!known.has(id)) continue;
    const rank = itemRank(row.xp);
    if (rank >= 30) {
      if (!mastered.has(id)) addedMastered += 1;
      mastered.add(id);
      leveled.delete(id);
      built.add(id);
    } else if (rank >= 1 && !mastered.has(id)) {
      if (!leveled.has(id)) addedLeveled += 1;
      leveled.add(id);
    }
  }
  const dossier: ProfileDossier = {
    accountId: profile.accountId,
    displayName: profile.displayName,
    rank: profile.rank,
    clan: profile.clan,
    clanTier: profile.clanTier,
    created: profile.created,
    nodes: profile.nodes,
    steel: profile.steel,
    intrinsics: profile.intrinsics,
    syndicates: profile.syndicates.filter((row) => syndicateName(row.tag)),
    alignment: profile.alignment,
    marks: profile.marks,
    founder: profile.founder,
    timePlayedSec: profile.timePlayedSec,
    missionsCompleted: profile.missionsCompleted,
    missionsFailed: profile.missionsFailed,
    loadedAt: new Date().toISOString(),
  };
  const next: Collection = {
    ...collection,
    mastered: [...mastered],
    leveled: [...leveled].filter((id) => !mastered.has(id)),
    built: [...built],
    dossier,
  };
  const fresh = addedMastered === 0 && addedLeveled === 0 ? "Ya estaba todo en tu lista." : `Sumé ${addedMastered} dominados y ${addedLeveled} subidos.`;
  const clan = profile.clan ? ` Clan ${profile.clan}.` : "";
  const summary = `Perfil de ${profile.displayName}, rango ${profile.rank}. ${fresh}${clan} Mapa estelar ${profile.nodes}, camino de acero ${profile.steel}.`;
  return { collection: next, summary };
}
