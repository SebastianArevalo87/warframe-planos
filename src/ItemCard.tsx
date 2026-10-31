import { useState } from "react";
import type { ItemSummary } from "./lib/catalogRemote.ts";
import type { CatalogItem, CatalogPart } from "./types.ts";
import { fetchPrice, type PriceQuote } from "./lib/market.ts";

const KIND_LABEL = {
  warframe: "Warframe",
  primary: "Primaria",
  secondary: "Secundaria",
  melee: "Melee",
} as const;

type ItemCardProps = {
  item: CatalogItem;
  visiblePartIds: string[] | null;
  qty: Record<string, number>;
  built: boolean;
  onPartQty: (id: string, next: number) => void;
  onItemQty: (next: number) => void;
  onToggleBuilt: () => void;
};

function sellable(part: { tradable: boolean; slug: string | null }) {
  return part.tradable || part.slug !== null;
}

export function ItemCard({
  item,
  visiblePartIds,
  qty,
  built,
  onPartQty,
  onItemQty,
  onToggleBuilt,
}: ItemCardProps) {
  const parts = visiblePartIds
    ? item.parts.filter((part) => visiblePartIds.includes(part.id))
    : item.parts;
  const ownedCount = item.parts.filter((part) => (qty[part.id] ?? 0) > 0).length;
  const ready = item.parts.length > 0 && ownedCount === item.parts.length && !built;
  const sellCopies = item.parts.reduce((sum, part) => (sellable(part) ? sum + (qty[part.id] ?? 0) : sum), 0);
  const itemCopies = qty[item.id] ?? 0;

  return (
    <article className="rounded-2xl border border-line bg-panel/90 px-4 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
      <header className="flex flex-wrap items-start gap-3">
        {item.image && <ItemImage src={item.image} large />}
        <div className="min-w-0 flex-1 basis-48">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium tracking-[0.16em] text-gold uppercase">
              {KIND_LABEL[item.kind]}
            </span>
            {item.vaulted && (
              <span className="rounded-full bg-clay/15 px-2 py-0.5 text-[11px] text-clay">En la bóveda</span>
            )}
            {ready && (
              <span className="rounded-full bg-moss/15 px-2 py-0.5 text-[11px] text-moss">Listo para fundir</span>
            )}
            {built && (
              <span className="rounded-full bg-moss/15 px-2 py-0.5 text-[11px] text-moss">Construido</span>
            )}
          </div>
          <h2 className="mt-1 text-lg font-medium text-bone">{item.name}</h2>
          {item.parts.length > 0 && (
            <p className="text-sm text-mute">
              {ownedCount} de {item.parts.length} planos
              {sellCopies > 0 ? ` · ${sellCopies} para vender` : ""}
            </p>
          )}
          {item.parts.length === 0 && itemCopies > 0 && (
            <p className="text-sm text-mute">{itemCopies} {itemCopies === 1 ? "copia" : "copias"}</p>
          )}
        </div>
        {item.parts.length > 0 && (
          <button
            type="button"
            onClick={onToggleBuilt}
            className={
              built
                ? "shrink-0 rounded-full border border-moss/40 px-3 py-2 text-sm text-moss"
                : "shrink-0 rounded-full border border-line px-3 py-2 text-sm text-bone hover:border-gold"
            }
          >
            {built ? "Quitar construido" : "Ya lo construí"}
          </button>
        )}
      </header>

      {item.parts.length === 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line/80 bg-ink/40 px-3 py-2">
          <div>
            <p className="text-bone">Cantidad</p>
            {item.slug ? (
              <p className="text-xs text-gold">Vendible en el market</p>
            ) : (
              <p className="text-xs text-mute">Este ítem no trae planos</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {item.slug && <PriceButton slug={item.slug} />}
            <Quantity value={itemCopies} label={item.name} onChange={onItemQty} />
          </div>
        </div>
      )}

      {parts.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {parts.map((part) => (
            <PartRow
              key={part.id}
              part={part}
              amount={qty[part.id] ?? 0}
              onQty={(next) => onPartQty(part.id, next)}
            />
          ))}
        </ul>
      )}
    </article>
  );
}

function tileProgress(item: ItemSummary): { label: string; tone: "built" | "ready" | "few" | "partial" | "none" } {
  if (item.built || (item.partCount === 0 && item.ownedItem)) return { label: "Construido", tone: "built" };
  if (item.partCount === 0 || item.ownedCount === 0) return { label: "Falta todo", tone: "none" };
  if (item.ownedCount === item.partCount) return { label: "Listo para fundir", tone: "ready" };
  const missing = item.partCount - item.ownedCount;
  if (missing <= 2) return { label: missing === 1 ? "Falta 1 plano" : "Faltan 2 planos", tone: "few" };
  return { label: `Faltan ${missing} planos`, tone: "partial" };
}

const TILE_FRAME = {
  built: "border-moss/80",
  ready: "border-moss/80",
  few: "border-gold",
  partial: "border-clay/80",
  none: "border-line",
} as const;

