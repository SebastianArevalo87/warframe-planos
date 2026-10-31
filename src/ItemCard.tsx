import { useState } from "react";
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
  draftParts: Set<string>;
  built: boolean;
  ownedItem: boolean;
  onPickPart: (id: string) => void;
  onUnpickDraft: (id: string) => void;
  onForgetPart: (id: string) => void;
  onToggleBuilt: () => void;
  onToggleOwnedItem: () => void;
};

export function ItemCard({
  item,
  visiblePartIds,
  ownedParts,
  draftParts,
  built,
  ownedItem,
  onPickPart,
  onUnpickDraft,
  onForgetPart,
  onToggleBuilt,
  onToggleOwnedItem,
}: ItemCardProps) {
  const parts = visiblePartIds
    ? item.parts.filter((part) => visiblePartIds.includes(part.id))
    : item.parts;
  const ownedCount = item.parts.filter((part) => ownedParts.has(part.id) || draftParts.has(part.id)).length;
  const ready = item.parts.length > 0 && ownedCount === item.parts.length && !built;

  return (
    <article className="rounded-2xl border border-line bg-panel/90 px-4 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
      <header className="flex items-start gap-3">
        {item.image && <ItemImage src={item.image} />}
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
              drafted={draftParts.has(part.id)}
              locked={built}
              onPick={() => onPickPart(part.id)}
              onUnpick={() => onUnpickDraft(part.id)}
              onForget={() => onForgetPart(part.id)}
            />
          ))}
        </ul>
      )}
    </article>
  );
}

function ItemImage({ src, compact = false }: { src: string; compact?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  const size = compact ? 40 : 56;
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={
        compact
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
  drafted,
  locked,
  onPick,
  onUnpick,
  onForget,
}: {
  part: CatalogPart;
  owned: boolean;
  drafted: boolean;
  locked: boolean;
  onPick: () => void;
  onUnpick: () => void;
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
    <li
      className={
        drafted
          ? "rounded-xl border border-gold/50 bg-gold/10 px-3 py-2"
          : "rounded-xl border border-line/80 bg-ink/40 px-3 py-2"
      }
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {part.image && <ItemImage src={part.image} compact />}
          <div className="min-w-0">
            <p className={owned ? "text-mute" : "text-bone"}>{part.title}</p>
            {owned && <p className="text-xs text-moss">Lo tengo</p>}
            {drafted && <p className="text-xs text-gold">Elegido en esta partida</p>}
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
          {!locked && !owned && !drafted && (
            <button
              type="button"
              onClick={onPick}
              className="rounded-full bg-gold px-3 py-2 text-sm font-medium text-ink"
            >
              Lo elegí
            </button>
          )}
          {!locked && drafted && (
            <button type="button" onClick={onUnpick} className="rounded-full px-3 py-2 text-sm text-gold">
              Quitar
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
