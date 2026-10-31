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

export async function fetchPrice(slug: string): Promise<PriceQuote | null> {
  const response = await fetch(`/market/v2/orders/item/${encodeURIComponent(slug)}/top`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("price");
  const json = (await response.json()) as { data?: { sell?: Order[] } };
  const sells = (json.data?.sell ?? [])
    .filter((order) => order.visible !== false && typeof order.platinum === "number")
    .sort((a, b) => (a.platinum ?? 0) - (b.platinum ?? 0));
  const live = sells.find((order) => order.user?.status === "online" || order.user?.status === "ingame");
  const pick = live ?? sells[0];
  if (!pick || typeof pick.platinum !== "number") return null;
  return {
    platinum: pick.platinum,
    seller: pick.user?.ingameName ?? "un vendedor",
    live: pick === live,
    url: `https://warframe.market/items/${slug}`,
  };
}