const TILE_BADGE = {
  built: "bg-moss/25 text-moss",
  ready: "bg-moss/25 text-moss",
  few: "bg-gold/20 text-gold",
  partial: "bg-clay/20 text-clay",
  none: "bg-ink/80 text-mute",
} as const;

export function ItemTile({ item, onOpen }: { item: ItemSummary; onOpen: () => void }) {
  const progress = tileProgress(item);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${item.name}. ${progress.label}`}
      className={`relative aspect-square w-full overflow-hidden rounded-2xl border bg-ink text-left ${TILE_FRAME[progress.tone]}`}
    >
      {item.image && (
        <img
          src={item.image}
          alt=""
          loading="lazy"
          decoding="async"
          className={`absolute inset-0 h-full w-full object-contain p-3 ${progress.tone === "none" ? "opacity-45" : ""}`}
        />
      )}
      <span className={`absolute top-2 left-2 rounded-full px-2 py-0.5 text-[11px] font-medium ${TILE_BADGE[progress.tone]}`}>
        {progress.label}
      </span>
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink via-ink/85 to-transparent px-2.5 pt-10 pb-2.5">
        <span className="block truncate text-sm font-medium text-bone">{item.name}</span>
        {item.vaulted && <span className="text-[10px] text-clay">En la bóveda</span>}
      </span>
    </button>
  );
}

function ItemImage({ src, compact = false, large = false }: { src: string; compact?: boolean; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  const size = large ? 112 : compact ? 40 : 56;
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={
        large
          ? "h-28 w-28 shrink-0 rounded-2xl bg-ink object-contain"
          : compact
            ? "h-10 w-10 shrink-0 rounded-lg bg-ink object-contain"
            : "h-14 w-14 shrink-0 rounded-xl bg-ink object-contain"
      }
      onError={() => setFailed(true)}
    />
  );
}

function Quantity({ value, label, onChange }: { value: number; label: string; onChange: (next: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label={`Una menos de ${label}`}
        disabled={value <= 0}
        onClick={() => onChange(value - 1)}
        className="grid h-9 w-9 place-items-center rounded-full border border-line text-lg text-bone disabled:opacity-30"
      >
        −
      </button>
      <span className="w-8 text-center text-sm text-bone">{value}</span>
      <button
        type="button"
        aria-label={`Una más de ${label}`}
        disabled={value >= 99}
        onClick={() => onChange(value + 1)}
        className="grid h-9 w-9 place-items-center rounded-full border border-line text-lg text-bone disabled:opacity-30"
      >
        +
      </button>
    </div>
  );
}

function PriceButton({ slug }: { slug: string }) {
  const [quote, setQuote] = useState<PriceQuote | null>(null);
  const [priceState, setPriceState] = useState<"idle" | "loading" | "empty" | "error">("idle");

  async function consultPrice() {
    setPriceState("loading");
    setQuote(null);
    try {
      const next = await fetchPrice(slug);
      setQuote(next);
      setPriceState(next ? "idle" : "empty");
    } catch {
      setPriceState("error");
    }
  }

  return (
    <div className="text-right">
      <button type="button" onClick={() => void consultPrice()} className="rounded-full px-2 py-2 text-sm text-mute hover:text-gold">
        {priceState === "loading" ? "Consultando…" : "Precio"}
      </button>
      {priceState === "empty" && <p className="text-xs text-mute">Nadie lo vende ahora.</p>}
      {priceState === "error" && <p className="text-xs text-clay">No pude ver el precio.</p>}
      {quote && (
        <p className="text-xs text-bone">
          <span className="font-medium text-gold">{quote.platinum} pl</span>
          {" · "}
          <a className="text-gold underline-offset-2 hover:underline" href={quote.url} target="_blank" rel="noreferrer">
            Market
          </a>
        </p>
      )}
    </div>
  );
}

function PartRow({ part, amount, onQty }: { part: CatalogPart; amount: number; onQty: (next: number) => void }) {
  const vendible = sellable(part);
  return (
    <li className="rounded-xl border border-line/80 bg-ink/40 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {part.image && <ItemImage src={part.image} compact />}
          <div className="min-w-0">
            <p className={amount > 0 ? "text-bone" : "text-mute"}>{part.title}</p>
            {vendible ? (
              <p className="text-xs text-gold">{amount > 0 ? `${amount} para vender` : "Vendible en el market"}</p>
            ) : (
              amount > 0 && <p className="text-xs text-moss">Lo tengo</p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {part.slug && <PriceButton slug={part.slug} />}
          {vendible ? (
            <Quantity value={amount} label={part.title} onChange={onQty} />
          ) : amount > 0 ? (
            <button type="button" onClick={() => onQty(0)} className="rounded-full px-3 py-2 text-sm text-mute">
              Quitar
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onQty(1)}
              className="rounded-full bg-gold px-3 py-2 text-sm font-medium text-ink"
            >
              Lo tengo
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
