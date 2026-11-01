import { useEffect, useMemo, useState } from "react";
import { fetchLoadIndex, type LoadRow } from "./lib/catalogRemote.ts";
import { useNames } from "./Locale.tsx";
import { MasteryPage } from "./MasteryPage.tsx";
import { sortLocale } from "./lib/locale.ts";
import { useShowFounders } from "./lib/founders.ts";
import { KIND_LABEL } from "./types.ts";

type GroupId = "warframe" | "primary" | "secondary" | "melee" | "archwing" | "archgun" | "archmelee" | "companion" | "robotic" | "amp" | "varios";

const GROUPS: Array<{ id: GroupId; label: string }> = [
  { id: "warframe", label: "Warframe" },
  { id: "primary", label: "Primaria" },
  { id: "secondary", label: "Secundaria" },
  { id: "melee", label: "Cuerpo a cuerpo" },
  { id: "archwing", label: "Archwing" },
  { id: "archgun", label: "Archcañón" },
  { id: "archmelee", label: "Archmelee" },
  { id: "companion", label: "Compañero" },
  { id: "robotic", label: "Robótico" },
  { id: "amp", label: "Amps" },
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

function fold(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function inGroup(row: LoadRow, group: GroupId) {
  if (group === "varios") return row.short !== "Plano";
  if (group === "archwing") return row.kind === "archwing" || row.kind === "necramech";
  return row.kind === group;
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

export function LoadPage({
  qty,
  onToggle,
  onOpen,
  mastered,
  leveled,
  onToggleMastered,
  onToggleLeveled,
}: {
  qty: Record<string, number>;
  onToggle: (partId: string, next: number) => void;
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
  const [type, setType] = useState("Plano");
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"parts" | "mastered">(window.location.hash === "#dominados" ? "mastered" : "parts");
  const names = useNames();
  const foundersVisible = useShowFounders();
  const ordering = sortLocale(names.locale);

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

  const grouped = useMemo(() => rows.filter((row) => inGroup(row, group)), [group, rows]);

  const types = useMemo(() => {
    const counts = new Map<string, { total: number; owned: number }>();
    for (const row of grouped) {
      const current = counts.get(row.short) ?? { total: 0, owned: 0 };
      current.total += 1;
      if ((qty[row.partId] ?? 0) > 0) current.owned += 1;
      counts.set(row.short, current);
    }
    return [...counts.entries()]
      .map(([short, count]) => ({ short, ...count }))
      .sort((a, b) => compareTypes(a.short, b.short));
  }, [grouped, qty]);

  const activeType = types.some((entry) => entry.short === type) ? type : (types[0]?.short ?? "");

  const groups = useMemo(
    () =>
      GROUPS.map((entry) => {
        const matching = rows.filter((row) => inGroup(row, entry.id));
        const owned = matching.filter((row) => (qty[row.partId] ?? 0) > 0).length;
        return { ...entry, owned, total: matching.length };
      }),
    [qty, rows],
  );

  const words = fold(query.trim()).split(/\s+/).filter(Boolean);
  const visible = grouped
    .filter((row) => {
      if (row.short !== activeType) return false;
      const haystack = `${fold(row.itemName)} ${fold(names.item(row.itemId, row.itemName))} ${fold(row.title)} ${fold(names.part(row.partId, row.title, row.itemId, row.itemName))}`;
      return words.every((word) => haystack.includes(word));
    })
    .sort((a, b) => names.item(a.itemId, a.itemName).localeCompare(names.item(b.itemId, b.itemName), ordering) || a.title.localeCompare(b.title, ordering));
  const ownedVisible = visible.filter((row) => (qty[row.partId] ?? 0) > 0).length;
  const progress = visible.length === 0 ? 0 : Math.round((ownedVisible / visible.length) * 100);
  const sections: Array<{ letter: string; rows: LoadRow[] }> = [];
  for (const row of visible) {
    const letter = letterOf(names.item(row.itemId, row.itemName));
    const last = sections[sections.length - 1];
    if (!last || last.letter !== letter) sections.push({ letter, rows: [row] });
    else last.rows.push(row);
  }

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
        <MasteryPage mastered={mastered} leveled={leveled} onToggle={onToggleMastered} onToggleLeveled={onToggleLeveled} />
      ) : (
        <>
      {error && <p className="text-clay">{error}</p>}
      {loading && <p className="text-mute">Abriendo las piezas…</p>}
      {!loading && !error && (
        <>
          <div className="z-10 -mx-4 bg-ink/95 px-4 py-2 backdrop-blur-md lg:sticky lg:top-0 lg:-mx-8 lg:px-8">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,16rem)_minmax(0,18rem)_minmax(0,1fr)_auto] lg:items-center">
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
                <span className="sr-only">Tipo de pieza</span>
                <select
                  aria-label="Tipo de pieza"
                  value={activeType}
                  onChange={(event) => setType(event.target.value)}
                  className={FIELD}
                >
                  {types.map((entry) => (
                    <option key={entry.short} value={entry.short}>
                      {entry.short} {entry.owned}/{entry.total}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-0 sm:col-span-2 lg:col-span-1">
                <span className="sr-only">Filtra esta lista</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Filtra esta lista"
                  className={FIELD}
                />
              </label>
              <p className="text-sm text-mute tabular-nums lg:text-right">
                {ownedVisible}/{visible.length}
              </p>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-gold" style={{ width: `${progress}%` }} />
            </div>
          </div>
          {visible.length === 0 && <p className="mt-3 text-mute">Ninguna pieza de este tipo coincide.</p>}
          <div className="mt-1">
            {sections.map((section) => (
              <section key={section.letter}>
                <h2 className="mt-4 text-xs font-medium tracking-[0.16em] text-gold uppercase">{section.letter}</h2>
                <ul className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {section.rows.map((row) => {
                    const amount = qty[row.partId] ?? 0;
                    const owned = amount > 0;
                    const itemLabel = names.item(row.itemId, row.itemName);
                    const partLabel = names.part(row.partId, row.title, row.itemId, row.itemName);
                    return (
                      <li key={`${row.itemId}:${row.partId}`} className={`flex min-w-0 items-center border-t border-line/40 ${owned ? "opacity-60" : ""}`}>
                        <button
                          type="button"
                          aria-pressed={owned}
                          aria-label={`${owned ? "Quitar" : "Marcar"} ${partLabel}`}
                          onClick={() => onToggle(row.partId, owned ? 0 : 1)}
                          className="grid h-9 w-9 shrink-0 place-items-center"
                        >
                          <OwnedMark on={owned} />
                        </button>
                        <button type="button" onClick={() => onOpen(row.itemId)} className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left">
                          {row.image && (
                            <img src={row.image} alt="" width={32} height={32} className="h-8 w-8 shrink-0 object-contain" />
                          )}
                          <span className="min-w-0">
                            <span className="block truncate text-sm text-bone">{itemLabel}</span>
                            <span className="block truncate text-xs text-mute">
                              {KIND_LABEL[row.kind]}
                              {row.short !== "Plano" ? ` · ${row.short}` : ""}
                              {amount > 1 ? ` · ${amount}` : ""}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
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

function OwnedMark({ on }: { on: boolean }) {
  return (
    <span
      className={
        on
          ? "grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gold text-ink"
          : "h-5 w-5 shrink-0 rounded-full border border-line"
      }
      aria-hidden="true"
    >
      {on && (
        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="M3.5 8.2 6.4 11 12.5 4.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}
