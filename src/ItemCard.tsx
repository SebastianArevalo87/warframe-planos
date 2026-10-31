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
  ownedParts: Set<string>;
  built: boolean;
  ownedItem: boolean;
  onHavePart: (id: string) => void;
  onForgetPart: (id: string) => void;
  onToggleBuilt: () => void;
  onToggleOwnedItem: () => void;
};

export function ItemCard({
  item,
  visiblePartIds,
  ownedParts,
  built,
  ownedItem,
  onHavePart,
  onForgetPart,
  onToggleBuilt,
  onToggleOwnedItem,
}: ItemCardProps) {
  const parts = visiblePartIds
    ? item.parts.filter((part) => visiblePartIds.includes(part.id))
    : item.parts;
  const ownedCount = item.parts.filter((part) => ownedParts.has(part.id)).length;
  const ready = item.parts.length > 0 && ownedCount === item.parts.length && !built;

  return (
    <article className="rounded-2xl border border-line bg-panel/90 px-4 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
      <header className="flex items-start gap-3">
        {item.image && <ItemImage src={item.image} large />}
        <div className="min-w-0 flex-1">
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
            </p>
          )}
        </div>
        {item.parts.length > 0 ? (
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
        ) : (
          <button
            type="button"
            onClick={onToggleOwnedItem}
            className={
              ownedItem
                ? "shrink-0 rounded-full border border-moss/40 px-3 py-2 text-sm text-moss"
                : "shrink-0 rounded-full bg-gold px-3 py-2 text-sm font-medium text-ink"
            }
          >
            {ownedItem ? "Quitar" : "Lo tengo"}
          </button>
        )}
      </header>

      {parts.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {parts.map((part) => (
            <PartRow
              key={part.id}
              part={part}
              owned={ownedParts.has(part.id)}
              locked={built}
              onHave={() => onHavePart(part.id)}
              onForget={() => onForgetPart(part.id)}
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

function PartRow({
  part,
  owned,
  locked,
  onHave,
  onForget,
}: {
  part: CatalogPart;
  owned: boolean;
  locked: boolean;
  onHave: () => void;
  onForget: () => void;
}) {
  const [quote, setQuote] = useState<PriceQuote | null>(null);
  const [priceState, setPriceState] = useState<"idle" | "loading" | "empty" | "error">("idle");

  async function consultPrice() {
    if (!part.slug) return;
    setPriceState("loading");
    setQuote(null);
    try {
      const next = await fetchPrice(part.slug);
      setQuote(next);
      setPriceState(next ? "idle" : "empty");
    } catch {
      setPriceState("error");
    }
  }

  return (
    <li className="rounded-xl border border-line/80 bg-ink/40 px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {part.image && <ItemImage src={part.image} compact />}
          <div className="min-w-0">
            <p className={owned ? "text-mute" : "text-bone"}>{part.title}</p>
            {owned && <p className="text-xs text-moss">Lo tengo</p>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {part.slug && (
            <button
              type="button"
              onClick={() => void consultPrice()}
              className="rounded-full px-2 py-2 text-sm text-mute hover:text-gold"
            >
              {priceState === "loading" ? "Consultando…" : "Precio"}
            </button>
          )}
          {!locked && !owned && (
            <button
              type="button"
              onClick={onHave}
              className="rounded-full bg-gold px-3 py-2 text-sm font-medium text-ink"
            >
              Lo tengo
            </button>
          )}
          {!locked && owned && (
            <button type="button" onClick={onForget} className="rounded-full px-3 py-2 text-sm text-mute">
              Quitar
            </button>
          )}
        </div>
      </div>
      {part.slug && priceState === "empty" && (
        <p className="mt-2 text-sm text-mute">Nadie lo está vendiendo ahora.</p>
      )}
      {priceState === "error" && (
        <p className="mt-2 text-sm text-clay">No pude consultar el precio. Inténtalo otra vez.</p>
      )}
      {quote && (
        <p className="mt-2 text-sm text-bone">
          <span className="font-medium text-gold">{quote.platinum} pl</span>
          <span className="text-mute">
            {" "}
            · {quote.seller} {quote.live ? "está en el juego" : "no está en línea"}
          </span>
          {" · "}
          <a className="text-gold underline-offset-2 hover:underline" href={quote.url} target="_blank" rel="noreferrer">
            Ver en el market
          </a>
        </p>
      )}
    </li>
  );
}
