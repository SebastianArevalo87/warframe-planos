const ENDPOINTS = ["cetusCycle", "vallisCycle", "cambionCycle", "zarimanCycle", "duviriCycle", "alerts", "events"] as const;

const MOOD: Record<string, string> = {
  joy: "Alegría",
  anger: "Ira",
  envy: "Envidia",
  sorrow: "Tristeza",
  fear: "Miedo",
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

const REWARD: Record<string, string> = {
  "Raw Rifle Random Mod": "Mod de rifle al azar",
  "Raw Pistol Random Mod": "Mod de pistola al azar",
  "Raw Shotgun Random Mod": "Mod de escopeta al azar",
  "Raw Melee Random Mod": "Mod de cuerpo a cuerpo al azar",
  "Orokin Catalyst": "Catalizador orokin",
  "Orokin Reactor": "Reactor orokin",
  "Forma Blueprint": "Plano de forma",
  "Road To Tau Event Resource": "Recurso del Camino a Tau",
};

const EVENT_TITLE: Record<string, string> = {
  RoadToTauEvent: "Camino a Tau",
  Halloween: "Pesadillas benditas",
  DeimosHalloween: "Noches de Naberus",
};

export type WorldCycle = {
  label: string;
  state: string;
  timeLeft: string;
};

export type WorldNotice = {
  id: string;
  title: string;
  detail: string;
  timeLeft: string;
  ends: number;
};

export type WorldNow = {
  cycles: WorldCycle[];
  mood: string | null;
  circuit: string[];
  incarnon: string[];
  alerts: WorldNotice[];
  events: WorldNotice[];
  hiddenAlerts: number;
};

export function formatTimeLeft(expiry: string, now = Date.now()) {
  const ms = new Date(expiry).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0) return "termina";
  const minutes = Math.ceil(ms / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 48) return rest ? `${hours} h ${rest} min` : `${hours} h`;
  const days = Math.floor(hours / 24);
  const dayHours = hours % 24;
  return dayHours ? `${days} d ${dayHours} h` : `${days} d`;
}

export function readWorld(payloads: unknown[], now = Date.now()): WorldNow {
  const [cetus, vallis, cambion, zariman, duviri, alerts, events] = payloads;
  const cycles = [
    cycle("Cetus", cetus, now, (row) => (row.state === "day" || row.isDay === true ? "Día" : "Noche")),
    cycle("Orb Vallis", vallis, now, (row) => (row.state === "warm" || row.isWarm === true ? "Cálido" : "Frío")),
    cycle("Deimos", cambion, now, (row) => (String(row.state).toLowerCase() === "fass" ? "Fass" : "Vome")),
    cycle("Zariman", zariman, now, (row) => (row.state === "grineer" || row.isCorpus === false ? "Grineer" : "Corpus")),
  ].filter((entry): entry is WorldCycle => entry !== null);

  const spiral = record(duviri);
  const moodKey = typeof spiral?.state === "string" ? spiral.state.toLowerCase() : "";
  const mood = MOOD[moodKey] ?? null;
  if (mood && typeof spiral?.expiry === "string") {
    cycles.push({ label: "Duviri", state: mood, timeLeft: formatTimeLeft(spiral.expiry, now) });
  }

  return {
    cycles,
    mood,
    circuit: choiceNames(spiral, "normal"),
    incarnon: choiceNames(spiral, "hard"),
    ...notices(alerts, events, now),
  };
}

export async function fetchWorld(now = Date.now()): Promise<WorldNow> {
  const payloads = await Promise.all(
    ENDPOINTS.map(async (name) => {
      const response = await fetch(`https://api.warframestat.us/pc/${name}`);
      if (!response.ok) return null;
      return response.json() as Promise<unknown>;
    }),
  );
  if (payloads.every((entry) => entry == null)) throw new Error("worldstate");
  return readWorld(payloads, now);
}

function cycle(label: string, value: unknown, now: number, stateOf: (row: Record<string, unknown>) => string): WorldCycle | null {
  const row = record(value);
  if (!row || typeof row.expiry !== "string") return null;
  return { label, state: stateOf(row), timeLeft: formatTimeLeft(row.expiry, now) };
}

