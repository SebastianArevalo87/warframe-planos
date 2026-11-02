import { useEffect, useMemo, useState } from "react";
import { fetchItemIndex, type MasteryRow } from "./lib/catalogRemote.ts";
import { useNames } from "./Locale.tsx";
import { GEAR_GRID, GearCard } from "./ItemCard.tsx";
import { sortLocale } from "./lib/locale.ts";
import { useShowFounders } from "./lib/founders.ts";
import type { ItemKind } from "./types.ts";

export type MasteryGroupId = "warframe" | "primary" | "secondary" | "melee" | "robotic" | "companion" | "vehicle" | "archgun" | "archmelee" | "amp";

const GROUPS: Array<{ id: MasteryGroupId; label: string }> = [
  { id: "warframe", label: "Warframe" },
  { id: "primary", label: "Primaria" },
  { id: "secondary", label: "Secundaria" },
  { id: "melee", label: "Cuerpo a cuerpo" },
  { id: "robotic", label: "Robótico" },
  { id: "companion", label: "Compañero" },
  { id: "vehicle", label: "Vehículo" },
  { id: "archgun", label: "Archcañón" },
  { id: "archmelee", label: "Archmelee" },
  { id: "amp", label: "Amps" },
];

function inGroup(kind: ItemKind, group: MasteryGroupId) {
  if (group === "vehicle") return kind === "archwing" || kind === "necramech" || kind === "vehicle";
  return kind === group;
}

export function masteryGroup(hash: string): MasteryGroupId | null {
  if (hash === "#dominados") return "warframe";
  if (!hash.startsWith("#dominados-")) return null;
  const id = hash.slice("#dominados-".length);
  return GROUPS.some((entry) => entry.id === id) ? (id as MasteryGroupId) : null;
}

export function MasteryPage({
  mastered,
  leveled,
  initialGroup = "warframe",
  onToggle,
  onToggleLeveled,
}: {
  mastered: string[];
  leveled: string[];
  initialGroup?: MasteryGroupId;
  onToggle: (itemId: string) => void;
  onToggleLeveled: (itemId: string) => void;
}) {
  const [rows, setRows] = useState<MasteryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [group, setGroup] = useState<MasteryGroupId>(initialGroup);
  const [query, setQuery] = useState("");
  const done = useMemo(() => new Set(mastered), [mastered]);
  const started = useMemo(() => new Set(leveled), [leveled]);
  const names = useNames();
  const foundersVisible = useShowFounders();
  const ordering = sortLocale(names.locale);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchItemIndex()
      .then((next) => {
        if (!cancelled) setRows(next);
      })
      .catch(() => {
        if (!cancelled) setError("No pude abrir el equipo.");
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
        const matching = rows.filter((row) => inGroup(row.kind, entry.id));
        const owned = matching.filter((row) => done.has(row.id)).length;
        const partial = matching.filter((row) => started.has(row.id)).length;
        return { ...entry, owned, partial, total: matching.length };
      }),
    [done, rows, started],
  );

  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const visible = rows
    .filter((row) => {
      if (!inGroup(row.kind, group)) return false;
      const shown = names.item(row.id, row.name).toLowerCase();
      return words.every((word) => shown.includes(word) || row.name.toLowerCase().includes(word));
    })
    .sort((a, b) => names.item(a.id, a.name).localeCompare(names.item(b.id, b.name), ordering));
  const ownedVisible = visible.filter((row) => done.has(row.id)).length;
  const leveledVisible = visible.filter((row) => started.has(row.id)).length;
  const active = groups.find((entry) => entry.id === group);

  return (
    <div>
      <p className="text-sm text-mute">
        Mismo orden que el equipamiento. Toca la tarjeta para el rango 30. El punto de la esquina es uno que ya subiste y todavía no llega a 30: no cuenta como dominado.
      </p>
      {error && <p className="mt-3 text-clay">{error}</p>}
      {loading && <p className="mt-4 text-mute">Abriendo el equipo…</p>}
      {!loading && !error && (
        <>
          <div className="z-10 -mx-4 mt-3 bg-ink/95 px-4 py-2 backdrop-blur-md lg:sticky lg:top-0 lg:-mx-8 lg:px-8">
            <div className="flex flex-wrap gap-x-4 gap-y-2" role="tablist" aria-label="Equipamiento">
              {groups.map((entry) => {
                const selected = entry.id === group;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setGroup(entry.id)}
                    className={selected ? "text-sm text-bone" : "text-sm text-mute hover:text-bone"}
                  >
                    {entry.label}
                    <span className="ml-1 tabular-nums text-mute">
                      {entry.owned}/{entry.total}
                      {entry.partial > 0 ? <span className="text-gold"> · {entry.partial}</span> : ""}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <label className="min-w-0">
                <span className="sr-only">Busca en {active?.label ?? "esta lista"}</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={`Busca en ${active?.label ?? "esta lista"}`}
                  className="w-full min-w-0 rounded-full border border-line bg-panel px-3 py-2 text-sm text-bone outline-none placeholder:text-mute/70 focus:border-gold"
                />
              </label>
              <p className="text-sm text-bone tabular-nums sm:text-right">
                {ownedVisible}/{visible.length}
                {leveledVisible > 0 ? <span className="text-gold"> · {leveledVisible} leveados</span> : ""}
              </p>
            </div>
          </div>
          {visible.length === 0 && <p className="mt-4 text-mute">Ningún equipo coincide.</p>}
          <ul className={`mt-4 ${GEAR_GRID}`}>
            {visible.map((row) => {
              const owned = done.has(row.id);
              const partial = started.has(row.id);
              return (
                <li key={row.id}>
                  <GearCard
                    name={names.item(row.id, row.name)}
                    image={row.image}
                    label={partial && !owned ? "Leveado" : undefined}
                    mastered={owned}
                    tone={owned ? "built" : partial ? "few" : "none"}
                    dimmed={!owned && !partial}
                    pressed={owned}
                    leveled={partial}
                    onClick={() => onToggle(row.id)}
                    onToggleLeveled={() => onToggleLeveled(row.id)}
                  />
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
