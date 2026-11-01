import { useEffect, useMemo, useState } from "react";
import { fetchItemIndex, type MasteryRow } from "./lib/catalogRemote.ts";
import { GEAR_GRID, GearCard } from "./ItemCard.tsx";
import type { ItemKind } from "./types.ts";

type GroupId = "warframe" | "primary" | "secondary" | "melee" | "archwing" | "companion" | "robotic" | "archgun" | "archmelee" | "amp";

const GROUPS: Array<{ id: GroupId; label: string }> = [
  { id: "warframe", label: "Warframe" },
  { id: "primary", label: "Primaria" },
  { id: "secondary", label: "Secundaria" },
  { id: "melee", label: "Cuerpo a cuerpo" },
  { id: "archwing", label: "Archwing" },
  { id: "companion", label: "Compañero" },
  { id: "robotic", label: "Robótico" },
  { id: "archgun", label: "Archcañón" },
  { id: "archmelee", label: "Archmelee" },
  { id: "amp", label: "Amps" },
];

function inGroup(kind: ItemKind, group: GroupId) {
  if (group === "archwing") return kind === "archwing" || kind === "necramech";
  return kind === group;
}

export function MasteryPage({
  mastered,
  onToggle,
}: {
  mastered: string[];
  onToggle: (itemId: string) => void;
}) {
  const [rows, setRows] = useState<MasteryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [group, setGroup] = useState<GroupId>("warframe");
  const [query, setQuery] = useState("");
  const done = useMemo(() => new Set(mastered), [mastered]);

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
  }, []);

  const groups = useMemo(
    () =>
      GROUPS.map((entry) => {
        const matching = rows.filter((row) => inGroup(row.kind, entry.id));
        const owned = matching.filter((row) => done.has(row.id)).length;
        return { ...entry, owned, total: matching.length };
      }),
    [done, rows],
  );

  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const visible = rows
    .filter((row) => inGroup(row.kind, group) && words.every((word) => row.name.toLowerCase().includes(word)))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  const ownedVisible = visible.filter((row) => done.has(row.id)).length;

  return (
    <div>
      <p className="text-sm text-mute">Rango 30, por nombre. Sigue dominado si lo vendiste o lo entregaste al Helminth.</p>
      {error && <p className="mt-3 text-clay">{error}</p>}
      {loading && <p className="mt-4 text-mute">Abriendo el equipo…</p>}
      {!loading && !error && (
        <>
          <div className="z-10 -mx-4 mt-3 bg-ink/95 px-4 py-2 backdrop-blur-md lg:sticky lg:top-0 lg:-mx-8 lg:px-8">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)_auto] sm:items-center">
              <label className="min-w-0">
                <span className="sr-only">Categoría</span>
                <select
                  aria-label="Categoría"
                  value={group}
                  onChange={(event) => setGroup(event.target.value as GroupId)}
                  className="w-full min-w-0 rounded-full border border-line bg-panel px-3 py-2 text-sm text-bone outline-none focus:border-gold"
                >
                  {groups.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.label} {entry.owned}/{entry.total}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-0">
                <span className="sr-only">Busca en esta lista</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Busca en esta lista"
                  className="w-full min-w-0 rounded-full border border-line bg-panel px-3 py-2 text-sm text-bone outline-none placeholder:text-mute/70 focus:border-gold"
                />
              </label>
              <p className="text-sm text-bone tabular-nums sm:text-right">
                Completado {ownedVisible}/{visible.length}
              </p>
            </div>
          </div>
          {visible.length === 0 && <p className="mt-4 text-mute">Ningún equipo coincide.</p>}
          <ul className={`mt-4 ${GEAR_GRID}`}>
            {visible.map((row) => {
              const owned = done.has(row.id);
              return (
                <li key={row.id}>
                  <GearCard
                    name={row.name}
                    image={row.image}
                    label={owned ? "Rango máximo" : undefined}
                    tone={owned ? "built" : "none"}
                    dimmed={!owned}
                    pressed={owned}
                    onClick={() => onToggle(row.id)}
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
