import { buildCatalog, fetchSource, marketEntries } from "./catalogCore.ts";
import type { Catalog } from "../types.ts";

export async function refreshCatalog(previous?: Catalog): Promise<Catalog> {
  const { version, groups, components } = await fetchSource();

  let entries: ReturnType<typeof marketEntries> = [];
  const marketBase = import.meta.env.DEV ? "/market" : "https://api.warframe.market";
  try {
    const marketResponse = await fetch(`${marketBase}/v2/items`);
    if (marketResponse.ok) {
      const marketJson = (await marketResponse.json()) as { data?: unknown };
      const raw = Array.isArray(marketJson.data) ? marketJson.data : [];
      entries = marketEntries(
        raw as Array<{ slug?: string; gameRef?: string; i18n?: { en?: { name?: string } } }>,
      );
    }
  } catch {
    entries = [];
  }

  const next = buildCatalog(groups, entries, version, new Date().toISOString(), components);
  if (entries.length === 0 && previous) {
    const slugs = new Map<string, string>();
    for (const item of previous.items) {
      for (const part of item.parts) {
        if (part.slug) slugs.set(part.id, part.slug);
      }
    }
    for (const item of next.items) {
      for (const part of item.parts) {
        const slug = slugs.get(part.id);
        if (!part.slug && slug) {
          part.slug = slug;
          part.tradable = true;
        }
      }
    }
  }
  return next;
}
