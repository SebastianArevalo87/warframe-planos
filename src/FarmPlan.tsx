import { useEffect, useMemo, useState } from "react";
import { fetchItemIndex } from "./lib/catalogRemote.ts";
import { fetchItemSources, type ItemSources } from "./lib/partSources.ts";
import { fissureMatches, fetchFissures, relicEra, type FarmFissure } from "./lib/fissures.ts";
import { fetchPlaceRewards, matchReward, placeKey, type CatalogDrop } from "./lib/missionDrops.ts";
import { vendorOffer } from "./lib/vendorOffers.ts";
import { supabase } from "./lib/supabase.ts";
import { craftKey } from "./lib/collection.ts";
import { MaterialList } from "./MaterialTotals.tsx";
import { useNames } from "./Locale.tsx";
import type { Collection, CraftMaterial, PartRelic, RelicRarity } from "./types.ts";

type PlanPart = {
  id: string;
  short: string;
  title: string;
  english: string;
  image: string | null;
  relics: PartRelic[];
  materials: CraftMaterial[];
};

type PlanItem = {
  id: string;
  name: string;
  image: string | null;
  parts: PlanPart[];
};

type DropChance = {
  partId: string;
  itemId: string;
  itemName: string;
  partTitle: string;
  image: string | null;
  amount: number;
  bonus: boolean;
};

type DropRoute = {
  key: string;
  title: string;
  kind: "mission" | "fissure";
  detail: string;
  chances: DropChance[];
};

type CatchPart = {
  partId: string;
  itemId: string;
  itemName: string;
  partTitle: string;
  english: string;
  image: string | null;
  bonus: boolean;
};

const RARITY: Record<RelicRarity, string> = {
  common: "común",
  uncommon: "poco común",
  rare: "raro",
};

