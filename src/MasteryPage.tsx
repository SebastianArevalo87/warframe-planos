import { useEffect, useMemo, useState } from "react";
import { fetchItemIndex, type MasteryRow } from "./lib/catalogRemote.ts";
import { masteryXp } from "./lib/mastery.ts";
import { MasteryMark } from "./MasteryBadge.tsx";
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

  const needle = query.trim().toLowerCase();
  const visible = rows
    .filter((row) => inGroup(row.kind, group) && (needle === "" || row.name.toLowerCase().includes(needle)))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  const ownedVisible = visible.filter((row) => done.has(row.id)).length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-mute">Rango 30. El orden es el del perfil, por nombre.</p>
        <MasteryMark xp={masteryXp(rows, mastered)} ready={!loading} />
      </div>
      {error && <p className="mt-3 text-clay">{error}</p>}
      {loading && <p className="mt-4 text-mute">Abriendo el equipo…</p>}
      {!loading && !error && (
        <>
          <div className="z-10 -mx-4 mt-3 bg-ink/95 px-4 py-3 backdrop-blur-md lg:sticky lg:top-0 lg:-mx-8 lg:px-8">
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Categoría del perfil">
              {groups.map((entry) => {
                const selected = entry.id === group;
                const complete = entry.total > 0 && entry.owned === entry.total;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setGroup(entry.id)}
                    className={
                      selected
                        ? "rounded-full bg-bone px-3 py-1.5 text-sm text-ink"
                        : complete
                          ? "rounded-full border border-moss/40 px-3 py-1.5 text-sm text-moss"
                          : "rounded-full border border-line px-3 py-1.5 text-sm text-mute hover:text-bone"
                    }
                  >
                    {entry.label}
                    <span className="ml-1 tabular-nums opacity-70">
                      {entry.owned}/{entry.total}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <label className="min-w-0 flex-1">
                <span className="sr-only">Busca en esta lista</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Busca en esta lista"
                  className="w-full rounded-full border border-line bg-panel px-3 py-2 text-sm text-bone outline-none placeholder:text-mute/70 focus:border-gold"
                />
              </label>
              <p className="shrink-0 text-sm text-bone tabular-nums">
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
