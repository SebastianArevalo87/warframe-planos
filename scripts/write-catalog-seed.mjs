import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const catalog = JSON.parse(readFileSync(new URL("../public/catalog.json", import.meta.url), "utf8"));
const outDir = process.env.SEED_DIR;
if (!outDir) throw new Error("SEED_DIR");
mkdirSync(outDir, { recursive: true });

function quote(payload) {
  return `$wf$${JSON.stringify(payload).replaceAll("$wf$", "$wf $")}$wf$`;
}

const size = 80;
let file = 0;
for (let index = 0; index < catalog.items.length; index += size) {
  file += 1;
  const batch = catalog.items.slice(index, index + size);
  const parts = batch.flatMap((item) =>
    item.parts.map((part, order) => ({
      id: part.id,
      item_id: item.id,
      short: part.short,
      title: part.title,
      english: part.english,
      tradable: part.tradable,
      slug: part.slug,
      image: part.image,
      sort_order: order + 1,
    })),
  );
  const sql = `
insert into public.catalog_items (id, name, kind, vaulted, image)
select id, name, kind, vaulted, nullif(image, '')
from jsonb_to_recordset(${quote(batch.map((item) => ({
    id: item.id,
    name: item.name,
    kind: item.kind,
    vaulted: item.vaulted,
    image: item.image,
  })))}::jsonb) as row(id text, name text, kind text, vaulted boolean, image text)
on conflict (id) do update set
  name = excluded.name,
  kind = excluded.kind,
  vaulted = excluded.vaulted,
  image = excluded.image,
  updated_at = now();

insert into public.catalog_parts (id, item_id, short, title, english, tradable, slug, image, sort_order)
select id, item_id, short, title, english, tradable, nullif(slug, ''), nullif(image, ''), sort_order
from jsonb_to_recordset(${quote(parts)}::jsonb)
  as row(id text, item_id text, short text, title text, english text, tradable boolean, slug text, image text, sort_order integer)
on conflict (item_id, id) do update set
  short = excluded.short,
  title = excluded.title,
  english = excluded.english,
  tradable = excluded.tradable,
  slug = coalesce(excluded.slug, public.catalog_parts.slug),
  image = excluded.image,
  sort_order = excluded.sort_order;
`;
  writeFileSync(`${outDir}/batch-${String(file).padStart(2, "0")}.sql`, sql);
}

const dollar = (value) => `$wf$${String(value).replaceAll("$wf$", "$wf $")}$wf$`;
writeFileSync(
  `${outDir}/meta.sql`,
  `
insert into public.catalog_meta (id, source_version, generated_at)
values (1, ${dollar(catalog.sourceVersion)}, ${dollar(catalog.generatedAt)}::timestamptz)
on conflict (id) do update set
  source_version = excluded.source_version,
  generated_at = excluded.generated_at;
`,
);
console.log(`batches ${file} items ${catalog.items.length}`);
