import { useEffect, useState } from "react";
import { fetchItemIndex } from "./lib/catalogRemote.ts";
import { fetchItemSources, type ItemSources } from "./lib/partSources.ts";
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

  if (goals.length === 0) {
    return <p className="text-sm text-mute">En Marcar, pulsa Farmear en lo que te falte. Aquí queda el camino de cada plano.</p>;
  }
  if (error) return <p className="text-sm text-clay">{error}</p>;
  if (items.length === 0) return <p className="text-sm text-mute">Armando el plan…</p>;

  const built = new Set(collection.built);
  const mastered = new Set(collection.mastered);

  return (
    <div className="flex flex-col gap-4">
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
                <button type="button" onClick={() => onRemove(item.id)} className="rounded-full border border-line px-3 py-1.5 text-sm text-mute hover:text-bone">
                  Quitar
                </button>
              </div>
            </div>
            <ul className="mt-4 flex flex-col gap-3">
              {item.parts.map((part) => {
                const amount = collection.qty[part.id] ?? 0;
                const crafted = collection.crafted.includes(craftKey(item.id, part.id));
                const finalPiece = part.short === "Plano" && item.parts.length > 1;
                const pieceDone = finalPiece ? done : crafted;
                return (
                  <li key={part.id} className="rounded-xl border border-line/80 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {part.image && <img src={part.image} alt="" className="h-8 w-8 object-contain" />}
                      <span className="min-w-0 flex-1 text-sm text-bone">{names.part(part.id, part.title, item.id, item.name)}</span>
                      <Count
                        value={amount}
                        label={names.part(part.id, part.title, item.id, item.name)}
                        onChange={(next) => onPartQty(part.id, next)}
                      />
                      <span className="text-xs text-mute">{amount > 0 ? "en el inventario" : "te falta el plano"}</span>
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

function SourceNote({
  relics,
  source,
  wiki,
  offer,
  pending,
}: {
  relics: PartRelic[];
  source: { lines: string[]; market: string | null } | undefined;
  wiki: string | null;
  offer: string | null;
  pending: boolean;
}) {
  const buy = offer ? <p className="mt-1 text-xs text-gold">{relics.length > 0 || source?.lines.length || source?.market ? `O cómpralo ${offer}.` : `Cómpralo ${offer}.`}</p> : null;
  if (relics.length > 0) {
    return (
      <>
        <p className="mt-1 text-xs text-mute">{sourceLine(relics)}</p>
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