export function FarmPlan({
  goals,
  collection,
  onOpen,
  onRemove,
  onPartQty,
  onToggleBuilt,
  onToggleCrafted,
}: {
  goals: string[];
  collection: Collection;
  onOpen: (id: string) => void;
  onRemove: (id: string) => void;
  onPartQty: (partId: string, next: number) => void;
  onToggleBuilt: (id: string) => void;
  onToggleCrafted: (itemId: string, partId: string) => void;
}) {
  const names = useNames();
  const [items, setItems] = useState<PlanItem[]>([]);
  const [known, setKnown] = useState<Set<string>>(new Set());
  const [sources, setSources] = useState<Record<string, ItemSources>>({});
  const [sourcesReady, setSourcesReady] = useState(false);
  const [fissures, setFissures] = useState<FarmFissure[]>([]);
  const [sideDrops, setSideDrops] = useState<Record<string, CatalogDrop[]>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase || goals.length === 0) {
      setItems([]);
      return;
    }
    let cancelled = false;
    void Promise.all([
      supabase.from("catalog_parts").select("id, item_id, short, title, english, image, relics, materials, catalog_items(name, image)").in("item_id", goals),
      fetchItemIndex(),
    ])
      .then(([parts, index]) => {
        if (cancelled) return;
        if (parts.error) throw parts.error;
        setKnown(new Set(index.map((row) => row.id)));
        setItems(groupPlans((parts.data ?? []) as unknown[], goals));
      })
      .catch(() => {
        if (!cancelled) setError("No pude armar el plan.");
      });
    return () => {
      cancelled = true;
    };
  }, [goals]);

  useEffect(() => {
    const pending = items.filter((item) => item.parts.some((part) => part.relics.length === 0));
    if (pending.length === 0) {
      setSources({});
      setSourcesReady(true);
      return;
    }
    let cancelled = false;
    setSourcesReady(false);
    void Promise.all(pending.map(async (item) => [item.id, await fetchItemSources(item.name)] as const)).then((rows) => {
      if (cancelled) return;
      const next: Record<string, ItemSources> = {};
      for (const [id, source] of rows) {
        if (source) next[id] = source;
      }
      setSources(next);
      setSourcesReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [items]);

  useEffect(() => {
    const needsFissures = items.some((item) => item.parts.some((part) => part.relics.some((relic) => !relic.vaulted)));
    if (!needsFissures) {
      setFissures([]);
      return;
    }
    let cancelled = false;
    const load = () => {
      void fetchFissures()
        .then((next) => {
          if (!cancelled) setFissures(next);
        })
        .catch(() => {
          if (!cancelled) setFissures([]);
        });
    };
    load();
    const timer = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [items]);

  useEffect(() => {
    if (!sourcesReady || !supabase) {
      setSideDrops({});
      return;
    }
    const places = new Set<string>();
    for (const item of items) {
      for (const part of item.parts) {
        const finalPiece = part.short === "Plano" && item.parts.length > 1;
        const source = partSource(sources[item.id], part.id, part.short, finalPiece);
        for (const place of source?.places ?? []) places.add(placeKey(place));
      }
    }
    if (places.size === 0) {
      setSideDrops({});
      return;
    }
    let cancelled = false;
    void loadSideDrops([...places], new Set(items.flatMap((item) => item.parts.map((part) => part.id)))).then((next) => {
      if (!cancelled) setSideDrops(next);
    });
    return () => {
      cancelled = true;
    };
  }, [items, sources, sourcesReady]);

  const routes = useMemo(
    () => buildRoutes(items, sources, fissures, sideDrops, collection.qty),
    [items, sources, fissures, sideDrops, collection.qty],
  );

  const catchList = useMemo(() => {
    const byId = new Map<string, CatchPart>();
    for (const item of items) {
      for (const part of item.parts) {
        byId.set(part.id, {
          partId: part.id,
          itemId: item.id,
          itemName: item.name,
          partTitle: part.title,
          english: part.english,
          image: part.image,
          bonus: false,
        });
      }
    }
    for (const extras of Object.values(sideDrops)) {
      for (const part of extras) {
        if (byId.has(part.partId)) continue;
        byId.set(part.partId, {
          partId: part.partId,
          itemId: part.itemId,
          itemName: part.itemName,
          partTitle: part.partTitle,
          english: part.english,
          image: part.image,
          bonus: true,
        });
      }
    }
    return [...byId.values()];
  }, [items, sideDrops]);

  if (goals.length === 0) {
    return <p className="text-sm text-mute">En Marcar, pulsa Farmear en lo que te falte. Aquí queda el camino de cada plano.</p>;
  }
  if (error) return <p className="text-sm text-clay">{error}</p>;
  if (items.length === 0) return <p className="text-sm text-mute">Armando el plan…</p>;

  const built = new Set(collection.built);
  const mastered = new Set(collection.mastered);

  return (
    <div className="flex flex-col gap-4">
      <DropCatcher parts={catchList} qty={collection.qty} onCatch={onPartQty} />
      {routes.length > 0 && (
        <section className="rounded-2xl border border-gold/30 bg-panel p-4">
          <h3 className="text-sm font-medium text-bone">Dónde cae ahora</h3>
          <p className="mt-1 text-xs text-mute">Etapas y fisuras de tu farmeo, y otros planos que también pueden caer ahí. Márcalo cuando te caiga.</p>
          <ul className="mt-3 flex flex-col gap-3">
            {routes.map((route) => (
              <li key={route.key} className="rounded-xl border border-line/80 px-3 py-2">
                <p className="text-sm text-bone">{route.title}</p>
                <p className="text-xs text-mute">{route.detail}</p>
                <ul className="mt-2 flex flex-col gap-2">
                  {route.chances.map((chance) => {
                    const label = names.part(chance.partId, chance.partTitle, chance.itemId, chance.itemName);
                    const state = chance.amount > 0 ? "en el inventario" : chance.bonus ? "también cae aquí" : "posible drop";
                    return (
                      <li key={`${route.key}-${chance.partId}`} className="flex flex-wrap items-center gap-2">
                        {chance.image && <img src={chance.image} alt="" className="h-7 w-7 object-contain" />}
                        <span className="min-w-0 flex-1 text-sm text-bone">{label}</span>
                        <span className="text-xs text-mute">{state}</span>
                        <button
                          type="button"
                          onClick={() => onPartQty(chance.partId, Math.min(99, chance.amount + 1))}
                          className="rounded-full border border-gold px-2.5 py-1 text-xs text-gold hover:bg-gold/10"
                        >
                          Me cayó
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}
      {items.map((item) => {
        const label = names.item(item.id, item.name);
        const done = built.has(item.id) || mastered.has(item.id);
        return (
          <article key={item.id} className="rounded-2xl border border-line bg-panel p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button type="button" onClick={() => onOpen(item.id)} className="flex min-w-0 items-center gap-3 text-left">
                {item.image && <img src={item.image} alt="" className="h-14 w-14 rounded-xl bg-ink object-contain" />}
                <span className="truncate text-lg text-bone">{label}</span>
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onToggleBuilt(item.id)}
                  className={done ? "rounded-full border border-moss/40 px-3 py-1.5 text-sm text-moss" : "rounded-full border border-line px-3 py-1.5 text-sm text-bone hover:border-gold"}
                >
                  {done ? "Construido" : "Ya lo construí"}
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  className="rounded-full border border-gold px-3 py-1.5 text-sm text-gold hover:bg-gold/10"
                  title="Lo saca del plan de farmeo"
                >
                  Ya lo farmeé
                </button>
              </div>
            </div>
            <ul className="mt-4 flex flex-col gap-3">
              {item.parts.map((part) => {
                const amount = collection.qty[part.id] ?? 0;
                const crafted = collection.crafted.includes(craftKey(item.id, part.id));
                const finalPiece = part.short === "Plano" && item.parts.length > 1;
                const pieceDone = finalPiece ? done : crafted;
                const partLabel = names.part(part.id, part.title, item.id, item.name);
                return (
                  <li key={part.id} className="rounded-xl border border-line/80 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {part.image && <img src={part.image} alt="" className="h-8 w-8 object-contain" />}
                      <span className="min-w-0 flex-1 text-sm text-bone">{partLabel}</span>
                      <Count value={amount} label={partLabel} onChange={(next) => onPartQty(part.id, next)} />
                      <span className="text-xs text-mute">{amount > 0 ? "en el inventario" : "te falta el plano"}</span>
                      <button
                        type="button"
                        onClick={() => onPartQty(part.id, Math.min(99, amount + 1))}
                        className="rounded-full border border-gold px-2.5 py-1 text-xs text-gold hover:bg-gold/10"
                      >
                        Me cayó
                      </button>
                      {part.materials.length > 0 && !finalPiece && (
                        <button
                          type="button"
                          onClick={() => onToggleCrafted(item.id, part.id)}
                          className={pieceDone ? "rounded-full border border-moss/40 px-2.5 py-1 text-xs text-moss" : "rounded-full border border-line px-2.5 py-1 text-xs text-bone hover:border-gold"}
                        >
                          {pieceDone ? "Pieza hecha" : "Marcar pieza"}
                        </button>
                      )}
                    </div>
                    <SourceNote
                      relics={part.relics}
                      source={partSource(sources[item.id], part.id, part.short, finalPiece)}
                      wiki={sources[item.id]?.wiki ?? null}
                      offer={vendorOffer(part.english)}
                      pending={!sourcesReady && part.relics.length === 0}
                      fissures={activeFissuresFor(part.relics, fissures)}
                    />
                    {part.materials.length > 0 && (
                      <div className="mt-2">
                        <MaterialList materials={part.materials} muted={pieceDone} />
                        <CraftChain materials={part.materials} known={known} onOpen={onOpen} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </article>
        );
      })}
    </div>
  );
}

function DropCatcher({
  parts,
  qty,
  onCatch,
}: {
  parts: CatchPart[];
  qty: Record<string, number>;
  onCatch: (partId: string, next: number) => void;
}) {
  const names = useNames();
  const [query, setQuery] = useState("");
  const [flash, setFlash] = useState("");
  const matches = useMemo(() => {
    const words = fold(query).split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];
    return parts
      .map((part) => {
        const label = names.part(part.partId, part.partTitle, part.itemId, part.itemName);
        const itemLabel = names.item(part.itemId, part.itemName);
        const haystack = fold(`${label} ${itemLabel} ${part.partTitle} ${part.itemName} ${part.english}`);
        return { part, label, itemLabel, haystack };
      })
      .filter((row) => words.every((word) => row.haystack.includes(word)))
      .slice(0, 8);
  }, [names, parts, query]);

  function catchPart(partId: string, label: string) {
    const amount = qty[partId] ?? 0;
    if (amount >= 99) return;
    onCatch(partId, amount + 1);
    setFlash(`${label} · × ${amount + 1}`);
    setQuery("");
  }

  return (
    <section className="rounded-2xl border border-gold/30 bg-panel p-4">
      <h3 className="text-sm font-medium text-bone">¿Qué te cayó?</h3>
      <p className="mt-1 text-xs text-mute">Escribí el plano y tocá Me cayó. Podés sumar el mismo varias veces. No hace falta marcar la reliquia.</p>
      <label className="mt-3 block">
        <span className="sr-only">Buscar un plano del farmeo</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || matches.length === 0) return;
            event.preventDefault();
            catchPart(matches[0].part.partId, matches[0].label);
          }}
          placeholder="Neurópticas, chasis, Sevagoth…"
          className="w-full rounded-xl border border-line bg-ink px-3 py-2 text-sm text-bone outline-none placeholder:text-mute focus:border-gold"
          autoComplete="off"
        />
      </label>
      {flash && <p className="mt-2 text-xs text-gold">{flash}</p>}
      {query.trim() && matches.length === 0 && <p className="mt-2 text-xs text-mute">Nada de tu farmeo coincide.</p>}
      {matches.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1.5">
          {matches.map(({ part, label, itemLabel }) => {
            const amount = qty[part.partId] ?? 0;
            return (
              <li key={part.partId}>
                <button
                  type="button"
                  onClick={() => catchPart(part.partId, label)}
                  className="flex w-full flex-wrap items-center gap-2 rounded-xl border border-line/80 px-3 py-2 text-left hover:border-gold"
                >
                  {part.image && <img src={part.image} alt="" className="h-7 w-7 object-contain" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-bone">{label}</span>
                    <span className="block truncate text-xs text-mute">
                      {itemLabel}
                      {part.bonus ? " · también cae en tu ruta" : ""}
                      {amount > 0 ? ` · ya × ${amount}` : ""}
                    </span>
                  </span>
                  <span className="rounded-full border border-gold px-2.5 py-1 text-xs text-gold">Me cayó</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function fold(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function Count({ value, label, onChange }: { value: number; label: string; onChange: (next: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label={`Una menos de ${label}`}
        disabled={value <= 0}
        onClick={() => onChange(value - 1)}
        className="grid h-7 w-7 place-items-center rounded-full border border-line text-bone disabled:opacity-30"
      >
        −
      </button>
      <span className="w-6 text-center text-sm tabular-nums text-bone">{value}</span>
      <button
        type="button"
        aria-label={`Una más de ${label}`}
        disabled={value >= 99}
        onClick={() => onChange(value + 1)}
        className="grid h-7 w-7 place-items-center rounded-full border border-line text-bone disabled:opacity-30"
      >
        +
      </button>
    </div>
  );
}

const ROLE: Record<string, string> = {
  Plano: "Blueprint",
  Chasis: "Chassis",
  Neurópticas: "Neuroptics",
  Sistemas: "Systems",
  Cañón: "Barrel",
  Receptor: "Receiver",
  Culata: "Stock",
  Hoja: "Blade",
  Empuñadura: "Handle",
};

function partSource(pack: ItemSources | undefined, partId: string, short: string, finalPiece: boolean) {
  if (!pack) return undefined;
  const byRole = finalPiece ? pack.byName.Blueprint : pack.byName[ROLE[short] ?? short];
  return pack.byId[partId] ?? byRole;
}

async function loadSideDrops(places: string[], goalPartIds: Set<string>) {
  if (!supabase || places.length === 0) return {};
  const rewardLists = await Promise.all(places.map(async (place) => [place, await fetchPlaceRewards(place)] as const));
  const candidates = new Set<string>();
  for (const [, rewards] of rewardLists) {
    for (const reward of rewards) {
      const stripped = reward.english.replace(/\s+Blueprint$/i, "").trim();
      candidates.add(reward.english);
      candidates.add(stripped);
      candidates.add(`${stripped} Blueprint`);
    }
  }
  if (candidates.size === 0) return {};
  const { data, error } = await supabase
    .from("catalog_parts")
    .select("id, item_id, short, title, english, image, catalog_items(name, image)")
    .in("english", [...candidates]);
  if (error) return {};
  const catalog: CatalogDrop[] = [];
  for (const entry of data ?? []) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as {
      id?: unknown;
      item_id?: unknown;
      title?: unknown;
      english?: unknown;
      image?: unknown;
      catalog_items?: { name?: unknown; image?: unknown } | { name?: unknown; image?: unknown }[] | null;
    };
    if (typeof row.id !== "string" || typeof row.item_id !== "string" || typeof row.title !== "string") continue;
    if (goalPartIds.has(row.id)) continue;
    const parent = Array.isArray(row.catalog_items) ? row.catalog_items[0] : row.catalog_items;
    catalog.push({
      partId: row.id,
      itemId: row.item_id,
      itemName: typeof parent?.name === "string" ? parent.name : row.item_id,
      partTitle: row.title,
      english: typeof row.english === "string" ? row.english : row.title,
      image: typeof row.image === "string" ? row.image : typeof parent?.image === "string" ? parent.image : null,
    });
  }
  const next: Record<string, CatalogDrop[]> = {};
  for (const [place, rewards] of rewardLists) {
    const found: CatalogDrop[] = [];
    for (const reward of rewards) {
      for (const part of matchReward(reward.english, catalog)) {
        if (found.some((entry) => entry.partId === part.partId || (entry.itemId === part.itemId && entry.partTitle === part.partTitle))) continue;
        found.push(part);
      }
    }
    if (found.length > 0) next[place] = found;
  }
  return next;
}

function SourceNote({
  relics,
  source,
  wiki,
  offer,
  pending,
  fissures,
}: {
  relics: PartRelic[];
  source: { lines: string[]; market: string | null } | undefined;
  wiki: string | null;
  offer: string | null;
  pending: boolean;
  fissures: FarmFissure[];
}) {
  const buy = offer ? <p className="mt-1 text-xs text-gold">{relics.length > 0 || source?.lines.length || source?.market ? `O cómpralo ${offer}.` : `Cómpralo ${offer}.`}</p> : null;
  const live =
    fissures.length > 0 ? (
      <p className="mt-1 text-xs text-gold">
        Ahora: {fissures.map((fissure) => `${fissure.tier} · ${fissure.mission} en ${fissure.node} · ${fissure.timeLeft}`).join("  ·  ")}
      </p>
    ) : null;
  if (relics.length > 0) {
    return (
      <>
        <p className="mt-1 text-xs text-mute">{sourceLine(relics)}</p>
        {live}
        {buy}
      </>
    );
  }
  if (pending && !source) {
    return (
      <>
        <p className="mt-1 text-xs text-mute">Buscando de dónde sale…</p>
        {buy}
      </>
    );
  }
  if (source && source.lines.length > 0) {
    return (
      <>
        <p className="mt-1 text-xs text-mute">{source.lines.join("  ·  ")}</p>
        {buy}
      </>
    );
  }
  if (source?.market) {
    return (
      <>
        <p className="mt-1 text-xs text-mute">{source.market}</p>
        {buy}
      </>
    );
  }
  if (buy) return buy;
  return (
    <p className="mt-1 text-xs text-mute">
      La tabla oficial no lo lista. Puede salir de una aventura, del dojo o de un sindicato.
      {wiki && (
        <>
          {" "}
          <a className="text-gold underline-offset-2 hover:underline" href={wiki} target="_blank" rel="noreferrer">
            Ver en la wiki
          </a>
        </>
      )}
    </p>
  );
}

function activeFissuresFor(relics: PartRelic[], fissures: FarmFissure[]) {
  const eras = new Set(relics.filter((relic) => !relic.vaulted).map((relic) => relicEra(relic.name)).filter((era): era is string => Boolean(era)));
  if (eras.size === 0) return [];
  return fissures.filter((fissure) => [...eras].some((era) => fissureMatches(fissure.tier, era))).slice(0, 2);
}

function buildRoutes(
  items: PlanItem[],
  sources: Record<string, ItemSources>,
  fissures: FarmFissure[],
  sideDrops: Record<string, CatalogDrop[]>,
  qty: Record<string, number>,
): DropRoute[] {
  const byKey = new Map<string, DropRoute>();
  const addChance = (route: DropRoute, chance: DropChance) => {
    if (route.chances.some((entry) => entry.partId === chance.partId)) return;
    route.chances.push(chance);
  };
  for (const item of items) {
    for (const part of item.parts) {
      const amount = qty[part.id] ?? 0;
      const finalPiece = part.short === "Plano" && item.parts.length > 1;
      const source = partSource(sources[item.id], part.id, part.short, finalPiece);
      const chance: DropChance = {
        partId: part.id,
        itemId: item.id,
        itemName: item.name,
        partTitle: part.title,
        image: part.image,
        amount,
        bonus: false,
      };
      const places = source?.places ?? [];
      for (let index = 0; index < places.length; index += 1) {
        const place = placeKey(places[index] ?? "");
        const line = source?.lines[index] ?? place;
        const key = `mission:${place}`;
        const route = byKey.get(key) ?? {
          key,
          title: line.replace(/\s·\s\d+%$/, ""),
          kind: "mission" as const,
          detail: "posible drop de misión",
          chances: [],
        };
        if (amount === 0) addChance(route, chance);
        byKey.set(key, route);
      }
      if (amount > 0) continue;
      for (const fissure of activeFissuresFor(part.relics, fissures)) {
        const key = `fissure:${fissure.id}`;
        const route = byKey.get(key) ?? {
          key,
          title: `${fissure.tier} · ${fissure.mission} en ${fissure.node}`,
          kind: "fissure" as const,
          detail: fissure.hard ? `Camino de acero · ${fissure.timeLeft}` : fissure.timeLeft,
          chances: [],
        };
        addChance(route, chance);
        byKey.set(key, route);
      }
    }
  }
  for (const [place, extras] of Object.entries(sideDrops)) {
    const key = `mission:${place}`;
    const route = byKey.get(key);
    if (!route) continue;
    for (const part of extras) {
      addChance(route, {
        partId: part.partId,
        itemId: part.itemId,
        itemName: part.itemName,
        partTitle: part.partTitle,
        image: part.image,
        amount: qty[part.partId] ?? 0,
        bonus: true,
      });
    }
    if (route.chances.some((entry) => entry.bonus)) {
      route.detail = "de tu farmeo y otros planos de la misma etapa";
    }
  }
  return [...byKey.values()]
    .filter((route) => route.chances.length > 0)
    .map((route) => ({
      ...route,
      chances: [...route.chances].sort((left, right) => Number(left.bonus) - Number(right.bonus) || left.partTitle.localeCompare(right.partTitle, "es")),
    }))
    .sort((left, right) => right.chances.length - left.chances.length || left.title.localeCompare(right.title, "es"))
    .slice(0, 8);
}

function sourceLine(relics: PartRelic[]) {
  if (relics.length === 0) return "No sale de una reliquia.";
  return relics
    .slice(0, 3)
    .map((relic) => `${relic.name} · ${RARITY[relic.rarity]} · ${relic.vaulted ? "ya no sale al jugarla" : "se puede jugar"}`)
    .join("  ·  ");
}

function CraftChain({
  materials,
  known,
  onOpen,
}: {
  materials: CraftMaterial[];
  known: Set<string>;
  onOpen: (id: string) => void;
}) {
  const steps = materials.filter((material) => known.has(material.id));
  if (steps.length === 0) return null;
  return (
    <p className="mt-2 text-xs text-gold">
      Antes fabrica{" "}
      {steps.map((material, index) => (
        <span key={material.id}>
          {index > 0 ? ", " : ""}
          <button type="button" onClick={() => onOpen(material.id)} className="underline-offset-2 hover:underline">
            {material.name}
          </button>
        </span>
      ))}
      .
    </p>
  );
}

function groupPlans(rows: unknown[], order: string[]): PlanItem[] {
  const byItem = new Map<string, PlanItem>();
  for (const entry of rows) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as {
      id?: unknown;
      item_id?: unknown;
      short?: unknown;
      title?: unknown;
      english?: unknown;
      image?: unknown;
      relics?: unknown;
      materials?: unknown;
      catalog_items?: { name?: unknown; image?: unknown } | { name?: unknown; image?: unknown }[] | null;
    };
    if (typeof row.id !== "string" || typeof row.item_id !== "string" || typeof row.short !== "string" || typeof row.title !== "string") continue;
    const parent = Array.isArray(row.catalog_items) ? row.catalog_items[0] : row.catalog_items;
    const item = byItem.get(row.item_id) ?? {
      id: row.item_id,
      name: typeof parent?.name === "string" ? parent.name : row.item_id,
      image: typeof parent?.image === "string" ? parent.image : null,
      parts: [],
    };
    item.parts.push({
      id: row.id,
      short: row.short,
      title: row.title,
      english: typeof row.english === "string" ? row.english : row.title,
      image: typeof row.image === "string" ? row.image : null,
      relics: relicList(row.relics),
      materials: materialList(row.materials),
    });
    byItem.set(row.item_id, item);
  }
  return order.flatMap((id) => {
    const item = byItem.get(id);
    return item ? [item] : [];
  });
}

function relicList(value: unknown): PartRelic[] {
  if (!Array.isArray(value)) return [];
  const relics: PartRelic[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as { name?: unknown; rarity?: unknown; vaulted?: unknown };
    if (typeof row.name !== "string") continue;
    const rarity = row.rarity === "rare" || row.rarity === "uncommon" || row.rarity === "common" ? row.rarity : "common";
    relics.push({ name: row.name, rarity, vaulted: row.vaulted === true });
  }
  return relics;
}

function materialList(value: unknown): CraftMaterial[] {
  if (!Array.isArray(value)) return [];
  const materials: CraftMaterial[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as { id?: unknown; name?: unknown; count?: unknown; image?: unknown };
    if (typeof row.id !== "string" || typeof row.name !== "string") continue;
    materials.push({
      id: row.id,
      name: row.name,
      count: Number(row.count) || 1,
      image: typeof row.image === "string" ? row.image : null,
    });
  }
  return materials;
}
