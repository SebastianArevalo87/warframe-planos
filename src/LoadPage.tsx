import { useEffect, useMemo, useState } from "react";
import { fetchLoadIndex, type LoadRow } from "./lib/catalogRemote.ts";
import { useNames } from "./Locale.tsx";
import { MasteryPage, masteryGroup } from "./MasteryPage.tsx";
import { sortLocale } from "./lib/locale.ts";
import { useShowFounders } from "./lib/founders.ts";
import { craftKey } from "./lib/collection.ts";
import { KIND_LABEL, type ItemKind } from "./types.ts";
import type { CraftMaterial } from "./types.ts";

type GroupId =
  | "warframe"
  | "primary"
  | "secondary"
  | "melee"
  | "archwing"
  | "archgun"
  | "archmelee"
  | "robotic"
  | "companion"
  | "modular"
  | "varios";

const GROUPS: Array<{ id: GroupId; label: string }> = [
  { id: "warframe", label: "Warframe" },
  { id: "primary", label: "Primaria" },
  { id: "secondary", label: "Secundaria" },
  { id: "melee", label: "Cuerpo a cuerpo" },
  { id: "archwing", label: "Archwing" },
  { id: "archgun", label: "Archcañón" },
  { id: "archmelee", label: "Archmelee" },
  { id: "robotic", label: "Robótico" },
  { id: "companion", label: "Compañero" },
  { id: "modular", label: "Modular" },
  { id: "varios", label: "Varios" },
];

const TYPE_ORDER = [
  "Plano",
  "Neurópticas",
  "Chasis",
  "Sistemas",
  "Alas",
  "Arnés",
  "Cápsula",
  "Carcasa",
  "Motor",
  "Compartimento de armas",
  "Cañón",
  "Cañones",
  "Culata",
  "Receptor",
  "Receptores",
  "Empuñadura",
  "Enlace",
  "Hoja",
  "Hojas",
  "Guantelete",
  "Guantelete izquierdo",
  "Guantelete derecho",
  "Cuerda",
  "Cacha",
  "Rama superior",
  "Rama inferior",
  "Guarda",
  "Cabeza",
  "Bolsa",
  "Adorno",
  "Disco",
  "Funda",
  "Gancho",
  "Bota",
  "Cadena",
  "Estrellas",
  "Mandacordio",
];

type ItemBlock = {
  itemId: string;
  itemName: string;
  image: string | null;
  kind: ItemKind;
  parts: LoadRow[];
};

