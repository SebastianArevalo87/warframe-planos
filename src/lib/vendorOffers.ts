import offers from "./vendorOffers.json" with { type: "json" };

const prices = offers as Record<string, string>;

export function vendorOffer(english: string): string | null {
  const key = english
    .toLowerCase()
    .replace(/\s+blueprint$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return prices[key] ?? null;
}
