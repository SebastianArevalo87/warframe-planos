import { writeFile } from "node:fs/promises";
import { buildCatalog, fetchSource, marketEntries } from "../src/lib/catalogCore.ts";

const headers = {
  "User-Agent": "warframe-planos/0.1 (personal collection tracker)",
  Accept: "application/json",
  Language: "en",
  Platform: "pc",
};

const { version, groups, components, recipes, images, names } = await fetchSource();
const marketResponse = await fetch("https://api.warframe.market/v2/items", { headers });
if (!marketResponse.ok) throw new Error("No pude leer Warframe Market");
const marketJson = (await marketResponse.json()) as { data?: unknown };
const marketRaw = Array.isArray(marketJson.data) ? marketJson.data : [];
const catalog = buildCatalog(
  groups,
  marketEntries(marketRaw as Array<{ slug?: string; gameRef?: string; i18n?: { en?: { name?: string } } }>),
  version,
  new Date().toISOString(),
  components,
  recipes,
  images,
  names,
);

const tradable = catalog.items.flatMap((item) => item.parts).filter((part) => part.tradable);
const matched = tradable.filter((part) => part.slug);
const frames = catalog.items.filter((item) => item.kind === "warframe").length;
console.log(
  `${version} · warframes ${frames} · items ${catalog.items.length} · planos ${catalog.items.reduce((sum, item) => sum + item.parts.length, 0)} · precios ${matched.length}/${tradable.length}`,
);

await writeFile(new URL("../public/catalog.json", import.meta.url), JSON.stringify(catalog));
