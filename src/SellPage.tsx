import type { PriceQuote } from "./lib/market.ts";
import type { SellRow } from "./lib/catalogRemote.ts";

const KIND_LABEL = {
  warframe: "Warframe",
  primary: "Primaria",
  secondary: "Secundaria",
  melee: "Melee",
} as const;

export function SellPage({
  rows,
  prices,
  loading,
  pricesLoading,
  error,
  onOpen,
}: {
  rows: SellRow[];
  prices: Record<string, PriceQuote | null>;
  loading: boolean;
  pricesLoading: boolean;
  error: string;
  onOpen: (id: string) => void;
}) {
  if (loading) return <p className="text-mute">Abriendo lo que puedes vender…</p>;
  if (error) return <p className="text-clay">{error}</p>;
  if (rows.length === 0) {
    return (
      <p className="text-mute">
        Cuando construyas un ítem y te queden planos vendibles, o tengas un ítem sin planos, aparecen aquí con su precio.
      </p>
    );
  }

  const total = rows.reduce(
    (sum, row) => sum + row.parts.reduce((partSum, part) => partSum + lineTotal(part.qty, part.slug ? prices[part.slug] : null), 0),
    0,
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-mute">
        {pricesLoading ? "Consultando precios…" : `Si vendes los planos que tienes: ${total} pl.`} El set es el precio de todas las piezas juntas en el market.
      </p>
      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {rows.map((row) => (
          <li key={row.id} className="flex h-full flex-col rounded-2xl border border-line bg-panel px-4 py-3">
            <button type="button" onClick={() => onOpen(row.id)} className="flex w-full items-center gap-3 text-left">
              {row.image && <img src={row.image} alt="" className="h-16 w-16 shrink-0 rounded-xl bg-ink object-contain" />}
              <span className="min-w-0">
                <span className="block text-[11px] font-medium tracking-[0.16em] text-gold uppercase">{KIND_LABEL[row.kind]}</span>
                <span className="block truncate text-lg text-bone">{row.name}</span>
              </span>
            </button>
            <ul className="mt-3 flex flex-1 flex-col gap-2">
              {row.parts.map((part) => {
                const quote = part.slug ? prices[part.slug] : null;
                const subtotal = lineTotal(part.qty, quote);
                return (
                  <li key={part.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
                    <span className="min-w-0 text-bone">
                      {part.title}
                      <span className="text-mute"> × {part.qty}</span>
                    </span>
                    <span className="shrink-0 text-right text-mute">
                      {pricesLoading && !quote ? "…" : quote ? `${quote.platinum} pl · ${subtotal} pl` : "sin precio"}
                      {quote && (
                        <>
                          {" · "}
                          <a className="text-gold underline-offset-2 hover:underline" href={quote.url} target="_blank" rel="noreferrer">
                            Market
                          </a>
                        </>
                      )}
                    </span>
                  </li>
                );
              })}
              {row.setSlug && (
                <li className="mt-auto flex items-baseline justify-between gap-3 border-t border-line pt-2 text-sm">
                  <span className="text-bone">Set completo</span>
                  <SetPrice quote={prices[row.setSlug]} pending={pricesLoading} />
                </li>
              )}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

function lineTotal(qty: number, quote: PriceQuote | null | undefined) {
  if (!quote) return 0;
  return quote.platinum * qty;
}

function SetPrice({ quote, pending }: { quote: PriceQuote | null | undefined; pending: boolean }) {
  if (pending && !quote) return <span className="text-mute">…</span>;
  if (!quote) return <span className="text-mute">sin precio</span>;
  return (
    <span className="text-right text-mute">
      <span className="text-gold">{quote.platinum} pl</span>
      {" · "}
      <a className="text-gold underline-offset-2 hover:underline" href={quote.url} target="_blank" rel="noreferrer">
        Market
      </a>
    </span>
  );
}