function choiceNames(spiral: Record<string, unknown> | null, category: string) {
  if (!spiral || !Array.isArray(spiral.choices)) return [];
  const group = spiral.choices.find((entry) => record(entry)?.category === category);
  const choices = record(group)?.choices;
  if (!Array.isArray(choices)) return [];
  return choices.filter((name): name is string => typeof name === "string" && name.length > 0);
}

function notices(alerts: unknown, events: unknown, now: number) {
  const alertRows = (Array.isArray(alerts) ? alerts : [])
    .flatMap((entry) => alertNotice(entry, now))
    .sort((left, right) => left.ends - right.ends);
  const eventRows = (Array.isArray(events) ? events : []).flatMap((entry) => eventNotice(entry, now));
  return {
    alerts: alertRows.slice(0, 4).map(stripEnds),
    hiddenAlerts: Math.max(0, alertRows.length - 4),
    events: eventRows.slice(0, 4).map(stripEnds),
  };
}

function alertNotice(value: unknown, now: number): WorldNotice[] {
  const row = record(value);
  const mission = record(row?.mission);
  if (!row || !mission || typeof row.expiry !== "string" || new Date(row.expiry).getTime() <= now) return [];
  const node = typeof mission.node === "string" ? placeName(mission.node) : "";
  const type = typeof mission.type === "string" ? (MISSION[mission.type] ?? mission.type) : "Misión";
  const tag = typeof row.tag === "string" ? row.tag : "";
  const prefix = tag === "LotusGift" ? "Regalo del Loto" : EVENT_TITLE[tag];
  const title = [prefix, node].filter(Boolean).join(" · ") || type;
  return [{ id: String(row.id ?? title), title, detail: `${type} · ${rewardText(mission.reward)}`, timeLeft: formatTimeLeft(row.expiry, now), ends: new Date(row.expiry).getTime() }];
}

function eventNotice(value: unknown, now: number): WorldNotice[] {
  const row = record(value);
  if (!row || typeof row.expiry !== "string" || new Date(row.expiry).getTime() <= now) return [];
  const tag = typeof row.tag === "string" ? row.tag : "";
  const description = typeof row.description === "string" ? row.description.trim() : "";
  const title = EVENT_TITLE[tag] || (/event (name|title|desc)/i.test(description) ? "" : description);
  if (!title) return [];
  const node = typeof row.node === "string" && row.node ? placeName(row.node) : "";
  const health = typeof row.health === "number" ? `progreso ${Math.round(row.health)}%` : "";
  const detail = [node, health].filter(Boolean).join(" · ");
  return [{ id: String(row.id ?? title), title, detail, timeLeft: formatTimeLeft(row.expiry, now), ends: new Date(row.expiry).getTime() }];
}

function rewardText(value: unknown) {
  const reward = record(value);
  if (!reward) return "recompensa";
  const pieces: string[] = [];
  if (Array.isArray(reward.countedItems)) {
    for (const entry of reward.countedItems) {
      const item = record(entry);
      const name = typeof item?.type === "string" ? (REWARD[item.type] ?? item.type) : "";
      const count = Number(item?.count);
      if (!name) continue;
      pieces.push(count > 1 ? `${count.toLocaleString("es-CL")} ${name}` : name);
    }
  }
  const credits = Number(reward.credits);
  if (credits > 0) pieces.push(`${credits.toLocaleString("es-CL")} créditos`);
  return pieces.join(" · ") || "recompensa";
}

const PLACE: Record<string, string> = {
  Earth: "Tierra",
  Mars: "Marte",
  Jupiter: "Júpiter",
  Saturn: "Saturno",
  Uranus: "Urano",
  Neptune: "Neptuno",
  Mercury: "Mercurio",
  Pluto: "Plutón",
};

function placeName(node: string) {
  const planet = node.match(/\(([^)]+)\)$/)?.[1] ?? node;
  const named = PLACE[planet];
  if (!named || named === planet) return node;
  return node.replace(planet, named);
}

function stripEnds(notice: WorldNotice): WorldNotice {
  return { id: notice.id, title: notice.title, detail: notice.detail, timeLeft: notice.timeLeft, ends: 0 };
}

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}
