import { buildCatalog, fetchSource, marketEntries } from "./catalogCore.ts";
import type { Catalog } from "../types.ts";

export async function refreshCatalog(): Promise<Catalog> {
  const { version, groups } = await fetchSource();

  let entries: ReturnType<typeof marketEntries> = [];
  try {
    const marketResponse = await fetch("/market/v2/items");
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

  return buildCatalog(groups, entries, version, new Date().toISOString());
}
