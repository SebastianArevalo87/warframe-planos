import { formatTimeLeft } from "./worldstate.ts";

const ES: Record<string, string> = {
  "Shotgun Riven Mod": "Riven de escopeta",
  "Rifle Riven Mod": "Riven de rifle",
  "Kitgun Riven Mod": "Riven de kitgun",
  "Zaw Riven Mod": "Riven de zaw",
  "Umbra Forma Blueprint": "Plano de forma Umbra",
  "50,000 Kuva": "50.000 kuva",
  "3x Forma": "3 formas",
  "30,000 Endo": "30.000 endo",
  "Veiled Riven Cipher": "Cifrado de riven velado",
  "Bishamo Pauldrons Blueprint": "Plano de hombreras Bishamo",
  "Bishamo Cuirass Blueprint": "Plano de coraza Bishamo",
  "Bishamo Helmet Blueprint": "Plano de casco Bishamo",
  "Bishamo Greaves Blueprint": "Plano de grebas Bishamo",
  "10k Kuva": "10.000 kuva",
  "Primary Arcane Adapter": "Adaptador arcano primario",
  "Secondary Arcane Adapter": "Adaptador arcano secundario",
  "Relic Pack": "Paquete de reliquias",
  "Stance Forma Blueprint": "Plano de forma de postura",
  "Trio Orbit Ephermera": "Efímera Órbita en trío",
  "Crania Ephemera": "Efímera Crania",
  "Noggle Statue - Teshin": "Estatua noggle de Teshin",
  "Gauss in Action Glyph": "Glifo de Gauss en acción",
  "Grendel in Action Glyph": "Glifo de Grendel en acción",
  "Protea in Action Glyph": "Glifo de Protea en acción",
  "Xaku in Action Glyph": "Glifo de Xaku en acción",
  "Orokin Tea Set": "Juego de té orokin",
};

export type ShopOffer = {
  id: string;
  name: string;
  detail: string;
  current: boolean;
};

export type Shop = {
  id: "teshin" | "baro" | "varzia" | "darvo";
  name: string;
  place: string;
  timeLeft: string;
  here: boolean;
  offers: ShopOffer[];
  always: ShopOffer[];
};

export type VendorBoard = {
  shops: Shop[];
};

export function offerLabel(name: string, locale: string) {
  if (locale === "es" && ES[name]) return ES[name];
  return tidy(name, locale === "es");
}

export function readVendors(payloads: unknown[], now = Date.now()): VendorBoard {
  const [steel, baro, varzia, darvo] = payloads;
  return {
    shops: [readTeshin(steel, now), readBaro(baro, now), readVarzia(varzia, now), readDarvo(darvo, now)].filter(
      (shop): shop is Shop => shop !== null,
    ),
  };
}

export async function fetchVendors(now = Date.now()): Promise<VendorBoard> {
  const names = ["steelPath", "voidTrader", "vaultTrader", "dailyDeals"] as const;
  const payloads = await Promise.all(
    names.map(async (name) => {
      const response = await fetch(`https://api.warframestat.us/pc/${name}`);
      if (!response.ok) return null;
      return response.json() as Promise<unknown>;
    }),
  );
  if (payloads.every((entry) => entry == null)) throw new Error("vendors");
  return readVendors(payloads, now);
}

function readTeshin(value: unknown, now: number): Shop | null {
  const row = record(value);
  if (!row || typeof row.expiry !== "string") return null;
  const current = typeof record(row.currentReward)?.name === "string" ? String(record(row.currentReward)?.name) : "";
  const offers = (Array.isArray(row.rotation) ? row.rotation : []).flatMap((entry) => steelOffer(entry, current));
  const always = (Array.isArray(row.evergreens) ? row.evergreens : []).flatMap((entry) => steelOffer(entry, ""));
  return {
    id: "teshin",
    name: "Teshin",
    place: "Camino de acero",
    timeLeft: formatTimeLeft(row.expiry, now),
    here: true,
    offers,
    always,
  };
}

