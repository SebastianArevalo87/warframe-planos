import type { KindFilter, StatusFilter } from "./types.ts";

const KIND_OPTIONS: Array<{ id: KindFilter; label: string }> = [
  { id: "all", label: "Todo" },
  { id: "warframe", label: "Warframes" },
  { id: "weapon", label: "Armas" },
  { id: "primary", label: "Primarias" },
  { id: "secondary", label: "Secundarias" },
  { id: "melee", label: "Cuerpo a cuerpo" },
  { id: "archwing", label: "Archwing" },
  { id: "archgun", label: "Archcañón" },
  { id: "archmelee", label: "Archmelee" },
  { id: "companion", label: "Compañero" },
  { id: "robotic", label: "Robótico" },
  { id: "amp", label: "Amps" },
];

const STATUS_OPTIONS: Array<{ id: StatusFilter; label: string }> = [
  { id: "missing", label: "Faltan" },
  { id: "ready", label: "Listos" },
  { id: "built", label: "Construidos" },
  { id: "almost", label: "Casi" },
  { id: "owned", label: "Con planos" },
  { id: "all", label: "Todos" },
];

export function FilterBar({
  query,
  onQuery,
  queryLabel,
  placeholder,
  kind,
  onKind,
  status,
  onStatus,
}: {
  query: string;
  onQuery: (value: string) => void;
  queryLabel: string;
  placeholder: string;
  kind: KindFilter;
  onKind: (kind: KindFilter) => void;
  status?: StatusFilter;
  onStatus?: (status: StatusFilter) => void;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <label className="min-w-0 flex-1">
        <span className="sr-only">{queryLabel}</span>
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder={placeholder}
          className="w-full rounded-full border border-line bg-panel px-3 py-2 text-sm text-bone outline-none placeholder:text-mute/70 focus:border-gold"
        />
      </label>
      <div className={status && onStatus ? "grid grid-cols-2 gap-2 sm:flex" : "sm:flex"}>
        <Select
          label="Tipo"
          value={kind}
          wide={Boolean(status && onStatus)}
          onChange={(value) => onKind(value as KindFilter)}
          options={KIND_OPTIONS}
        />
        {status && onStatus && (
          <Select
            label="Estado"
            value={status}
            wide
            onChange={(value) => onStatus(value as StatusFilter)}
            options={STATUS_OPTIONS}
          />
        )}
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  wide = false,
  onChange,
  options,
}: {
  label: string;
  value: string;
  wide?: boolean;
  onChange: (value: string) => void;
  options: Array<{ id: string; label: string }>;
}) {
  return (
    <label className="min-w-0">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${wide ? "w-full sm:w-auto" : "w-auto"} rounded-full border border-line bg-panel px-3 py-2 text-sm text-bone outline-none focus:border-gold`}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
