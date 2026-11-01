import { useEffect, useMemo, useState } from "react";
import { fetchLoadIndex, type LoadRow } from "./lib/catalogRemote.ts";
import { MasteryPage } from "./MasteryPage.tsx";
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
  const letter = fold(name).charAt(0).toUpperCase();
  return /[A-Z]/.test(letter) ? letter : "#";
}

export function LoadPage({
  qty,
  onToggle,
  onOpen,
  mastered,
  onToggleMastered,
}: {
  qty: Record<string, number>;
  onToggle: (partId: string, next: number) => void;
  onOpen: (itemId: string) => void;
  mastered: string[];
  onToggleMastered: (itemId: string) => void;
}) {
  const [rows, setRows] = useState<LoadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [group, setGroup] = useState<GroupId>("warframe");
  const [type, setType] = useState("Plano");
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"parts" | "mastered">("parts");

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
  }, []);

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

  const needle = fold(query.trim());
  const visible = grouped
    .filter((row) => row.short === activeType && (needle === "" || fold(row.itemName).includes(needle) || fold(row.title).includes(needle)))
    .sort((a, b) => a.itemName.localeCompare(b.itemName, "es") || a.title.localeCompare(b.title, "es"));
  const ownedVisible = visible.filter((row) => (qty[row.partId] ?? 0) > 0).length;
  const progress = visible.length === 0 ? 0 : Math.round((ownedVisible / visible.length) * 100);
  const sections: Array<{ letter: string; rows: LoadRow[] }> = [];
  for (const row of visible) {
    const letter = letterOf(row.itemName);
    const last = sections[sections.length - 1];
    if (!last || last.letter !== letter) sections.push({ letter, rows: [row] });
    else last.rows.push(row);
  }

  return (
    <div>
      <div className="mb-4 flex gap-2" role="tablist" aria-label="Qué vas a cargar">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "parts"}
          onClick={() => setMode("parts")}
          className={mode === "parts" ? "rounded-full bg-bone px-3 py-1.5 text-sm text-ink" : "rounded-full border border-line px-3 py-1.5 text-sm text-mute hover:text-bone"}
        >
          Planos
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "mastered"}
          onClick={() => setMode("mastered")}
          className={mode === "mastered" ? "rounded-full bg-bone px-3 py-1.5 text-sm text-ink" : "rounded-full border border-line px-3 py-1.5 text-sm text-mute hover:text-bone"}
        >
          Dominados
        </button>
      </div>
      {mode === "mastered" ? (
        <MasteryPage mastered={mastered} onToggle={onToggleMastered} />
      ) : (
        <>
      <p className="text-sm text-mute">Marca lo que ya tienes. Las pestañas siguen el orden de la fundición.</p>
      {error && <p className="mt-3 text-clay">{error}</p>}
      {loading && <p className="mt-4 text-mute">Abriendo las piezas…</p>}
      {!loading && !error && (
        <>
          <div className="z-10 -mx-4 mt-3 bg-ink/95 px-4 py-3 backdrop-blur-md lg:sticky lg:top-0 lg:-mx-8 lg:px-8">
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Pestaña de la fundición">
              {groups.map((entry) => {
                const done = entry.total > 0 && entry.owned === entry.total;
                const selected = entry.id === group;
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
                        : done
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
            <div className="mt-2 flex flex-wrap gap-1" role="tablist" aria-label="Tipo de pieza">
              {types.map((entry) => {
                const done = entry.total > 0 && entry.owned === entry.total;
                const selected = entry.short === activeType;
                return (
                  <button
                    key={entry.short}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setType(entry.short)}
                    className={
                      selected
                        ? "rounded-lg bg-gold/20 px-2.5 py-1 text-sm text-gold"
                        : done
                          ? "rounded-lg px-2.5 py-1 text-sm text-moss hover:bg-panel"
                          : "rounded-lg px-2.5 py-1 text-sm text-mute hover:bg-panel hover:text-bone"
                    }
                  >
                    {entry.short}
                    <span className="ml-1 tabular-nums opacity-70">
                      {entry.owned}/{entry.total}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <label className="min-w-0 flex-1">
                <span className="sr-only">Filtra esta lista</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Filtra esta lista"
                  className="w-full rounded-full border border-line bg-panel px-3 py-2 text-sm text-bone outline-none placeholder:text-mute/70 focus:border-gold"
                />
              </label>
              <p className="shrink-0 text-sm text-mute tabular-nums">
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
                <ul className="lg:grid lg:grid-cols-2 lg:gap-x-8">
                  {section.rows.map((row) => {
                    const amount = qty[row.partId] ?? 0;
                    const owned = amount > 0;
                    return (
                      <li key={`${row.itemId}:${row.partId}`} className="border-t border-line/40">
                        <div className={`flex min-w-0 items-center gap-3 py-2 ${owned ? "opacity-55" : ""}`}>
                          <input
                            type="checkbox"
                            checked={owned}
                            onChange={() => onToggle(row.partId, owned ? 0 : 1)}
                            aria-label={`${owned ? "Quitar" : "Marcar"} ${row.title}`}
                            className="h-5 w-5 shrink-0 accent-[#e0b15a]"
                          />
                          {row.image && (
                            <img src={row.image} alt="" width={36} height={36} className="h-9 w-9 shrink-0 object-contain" />
                          )}
                          <button type="button" onClick={() => onOpen(row.itemId)} className="min-w-0 flex-1 py-1 text-left">
                            <span className="block truncate text-sm text-bone">{row.itemName}</span>
                            <span className="block truncate text-xs text-mute">
                              {KIND_LABEL[row.kind]}
                              {row.short !== "Plano" ? ` · ${row.short}` : ""}
                              {amount > 1 ? ` · ${amount}` : ""}
                            </span>
                          </button>
                        </div>
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
