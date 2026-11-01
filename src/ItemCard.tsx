import { useEffect, useMemo, useState } from "react";
import type { ItemSummary } from "./lib/catalogRemote.ts";
import type { CatalogItem, CatalogPart } from "./types.ts";
import { fetchPrice, fetchPrices, marketItemUrl, type PriceQuote } from "./lib/market.ts";
import { sumMaterials } from "./lib/materials.ts";
import { MaterialList, MaterialTotals } from "./MaterialTotals.tsx";

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
  craftedParts: string[];
  onToggleCrafted: (partId: string) => void;
  onPartQty: (id: string, next: number) => void;
  onItemQty: (next: number) => void;
  onToggleBuilt: () => void;
  onShowRelics?: () => void;
};

function sellable(part: { tradable: boolean; slug: string | null }) {
  return part.tradable || part.slug !== null;
}

export function ItemCard({
  item,
  visiblePartIds,
  qty,
  built,
  craftedParts,
  onToggleCrafted,
  onPartQty,
  onItemQty,
  onToggleBuilt,
  onShowRelics,
}: ItemCardProps) {
  const parts = visiblePartIds
    ? item.parts.filter((part) => visiblePartIds.includes(part.id))
    : item.parts;
  const ownedCount = item.parts.filter((part) => (qty[part.id] ?? 0) > 0).length;
  const ready = item.parts.length > 0 && ownedCount === item.parts.length && !built;
  const sellCopies = built
    ? item.parts.reduce((sum, part) => (sellable(part) ? sum + (qty[part.id] ?? 0) : sum), 0)
    : 0;
  const itemCopies = qty[item.id] ?? 0;
  const missingSlugs = useMemo(() => {
    if (built || item.parts.length === 0) return [];
    const slugs = item.parts.flatMap((part) => ((qty[part.id] ?? 0) === 0 && part.slug ? [part.slug] : []));
    if (slugs.length === 0) return [];
    return item.setSlug ? [...new Set([...slugs, item.setSlug])] : [...new Set(slugs)];
  }, [built, item, qty]);
  const [buyPrices, setBuyPrices] = useState<Record<string, PriceQuote | null>>({});
  const [buyLoading, setBuyLoading] = useState(false);
  const missingKey = missingSlugs.join("|");
  const crafted = new Set(craftedParts);
  const remainingMaterials = sumMaterials(
    built ? [] : item.parts.filter((part) => !crafted.has(part.id)).map((part) => part.materials ?? []),
  );

  useEffect(() => {
    const slugs = missingKey ? missingKey.split("|") : [];
    if (slugs.length === 0) return;
    let cancelled = false;
    setBuyLoading(true);
    void fetchPrices(slugs)
      .then((next) => {
        if (!cancelled) setBuyPrices(next);
      })
      .finally(() => {
        if (!cancelled) setBuyLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [missingKey]);

  return (
    <article className="min-w-0 max-w-full rounded-2xl border border-line bg-panel/90 px-4 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
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
          <div className="flex shrink-0 flex-wrap gap-2">
            {onShowRelics && item.parts.some((part) => part.relics.length > 0) && (
              <button
                type="button"
                onClick={onShowRelics}
                className="rounded-full border border-line px-3 py-2 text-sm text-bone hover:border-gold"
              >
                Reliquias
              </button>
            )}
            <button
              type="button"
              onClick={onToggleBuilt}
              className={
                built
                  ? "rounded-full border border-moss/40 px-3 py-2 text-sm text-moss"
                  : "rounded-full border border-line px-3 py-2 text-sm text-bone hover:border-gold"
              }
            >
              {built ? "Quitar construido" : "Ya lo construí"}
            </button>
          </div>
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
        <div className="mt-3 flex flex-col gap-3">
          {!built && (
            <MaterialTotals
              title="Materiales para construir"
              note="Costo de las piezas que todavía no marcaste como construidas."
              materials={remainingMaterials}
            />
          )}
          <ul className="flex flex-col gap-2">
            {parts.map((part) => (
              <PartRow
                key={part.id}
                part={part}
                amount={qty[part.id] ?? 0}
                built={built}
                crafted={crafted.has(part.id)}
                quote={part.slug ? buyPrices[part.slug] : null}
                pricePending={buyLoading}
                onQty={(next) => onPartQty(part.id, next)}
                onToggleCrafted={() => onToggleCrafted(part.id)}
              />
            ))}
          </ul>
        </div>
      )}
      {!built && item.setSlug && missingSlugs.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold/30 bg-ink/40 px-3 py-2">
          <p className="text-bone">Set completo</p>
          <BuyLink
            label="el set completo"
            slug={item.setSlug}
            quote={buyPrices[item.setSlug]}
            pending={buyLoading}
          />
        </div>
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

function BuyLink({
  label,
  slug,
  quote,
  pending,
}: {
  label: string;
  slug: string;
  quote: PriceQuote | null | undefined;
  pending: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gold">{pending && !quote ? "…" : quote ? `${quote.platinum} pl` : "sin precio"}</span>
      <a
        href={marketItemUrl(slug)}
        target="_blank"
        rel="noreferrer"
        aria-label={`Comprar ${label} en Warframe Market`}
        className="rounded-full border border-gold px-3 py-1.5 text-sm text-gold hover:bg-gold hover:text-ink"
      >
        Comprar
      </a>
    </div>
  );
}

function PartRow({
  part,
  amount,
  built,
  crafted,
  quote,
  pricePending,
  onQty,
  onToggleCrafted,
}: {
  part: CatalogPart;
  amount: number;
  built: boolean;
  crafted: boolean;
  quote: PriceQuote | null | undefined;
  pricePending: boolean;
  onQty: (next: number) => void;
  onToggleCrafted: () => void;
}) {
  const vendible = sellable(part);
  const forSale = vendible && built && amount > 0;
  const needsBuy = !built && amount === 0 && part.slug !== null;
  return (
    <li className="min-w-0 rounded-xl border border-line/80 bg-ink/40 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 basis-full items-center gap-2 sm:basis-auto sm:flex-1">
          {part.image && <ItemImage src={part.image} compact />}
          <div className="min-w-0">
            <p className={amount > 0 ? "break-words text-bone" : "break-words text-mute"}>{part.title}</p>
            {forSale ? (
              <p className="text-xs text-gold">{amount} para vender</p>
            ) : (
              amount > 0 && <p className="text-xs text-moss">Lo tengo</p>
            )}
          </div>
        </div>
        <div className="flex max-w-full flex-wrap items-center gap-2">
          {needsBuy && part.slug && (
            <BuyLink label={part.title} slug={part.slug} quote={quote} pending={pricePending} />
          )}
          {!needsBuy && part.slug && <PriceButton slug={part.slug} />}
          {!built && part.materials.length > 0 && (
            <button
              type="button"
              onClick={onToggleCrafted}
              className={
                crafted
                  ? "rounded-full border border-moss/40 px-3 py-1.5 text-sm text-moss"
                  : "rounded-full border border-line px-3 py-1.5 text-sm text-bone hover:border-gold"
              }
            >
              {crafted ? "Construida" : "Ya la construí"}
            </button>
          )}
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
      {!built && part.materials.length > 0 && (
        <div className={crafted ? "mt-2 opacity-70" : "mt-2"}>
          <MaterialList materials={part.materials} muted={crafted} />
        </div>
      )}
    </li>
  );
}