function readBaro(value: unknown, now: number): Shop | null {
  const row = record(value);
  if (!row) return null;
  const expiry = typeof row.expiry === "string" ? row.expiry : "";
  const activation = typeof row.activation === "string" ? row.activation : "";
  const here = Boolean(expiry) && new Date(expiry).getTime() > now && new Date(activation).getTime() <= now;
  const when = here ? expiry : activation;
  return {
    id: "baro",
    name: "Baro Ki'Teer",
    place: placeName(typeof row.location === "string" ? row.location : ""),
    timeLeft: when ? formatTimeLeft(when, now) : "",
    here,
    offers: (Array.isArray(row.inventory) ? row.inventory : []).flatMap(baroOffer),
    always: [],
  };
}

function readVarzia(value: unknown, now: number): Shop | null {
  const row = record(value);
  if (!row || typeof row.expiry !== "string") return null;
  const here = new Date(row.expiry).getTime() > now;
  return {
    id: "varzia",
    name: "Varzia",
    place: placeName(typeof row.location === "string" ? row.location : ""),
    timeLeft: formatTimeLeft(row.expiry, now),
    here,
    offers: (Array.isArray(row.inventory) ? row.inventory : []).flatMap(varziaOffer),
    always: [],
  };
}

function readDarvo(value: unknown, now: number): Shop | null {
  const rows = Array.isArray(value) ? value : [];
  const row = rows.map(record).find((entry) => entry && typeof entry.expiry === "string" && new Date(entry.expiry).getTime() > now);
  if (!row || typeof row.expiry !== "string") return null;
  const name = typeof row.item === "string" ? row.item : "Oferta";
  const id = typeof row.uniqueName === "string" ? row.uniqueName : name;
  const total = Number(row.total);
  const sold = Number(row.sold);
  const discount = Number(row.discount);
  const gone = Number.isFinite(total) && Number.isFinite(sold) && sold >= total;
  const cut = Number.isFinite(discount) ? `−${discount}%` : "";
  return {
    id: "darvo",
    name: "Darvo",
    place: "Relés",
    timeLeft: formatTimeLeft(row.expiry, now),
    here: true,
    offers: [{ id, name, detail: [gone ? "agotado" : "", cut].filter(Boolean).join(" · "), current: true }],
    always: [],
  };
}

function steelOffer(value: unknown, current: string): ShopOffer[] {
  const row = record(value);
  const name = typeof row?.name === "string" ? row.name : "";
  const cost = Number(row?.cost);
  if (!name) return [];
  return [{ id: name, name, detail: Number.isFinite(cost) ? `${cost} esencia` : "", current: name === current }];
}

function baroOffer(value: unknown): ShopOffer[] {
  const row = record(value);
  const name = typeof row?.item === "string" ? row.item : "";
  if (!name) return [];
  const ducats = Number(row?.ducats);
  const credits = Number(row?.credits);
  const detail = [
    Number.isFinite(ducats) ? `${ducats.toLocaleString("es-CL")} ducados` : "",
    Number.isFinite(credits) && credits > 0 ? `${credits.toLocaleString("es-CL")} cr` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return [{ id: name, name, detail, current: false }];
}

function varziaOffer(value: unknown): ShopOffer[] {
  const row = record(value);
  const name = typeof row?.item === "string" ? row.item : "";
  if (!name) return [];
  const id = typeof row?.uniqueName === "string" ? row.uniqueName : name;
  const aya = Number(row?.ducats);
  return [{ id, name, detail: Number.isFinite(aya) ? `${aya} aya regia` : "", current: false }];
}

function tidy(name: string, spanish: boolean) {
  const dual = name.match(/^M P V (.+) Prime Dual Pack$/);
  if (dual) {
    const parts = dual[1].split(" ");
    if (parts.length === 2) return `${parts[0]} Prime y ${parts[1]} Prime`;
  }
  const single = name.replace(/^M P V /, "").replace(/ Single Pack$/, "");
  if (!spanish) return single;
  return single.replace(/ Scene$/, " · escena").replace(/ Syandana$/, " · syandana");
}

function placeName(value: string) {
  return value
    .replace("Kronia Relay", "Relé de Kronia")
    .replace("Saturn", "Saturno")
    .replace("Maroo's Bazaar", "Bazar de Maroo")
    .replace("Mars", "Marte");
}

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}
