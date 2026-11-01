import { useEffect, useMemo, useState } from "react";
import { fetchLoadIndex, type LoadRow } from "./lib/catalogRemote.ts";
import type { ItemKind } from "./types.ts";

const KIND_LABEL: Record<ItemKind, string> = {
  warframe: "Warframe",
  primary: "Primaria",
  secondary: "Secundaria",
  melee: "Melee",
};

const TYPE_ORDER = [
  "Plano",
  "Neurópticas",
  "Chasis",
  "Sistemas",
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

export function LoadPage({
  qty,
  onToggle,
  onOpen,
}: {
  qty: Record<string, number>;
  onToggle: (partId: string, next: number) => void;
  onOpen: (itemId: string) => void;
}) {
  const [rows, setRows] = useState<LoadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [type, setType] = useState("Chasis");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchLoadIndex()
      .then((next) => {
        if (cancelled) return;
        setRows(next);
        setType((current) => (next.some((row) => row.short === current) ? current : (next[0]?.short ?? current)));
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

  const types = useMemo(() => {
    const counts = new Map<string, { total: number; owned: number }>();
    for (const row of rows) {
      const current = counts.get(row.short) ?? { total: 0, owned: 0 };
      current.total += 1;
      if ((qty[row.partId] ?? 0) > 0) current.owned += 1;
      counts.set(row.short, current);
    }
    return [...counts.entries()]
      .map(([short, count]) => ({ short, ...count }))
      .sort((a, b) => {
        const aOrder = TYPE_ORDER.indexOf(a.short);
        const bOrder = TYPE_ORDER.indexOf(b.short);
        if (aOrder !== -1 || bOrder !== -1) {
          if (aOrder === -1) return 1;
          if (bOrder === -1) return -1;
          return aOrder - bOrder;
        }
        return a.short.localeCompare(b.short, "es");
      });
  }, [qty, rows]);

  const needle = fold(query.trim());
  const visible = rows
    .filter((row) => row.short === type && (needle === "" || fold(row.itemName).includes(needle) || fold(row.title).includes(needle)))
    .sort((a, b) => a.itemName.localeCompare(b.itemName, "es") || a.title.localeCompare(b.title, "es"));
  const ownedVisible = visible.filter((row) => (qty[row.partId] ?? 0) > 0).length;

  return (
    <div>
      <p className="text-sm text-mute">
        Elige el grupo que estás viendo en el inventario. Sirve para warframes y para armas, y marca el mismo «Lo tengo» de la ficha.
      </p>
      {error && <p className="mt-3 text-clay">{error}</p>}
      {loading && <p className="mt-4 text-mute">Abriendo las piezas…</p>}
      {!loading && !error && (
        <>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Tipo de pieza">
            {types.map((entry) => (
              <button
                key={entry.short}
                type="button"
                role="tab"
                aria-selected={entry.short === type}
                onClick={() => setType(entry.short)}
                className={
                  entry.short === type
                    ? "shrink-0 rounded-full bg-bone px-3 py-1.5 text-sm text-ink"
                    : "shrink-0 rounded-full border border-line px-3 py-1.5 text-sm text-mute hover:text-bone"
                }
              >
                {entry.short}
                <span className="ml-1 tabular-nums opacity-70">
                  {entry.owned}/{entry.total}
                </span>
              </button>
            ))}
          </div>
          <label className="mt-3 block">
            <span className="sr-only">Filtra esta lista</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filtra esta lista"
              className="w-full rounded-full border border-line bg-panel px-3 py-2 text-sm text-bone outline-none placeholder:text-mute/70 focus:border-gold"
            />
          </label>
          <p className="mt-3 text-sm text-mute">
            {ownedVisible} de {visible.length} {visible.length === 1 ? "pieza" : "piezas"}.
          </p>
          {visible.length === 0 && <p className="mt-3 text-mute">Ninguna pieza de este tipo coincide.</p>}
          <ul className="mt-2 lg:grid lg:grid-cols-2 lg:gap-x-8">
            {visible.map((row) => {
              const amount = qty[row.partId] ?? 0;
              return (
                <li key={`${row.itemId}:${row.partId}`} className="border-t border-line/40">
                  <div className="flex min-w-0 items-center gap-3 py-2">
                    <input
                      type="checkbox"
                      checked={amount > 0}
                      onChange={() => onToggle(row.partId, amount > 0 ? 0 : 1)}
                      aria-label={`${amount > 0 ? "Quitar" : "Marcar"} ${row.title}`}
                      className="h-4 w-4 shrink-0 accent-[#e0b15a]"
                    />
                    {row.image && (
                      <img src={row.image} alt="" width={36} height={36} className="h-9 w-9 shrink-0 object-contain" />
                    )}
                    <button type="button" onClick={() => onOpen(row.itemId)} className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-sm text-bone">{row.itemName}</span>
                      <span className="block truncate text-xs text-mute">
                        {KIND_LABEL[row.kind]}
                        {amount > 1 ? ` · ${amount}` : ""}
                      </span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
