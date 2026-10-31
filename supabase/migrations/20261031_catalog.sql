create table if not exists public.catalog_items (
  id text primary key,
  name text not null,
  kind text not null check (kind in ('warframe', 'primary', 'secondary', 'melee')),
  vaulted boolean not null default false,
  image text,
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_parts (
  id text not null,
  item_id text not null references public.catalog_items (id) on delete cascade,
  short text not null,
  title text not null,
  english text not null,
  tradable boolean not null default false,
  slug text,
  image text,
  sort_order integer not null default 0,
  primary key (item_id, id)
);

alter table public.catalog_parts drop constraint if exists catalog_parts_pkey;
alter table public.catalog_parts add primary key (item_id, id);

create table if not exists public.catalog_meta (
  id integer primary key check (id = 1),
  source_version text not null,
  generated_at timestamptz not null
);

create index if not exists catalog_items_kind_name_idx on public.catalog_items (kind, name);
create index if not exists catalog_parts_item_idx on public.catalog_parts (item_id);

alter table public.catalog_items enable row level security;
alter table public.catalog_parts enable row level security;
alter table public.catalog_meta enable row level security;

drop policy if exists "Lee el catalogo" on public.catalog_items;
drop policy if exists "Lee las piezas" on public.catalog_parts;
drop policy if exists "Lee la version" on public.catalog_meta;

create policy "Lee el catalogo" on public.catalog_items for select to authenticated using (true);
create policy "Lee las piezas" on public.catalog_parts for select to authenticated using (true);
create policy "Lee la version" on public.catalog_meta for select to authenticated using (true);

grant select on public.catalog_items, public.catalog_parts, public.catalog_meta to authenticated;

create or replace function public.fold(value text)
returns text
language sql
immutable
as $$
  select translate(
    lower(coalesce(value, '')),
    'áéíóúüñàèìòùâêîôûäëïöÿ',
    'aeiouunaeiouaeiouaeioy'
  );
$$;

create or replace function public.dashboard_stats()
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  col jsonb := '{"parts":[],"built":[],"items":[]}'::jsonb;
  owned_parts text[];
  built_ids text[];
  owned_items text[];
  result jsonb;
begin
  select collection into col from public.profiles where user_id = auth.uid();
  if col is null then
    col := '{"parts":[],"built":[],"items":[]}'::jsonb;
  end if;
  owned_parts := array(select jsonb_array_elements_text(col->'parts'));
  built_ids := array(select jsonb_array_elements_text(col->'built'));
  owned_items := array(select jsonb_array_elements_text(col->'items'));

  select jsonb_build_object(
    'frames', count(*) filter (
      where i.kind = 'warframe' and (
        i.id = any(built_ids)
        or (not exists (select 1 from public.catalog_parts p where p.item_id = i.id) and i.id = any(owned_items))
      )
    ),
    'frameTotal', count(*) filter (where i.kind = 'warframe'),
    'weapons', count(*) filter (
      where i.kind <> 'warframe' and (
        i.id = any(built_ids)
        or (not exists (select 1 from public.catalog_parts p where p.item_id = i.id) and i.id = any(owned_items))
      )
    ),
    'weaponTotal', count(*) filter (where i.kind <> 'warframe'),
    'ready', count(*) filter (
      where i.id <> all(built_ids)
        and exists (select 1 from public.catalog_parts p where p.item_id = i.id)
        and not exists (
          select 1 from public.catalog_parts p
          where p.item_id = i.id and p.id <> all(owned_parts)
        )
    ),
    'partTotal', (select count(*) from public.catalog_parts),
    'sourceVersion', (select source_version from public.catalog_meta where id = 1),
    'generatedAt', (select generated_at from public.catalog_meta where id = 1)
  )
  into result
  from public.catalog_items i;

  return result;
end;
$$;

drop function if exists public.list_items(text, text, text);

create or replace function public.list_items(
  p_kind text,
  p_query text,
  p_status text,
  p_limit integer default 24,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  col jsonb := '{"parts":[],"built":[],"items":[]}'::jsonb;
  words text[];
  result jsonb;
  page_limit integer := least(greatest(coalesce(p_limit, 24), 1), 60);
  page_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if coalesce(p_kind, 'all') = 'all'
     and length(btrim(coalesce(p_query, ''))) < 2
     and coalesce(p_status, 'missing') is distinct from 'ready' then
    return '{"items":[],"total":0}'::jsonb;
  end if;

  select collection into col from public.profiles where user_id = auth.uid();
  if col is null then
    col := '{"parts":[],"built":[],"items":[]}'::jsonb;
  end if;
  words := array_remove(regexp_split_to_array(public.fold(coalesce(p_query, '')), '\s+'), '');

  with owned as (
    select
      array(select jsonb_array_elements_text(col->'parts')) as parts,
      array(select jsonb_array_elements_text(col->'built')) as built,
      array(select jsonb_array_elements_text(col->'items')) as items
  ),
  base as (
    select
      i.id,
      i.name,
      i.kind,
      i.vaulted,
      i.image,
      count(p.id)::int as part_count,
      count(p.id) filter (where p.id = any(o.parts))::int as owned_count,
      i.id = any(o.built) as is_built,
      i.id = any(o.items) as owned_item,
      public.fold(
        i.name || ' ' || coalesce(string_agg(p.title || ' ' || p.short || ' ' || p.english, ' '), '')
      ) as haystack
    from public.catalog_items i
    cross join owned o
    left join public.catalog_parts p on p.item_id = i.id
    where coalesce(p_kind, 'all') = 'all' or i.kind = p_kind
    group by i.id, o.parts, o.built, o.items
  ),
  filtered as (
    select *
    from base
    where (
      coalesce(array_length(words, 1), 0) = 0
      or not exists (
        select 1 from unnest(words) as word
        where haystack not like '%' || word || '%'
      )
    )
    and (
      coalesce(p_status, 'all') = 'all'
      or (
        p_status = 'missing'
        and not (is_built or (part_count = 0 and owned_item))
      )
      or (
        p_status = 'ready'
        and part_count > 0
        and not is_built
        and owned_count = part_count
      )
    )
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', id,
          'name', name,
          'kind', kind,
          'vaulted', vaulted,
          'image', image,
          'partCount', part_count,
          'ownedCount', owned_count,
          'built', is_built,
          'ownedItem', owned_item
        ) order by name
      )
      from (
        select *
        from filtered
        order by name
        limit page_limit
        offset page_offset
      ) page
    ), '[]'::jsonb)
  )
  into result;

  return result;