function fold(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function groupOf(row: LoadRow): GroupId {
  if (row.kind === "amp" || /ZanukaPets|MoaPetParts/i.test(row.itemId)) return "modular";
  if (/SentinelPowersuits/i.test(row.itemId)) return "companion";
  if (row.kind === "robotic") return "robotic";
  if (row.kind === "archwing" || row.kind === "necramech") return "archwing";
  if (row.kind === "companion") return "companion";
  if (
    row.kind === "warframe" ||
    row.kind === "primary" ||
    row.kind === "secondary" ||
    row.kind === "melee" ||
    row.kind === "archgun" ||
    row.kind === "archmelee"
  ) {
    return row.kind;
  }
  return "varios";
}

function compareTypes(a: string, b: string) {
  const aOrder = TYPE_ORDER.indexOf(a);
  const bOrder = TYPE_ORDER.indexOf(b);
  if (aOrder !== -1 || bOrder !== -1) {
    if (aOrder === -1) return 1;
    if (bOrder === -1) return -1;
    return aOrder - bOrder;
  }
  return a.localeCompare(b, "es");
}

function letterOf(name: string) {
  const letter = name.trim().charAt(0).toLocaleUpperCase();
  if (!letter) return "#";
  const folded = fold(letter);
  return /[A-Z]/.test(folded) ? folded : letter;
}

function materialLine(materials: CraftMaterial[]) {
  return materials.map((material) => `${material.name} ${material.count.toLocaleString("es-CL")}`).join(" · ");
}

export function LoadPage({
  qty,
  crafted,
  onToggle,
  onToggleCrafted,
  onOpen,
  mastered,
  leveled,
  onToggleMastered,
  onToggleLeveled,
}: {
  qty: Record<string, number>;
  crafted: string[];
  onToggle: (partId: string, next: number) => void;
  onToggleCrafted: (itemId: string, partId: string) => void;
  onOpen: (itemId: string) => void;
  mastered: string[];
  leveled: string[];
  onToggleMastered: (itemId: string) => void;
  onToggleLeveled: (itemId: string) => void;
}) {
  const [rows, setRows] = useState<LoadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [group, setGroup] = useState<GroupId>("warframe");
  const [query, setQuery] = useState("");
  const opened = masteryGroup(window.location.hash);
  const [mode, setMode] = useState<"parts" | "mastered">(opened ? "mastered" : "parts");
  const names = useNames();
  const foundersVisible = useShowFounders();
  const ordering = sortLocale(names.locale);
  const craftedKeys = useMemo(() => new Set(crafted), [crafted]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchLoadIndex()
      .then((next) => {
        if (!cancelled) setRows(next);
      })
      .catch(() => {
        if (!cancelled) setError("No pude abrir las piezas.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [foundersVisible]);

  const groups = useMemo(
    () =>
      GROUPS.map((entry) => {
        const ids = new Set<string>();
        const owned = new Set<string>();
        for (const row of rows) {
          if (groupOf(row) !== entry.id) continue;
          ids.add(row.itemId);
          if ((qty[row.partId] ?? 0) > 0) owned.add(row.itemId);
        }
        return { ...entry, owned: owned.size, total: ids.size };
      }),
    [qty, rows],
  );

  const items = useMemo(() => {
    const terms = fold(query.trim()).split(/\s+/).filter(Boolean);
    const matched = new Set<string>();
    for (const row of rows) {
      if (groupOf(row) !== group) continue;
      if (terms.length === 0) {
        matched.add(row.itemId);
        continue;
      }
      const itemLabel = names.item(row.itemId, row.itemName);
      const partLabel = names.part(row.partId, row.title, row.itemId, row.itemName);
      const haystack = `${fold(row.itemName)} ${fold(itemLabel)} ${fold(row.title)} ${fold(partLabel)} ${fold(row.short)}`;
      if (terms.every((word) => haystack.includes(word))) matched.add(row.itemId);
    }
    const byId = new Map<string, ItemBlock>();
    for (const row of rows) {
      if (groupOf(row) !== group || !matched.has(row.itemId)) continue;
      const current = byId.get(row.itemId);
      if (current) current.parts.push(row);
      else byId.set(row.itemId, { itemId: row.itemId, itemName: row.itemName, image: row.image, kind: row.kind, parts: [row] });
    }
    for (const block of byId.values()) block.parts.sort((a, b) => compareTypes(a.short, b.short) || a.title.localeCompare(b.title, ordering));
    return [...byId.values()].sort((a, b) => names.item(a.itemId, a.itemName).localeCompare(names.item(b.itemId, b.itemName), ordering));
  }, [group, names, ordering, query, rows]);

  const partTotal = items.reduce((sum, item) => sum + item.parts.length, 0);
  const partOwned = items.reduce((sum, item) => sum + item.parts.filter((part) => (qty[part.partId] ?? 0) > 0).length, 0);
  const progress = partTotal === 0 ? 0 : Math.round((partOwned / partTotal) * 100);
  const sections: Array<{ letter: string; items: ItemBlock[] }> = [];
  for (const item of items) {
    const letter = letterOf(names.item(item.itemId, item.itemName));
    const last = sections[sections.length - 1];
    if (!last || last.letter !== letter) sections.push({ letter, items: [item] });
    else last.items.push(item);
  }
  const showMaterials = group !== "warframe";

  return (
    <div>
      <div className="mb-3 flex items-baseline gap-4">
        <button
          type="button"
          aria-current={mode === "parts" ? "page" : undefined}
          onClick={() => {
            setMode("parts");
            window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
          }}
          className={mode === "parts" ? "text-2xl font-medium text-bone" : "text-sm text-mute hover:text-bone"}
        >
          Planos
        </button>
        <button
          type="button"
          aria-current={mode === "mastered" ? "page" : undefined}
          onClick={() => {
            setMode("mastered");
            window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#dominados`);
          }}
          className={mode === "mastered" ? "text-2xl font-medium text-bone" : "text-sm text-mute hover:text-bone"}
        >
          Dominados
        </button>
      </div>
      {mode === "mastered" ? (
        <MasteryPage
          mastered={mastered}
          leveled={leveled}
          initialGroup={opened ?? "warframe"}
          onToggle={onToggleMastered}
          onToggleLeveled={onToggleLeveled}
        />
      ) : (
        <>
          {error && <p className="text-clay">{error}</p>}
          {loading && <p className="text-mute">Abriendo las piezas…</p>}
          {!loading && !error && (
            <>
              <div className="z-10 -mx-4 bg-ink/95 px-4 py-2 backdrop-blur-md lg:sticky lg:top-0 lg:-mx-8 lg:px-8">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)_auto] sm:items-center">
                  <label className="min-w-0">
                    <span className="sr-only">Categoría</span>
                    <select
                      aria-label="Categoría"
                      value={group}
                      onChange={(event) => setGroup(event.target.value as GroupId)}
                      className={FIELD}
                    >
                      {groups.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.label} {entry.owned}/{entry.total}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="min-w-0">
                    <span className="sr-only">Filtra esta lista</span>
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Filtra esta lista"
                      className={FIELD}
                    />
                  </label>
                  <p className="text-sm text-mute tabular-nums sm:text-right">
                    {partOwned}/{partTotal}
                  </p>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full bg-gold" style={{ width: `${progress}%` }} />
                </div>
              </div>
              {items.length === 0 && <p className="mt-3 text-mute">Ningún objeto coincide.</p>}
              <div className="mt-1">
                {sections.map((section) => (
                  <section key={section.letter}>
                    <h2 className="mt-4 text-xs font-medium tracking-[0.16em] text-gold uppercase">{section.letter}</h2>
                    <div className="grid grid-cols-1 gap-x-8 lg:grid-cols-2">
                      {section.items.map((item) => {
                        const itemLabel = names.item(item.itemId, item.itemName);
                        return (
                          <article key={item.itemId} className="min-w-0 border-t border-line/40 py-2">
                            <button type="button" onClick={() => onOpen(item.itemId)} className="flex min-w-0 items-center gap-2 py-1 text-left">
                              {item.image && <img src={item.image} alt="" width={32} height={32} className="h-8 w-8 shrink-0 object-contain" />}
                              <span className="min-w-0">
                                <span className="block truncate text-sm text-bone">{itemLabel}</span>
                                {group === "varios" && <span className="block text-xs text-mute">{KIND_LABEL[item.kind]}</span>}
                              </span>
                            </button>
                            <ul>
                              {item.parts.map((part) => {
                                const amount = qty[part.partId] ?? 0;
                                const partLabel = names.part(part.partId, part.title, item.itemId, item.itemName);
                                const builtPiece = craftedKeys.has(craftKey(item.itemId, part.partId));
                                const canBuild = part.materials.length > 0 && (part.short !== "Plano" || item.parts.length === 1);
                                return (
                                  <li key={part.partId} className="py-1 pl-10">
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                      <span className="min-w-28 flex-1 truncate text-sm text-bone">{part.short}</span>
                                      <Count label={`${part.short} de ${itemLabel}`} value={amount} onChange={(next) => onToggle(part.partId, next)} />
                                      {canBuild && (
                                        <button
                                          type="button"
                                          aria-pressed={builtPiece}
                                          onClick={() => onToggleCrafted(item.itemId, part.partId)}
                                          className={
                                            builtPiece
                                              ? "rounded-full border border-moss/40 px-2.5 py-1 text-xs text-moss"
                                              : "rounded-full border border-line px-2.5 py-1 text-xs text-bone hover:border-gold"
                                          }
                                        >
                                          {builtPiece ? "Construida" : "Pieza"}
                                        </button>
                                      )}
                                    </div>
                                    {showMaterials && part.materials.length > 0 && (
                                      <p className={`mt-0.5 text-xs text-mute ${builtPiece ? "opacity-60" : ""}`}>{materialLine(part.materials)}</p>
                                    )}
                                    <span className="sr-only">{partLabel}</span>
                                  </li>
                                );
                              })}
                            </ul>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

const FIELD =
  "w-full min-w-0 rounded-full border border-line bg-panel px-3 py-2 text-sm text-bone outline-none placeholder:text-mute/70 focus:border-gold";

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
