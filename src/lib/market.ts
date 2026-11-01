import { supabase } from "./supabase.ts";

export function marketItemUrl(slug: string) {
  return `https://warframe.market/items/${slug}`;
}

export type PriceQuote = {
  platinum: number;
  seller: string;
  live: boolean;
  url: string;
};

type Order = {
  platinum?: number;
  visible?: boolean;
  user?: { ingameName?: string; status?: string };
};

function marketUrl(path: string): string {
  if (import.meta.env.DEV) return `/market${path}`;
  return `https://api.warframe.market${path}`;
}

function quoteFromOrders(slug: string, sells: Order[]): PriceQuote | null {
  const visible = sells
    .filter((order) => order.visible !== false && typeof order.platinum === "number")
    .sort((a, b) => (a.platinum ?? 0) - (b.platinum ?? 0));
  const live = visible.find((order) => order.user?.status === "online" || order.user?.status === "ingame");
  const pick = live ?? visible[0];
  if (!pick || typeof pick.platinum !== "number") return null;
  return {
    platinum: pick.platinum,
    seller: pick.user?.ingameName ?? "un vendedor",
    live: pick === live,
    url: marketItemUrl(slug),
  };
}

async function fetchPriceDirect(slug: string): Promise<PriceQuote | null> {
  const response = await fetch(marketUrl(`/v2/orders/item/${encodeURIComponent(slug)}/top`));
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("price");
  const json = (await response.json()) as { data?: { sell?: Order[] } };
  return quoteFromOrders(slug, json.data?.sell ?? []);
}

function asQuote(slug: string, value: unknown): PriceQuote | null {
  if (!value || typeof value !== "object") return null;
  const quote = value as Partial<PriceQuote>;
  if (typeof quote.platinum !== "number") return null;
  return {
    platinum: quote.platinum,
    seller: typeof quote.seller === "string" ? quote.seller : "un vendedor",
    live: quote.live === true,
    url: typeof quote.url === "string" ? quote.url : marketItemUrl(slug),
  };
}

export async function fetchPrice(slug: string): Promise<PriceQuote | null> {
  if (!supabase) return fetchPriceDirect(slug);
  const { data, error } = await supabase.functions.invoke("market-price", { body: { slug } });
  if (error) throw new Error("price");
  return asQuote(slug, data);
}

export async function fetchPrices(slugs: string[]): Promise<Record<string, PriceQuote | null>> {
  const unique = [...new Set(slugs.filter((slug) => slug.length > 0))];
  const quotes: Record<string, PriceQuote | null> = {};
  if (unique.length === 0) return quotes;
  if (!supabase) {
    await Promise.all(
      unique.map(async (slug) => {
        quotes[slug] = await fetchPriceDirect(slug).catch(() => null);
      }),
    );
    return quotes;
  }
  for (let index = 0; index < unique.length; index += 12) {
    const batch = unique.slice(index, index + 12);
    const { data, error } = await supabase.functions.invoke("market-price", { body: { slugs: batch } });
    const map =
      !error && data && typeof data === "object" && "quotes" in data
        ? ((data as { quotes?: Record<string, unknown> }).quotes ?? {})
        : {};
    for (const slug of batch) quotes[slug] = asQuote(slug, map[slug]);
  }
  return quotes;
}