end;
$$;

create or replace function public.item_detail(p_id text)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'id', i.id,
    'name', i.name,
    'kind', i.kind,
    'vaulted', i.vaulted,
    'image', i.image,
    'parts', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'short', p.short,
          'title', p.title,
          'english', p.english,
          'tradable', p.tradable,
          'slug', p.slug,
          'image', p.image
        ) order by p.sort_order, p.title
      )
      from public.catalog_parts p
      where p.item_id = i.id
    ), '[]'::jsonb)
  )
  from public.catalog_items i
  where i.id = p_id;
$$;

create or replace function public.upsert_catalog(payload jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  added integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select count(*) into added
  from jsonb_array_elements(coalesce(payload->'items', '[]'::jsonb)) as element
  where not exists (
    select 1 from public.catalog_items where id = element->>'id'
  );

  insert into public.catalog_items (id, name, kind, vaulted, image, updated_at)
  select
    element->>'id',
    element->>'name',
    element->>'kind',
    coalesce((element->>'vaulted')::boolean, false),
    nullif(element->>'image', ''),
    now()
  from jsonb_array_elements(coalesce(payload->'items', '[]'::jsonb)) as element
  where element->>'kind' in ('warframe', 'primary', 'secondary', 'melee')
    and length(coalesce(element->>'id', '')) between 1 and 400
    and length(coalesce(element->>'name', '')) between 1 and 200
  on conflict (id) do update set
    name = excluded.name,
    kind = excluded.kind,
    vaulted = excluded.vaulted,
    image = excluded.image,
    updated_at = now();

  insert into public.catalog_parts (id, item_id, short, title, english, tradable, slug, image, sort_order)
  select
    part->>'id',
    element->>'id',
    coalesce(part->>'short', ''),
    coalesce(part->>'title', ''),
    coalesce(part->>'english', ''),
    coalesce((part->>'tradable')::boolean, false),
    nullif(part->>'slug', ''),
    nullif(part->>'image', ''),
    ordinality::integer
  from jsonb_array_elements(coalesce(payload->'items', '[]'::jsonb)) as element
  cross join lateral jsonb_array_elements(coalesce(element->'parts', '[]'::jsonb)) with ordinality as parts(part, ordinality)
  where exists (select 1 from public.catalog_items where id = element->>'id')
    and length(coalesce(part->>'id', '')) between 1 and 400
  on conflict (item_id, id) do update set
    short = excluded.short,
    title = excluded.title,
    english = excluded.english,
    tradable = excluded.tradable,
    slug = coalesce(excluded.slug, public.catalog_parts.slug),
    image = excluded.image,
    sort_order = excluded.sort_order;

  insert into public.catalog_meta (id, source_version, generated_at)
  values (
    1,
    coalesce(payload->>'sourceVersion', ''),
    coalesce((payload->>'generatedAt')::timestamptz, now())
  )
  on conflict (id) do update set
    source_version = excluded.source_version,
    generated_at = excluded.generated_at;

  return added;
end;
$$;

revoke all on function public.fold(text) from public;
revoke all on function public.dashboard_stats() from public;
revoke all on function public.list_items(text, text, text, integer, integer) from public;
revoke all on function public.item_detail(text) from public;
revoke all on function public.upsert_catalog(jsonb) from public;

grant execute on function public.fold(text) to authenticated;
grant execute on function public.dashboard_stats() to authenticated;
grant execute on function public.list_items(text, text, text, integer, integer) to authenticated;
grant execute on function public.item_detail(text) to authenticated;
grant execute on function public.upsert_catalog(jsonb) to authenticated;

notify pgrst, 'reload schema';
